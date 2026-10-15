const test = require('node:test');
const assert = require('node:assert/strict');
const { context, load } = require('./helpers.cjs');

function setup(respond, extra = {}) {
  const calls = []; const apps = []; let loads = 0;
  const timers = new Set();
  const c = load(context({ AbortController,
    setTimeout(fn, ms) { const timer = setTimeout(fn, ms); timers.add(timer); return timer; },
    clearTimeout(timer) { timers.delete(timer); clearTimeout(timer); }, ...extra
  }), 'js/services/ai.js');
  const sdk = {
    getApps: () => apps, initializeApp(config, name) { const app = { name }; apps.push(app); return app; },
    getAI: app => app, GoogleAIBackend: class {},
    getGenerativeModel(app, options) { return { generateContent(prompt, request) {
      const call = { project: app.name, model: options.model, prompt, signal: request.signal };
      calls.push(call);
      return Promise.resolve().then(() => respond(call));
    } }; }
  };
  const configs = () => [['jet', { apiKey: 'fixture' }], ['market', { apiKey: 'fixture' }]];
  const client = c.MarketAI.createClient({ load: async () => { loads++; return sdk; }, configs });
  return { c, client, sdk, configs, calls, timers, loads: () => loads };
}
const response = text => ({ response: { text: () => text } });

test('IA compartilha requisição idêntica e carregamento; libera timers e permite regenerar', async () => {
  const { client, calls, loads, timers } = setup(({ prompt }) => response(prompt));
  const first = client.generate(' alpha ');
  assert.equal(client.generate('alpha'), first);
  const other = client.generate('beta');
  assert.deepEqual(await Promise.all([first, other]), ['alpha', 'beta']);
  assert.equal(loads(), 1); assert.equal(calls.length, 2); assert.equal(timers.size, 0);
  assert.equal(client.isReady(), true);
  assert.equal(await client.generate('alpha'), 'alpha');
  assert.equal(calls.length, 3, 'regeneração explícita consulta novamente');
});

test('modelo ausente usa fallback atual e não repete o modelo inválido na próxima consulta', async () => {
  const { client, calls } = setup(({ model }) => {
    if (model === 'gemini-3.6-flash') throw Error('404 model not found');
    return response('revisar');
  });
  assert.equal(await client.generate('primeiro'), 'revisar');
  assert.equal(await client.generate('segundo'), 'revisar');
  assert.deepEqual(calls.map(c => c.model), ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash']);
});

test('permissão não repete modelos do mesmo projeto e reutiliza o projeto disponível', async () => {
  const { client, calls } = setup(({ project }) => {
    if (project === 'jet') throw Error('403 permission denied');
    return response('ok');
  });
  await client.generate('um'); await client.generate('dois');
  assert.deepEqual(calls.map(c => c.project), ['jet', 'market', 'market']);
});

test('quota aplica pausa por projeto e recuperação limpa o erro anterior', async () => {
  let clock = 100; let quota = true;
  const { c, sdk, configs, calls } = setup(() => { if (quota) throw Error('429 RESOURCE_EXHAUSTED'); return response('ok'); });
  const client = c.MarketAI.createClient({ load: async () => sdk, configs, now: () => clock });
  await assert.rejects(client.generate('um'), /Limite de uso/);
  assert.equal(calls.length, 2, 'uma chamada por projeto');
  await assert.rejects(client.generate('dois'), /Limite de uso/);
  assert.equal(calls.length, 2, 'pausa evita insistência');
  assert.equal(client.getLastError().code, 'market-ai/quota');
  quota = false; clock += 30001;
  assert.equal(await client.generate('três'), 'ok');
  assert.equal(client.getLastError(), null);
});

test('timeout cancela requisição e não inicia novas tentativas após expirar', async () => {
  let release;
  const { client, calls, timers } = setup(() => new Promise(resolve => { release = resolve; }));
  await assert.rejects(client.generate('demorado', undefined, { timeoutMs: 20 }), /demorou/);
  assert.equal(calls.length, 1); assert.equal(calls[0].signal.aborted, true);
  release(response('resposta atrasada')); await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.length, 1); assert.equal(timers.size, 0);
});

test('SDK que falha pode carregar novamente; vazio, offline e conteúdo bloqueado têm mensagens úteis', async () => {
  const { c, sdk, configs, calls } = setup(() => response(''));
  let fails = true;
  const client = c.MarketAI.createClient({ load: async () => { if (fails) throw Error('CDN offline'); return sdk; }, configs });
  await assert.rejects(client.generate(''), /Informe/);
  await assert.rejects(client.generate('texto'), /Não foi possível/);
  fails = false;
  await assert.rejects(client.generate('texto'), /conteúdo utilizável/);
  assert.equal(calls.length, 1, 'bloqueio de conteúdo não inicia fallback');
  c.navigator = { onLine: false };
  await assert.rejects(client.generate('offline'), /Sem conexão/);
  assert.equal(calls.length, 1);
});
