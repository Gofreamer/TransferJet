const test = require('node:test');
const assert = require('node:assert/strict');
const { context, load } = require('./helpers.cjs');

test('busca global une agentes e equipes, ignora acentos e limita resultados', () => {
  const c = load(context(), 'js/features/market/premium-ui.js');
  const players = [{ key: 'a', name: 'Álice', club: 'Alpha', rank: 'A' }, ...Array.from({length: 12}, (_,i) => ({ key: 'p'+i, name: 'Agente '+i, club: 'Beta' }))];
  assert.equal(c.PremiumUI.search('ALICE', players, ['Álice FC'])[0].key, 'a');
  assert.equal(c.PremiumUI.search('alice', players, ['Álice FC'])[1].kind, 'club');
  assert.equal(c.PremiumUI.search('agente', players, []).length, 8);
  assert.equal(c.PremiumUI.search('   ', players, ['Alpha']).length, 0);
  assert.equal(c.PremiumUI.search('inexistente', players, ['Alpha']).length, 0);
});

test('tema funciona com localStorage bloqueado e identifica a próxima ação do botão', () => {
  const attributes = {};
  const button = { setAttribute: (key, value) => attributes[key] = value };
  const c = context();
  c.document.documentElement = {
    setAttribute: (key, value) => attributes[key] = value,
    getAttribute: key => attributes[key]
  };
  c.document.getElementById = () => button;
  c.localStorage.getItem = c.localStorage.setItem = () => { throw Error('blocked'); };
  load(c, 'js/utils/theme.js');
  c.initTheme();
  assert.equal(attributes['data-theme'], 'dark');
  c.toggleTheme();
  assert.equal(attributes['data-theme'], 'light');
  assert.equal(attributes['aria-pressed'], 'true');
  assert.equal(attributes['aria-label'], 'Ativar tema escuro');
});

test('gráfico usa cores do tema, valores originais e respeita movimento reduzido', () => {
  const c = load(context(), 'js/core/state.js', 'js/utils/format.js', 'js/app.js');
  const canvas = {};
  const colors = { '--cyan': '#087c70', '--text-muted': '#526975', '--border': '#dbe4e8', '--cyan-glow': '#087c7010' };
  c.document.getElementById = () => canvas;
  c.getComputedStyle = () => ({ getPropertyValue: name => colors[name] });
  c.matchMedia = () => ({ matches: true });
  let options;
  let destroyed = false;
  c._valueChartInstance = { destroy() { destroyed = true; } };
  c.Chart = function (target, config) { assert.equal(target, canvas); options = config; };
  c.renderValueChart([{ season: 'T1', value: 32000000 }, { season: 'T2', value: 35000000 }]);
  assert.equal(destroyed, true);
  assert.equal(options.data.datasets[0].borderColor, '#087c70');
  assert.equal(options.options.scales.x.ticks.color, '#526975');
  assert.equal(options.options.animation, false);
  assert.equal(JSON.stringify(options.data.datasets[0].data), '[32000000,35000000]');
});

test('gráfico sem SDK mostra estado compreensível em vez de canvas vazio', () => {
  const c = load(context(), 'js/core/state.js', 'js/app.js');
  let fallback;
  c.document.getElementById = () => ({ replaceWith: node => fallback = node });
  c.document.createElement = () => ({ setAttribute() {}, append(...items) { this.items = items; } });
  c.renderValueChart([{ season: 'T1', value: 32000000 }]);
  assert.equal(fallback.className, 'chart-state');
  assert.equal(fallback.items[0].textContent, 'O gráfico não carregou');
});
