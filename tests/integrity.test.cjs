const test = require('node:test');
const assert = require('node:assert/strict');
const { context, load } = require('./helpers.cjs');

function setup() {
  const c = load(context(), 'js/core/state.js', 'js/utils/format.js', 'js/features/fantasy/fantasy-state.js', 'js/features/fantasy/fantasy-market.js', 'js/app.js', 'js/services/transfers.js', 'js/services/market.js', 'js/features/admin/admin-market.js');
  c.AppState.jet.rosters = { Alpha: [{ n: 'Alice', role: 'titular' }], Beta: [] };
  c.AppState.market.players = { Alpha_Alice: { marketValue: 20000000, status: 'ativo', valueHistory: [{ season: 'T1', value: 19000000 }] } };
  c.AppState.market.settings.transferWindowOpen = true;
  return c;
}
const transfer = { playerKey: 'Alpha_Alice', playerName: 'Alice', from: 'Alpha', to: 'Beta', fee: 10, type: 'definitiva', status: 'oficial' };

test('transferência preserva chave, ID, valor, histórico e referências Fantasy', () => {
  const c = setup();
  const agent = c.getAllPlayersFlat()[0];
  const before = JSON.stringify(c.AppState.market.players);
  const updates = c.buildTransferUpdates(transfer, 't1', c.AppState.market.players, agent);
  assert.equal(JSON.stringify(c.AppState.market.players), before);
  assert.equal(updates['players/Alpha_Alice/id'], agent.id);
  assert.equal(updates['transfers/t1'].playerId, agent.id);
  assert.ok(!Object.keys(updates).some(k => k.includes('marketValue') || k.includes('valueHistory') || k.includes('Beta_Alice')));
  for (const [key, value] of Object.entries(updates)) {
    if (key.startsWith('players/')) c.AppState.market.players.Alpha_Alice[key.split('/')[2]] = value;
  }
  let players = c.getAllPlayersFlat();
  assert.equal(players.length, 1);
  assert.equal(players[0].club, 'Beta');
  assert.equal(players[0].marketValue, 20000000);
  assert.ok(c.fantasyPlayerMap().Alpha_Alice);
  // Depois que a liga sincroniza, a nova equipe encontra o mesmo registro.
  c.AppState.jet.rosters = { Alpha: [], Beta: [{ n: 'Alice' }] };
  players = c.getAllPlayersFlat();
  assert.equal(players.length, 1);
  assert.equal(players[0].key, 'Alpha_Alice');
  assert.equal(players[0].id, agent.id);
});

test('segunda transferência conserva identidade e recusa origem desatualizada', () => {
  const c = setup();
  c.AppState.market.players.Alpha_Alice = { ...c.AppState.market.players.Alpha_Alice, team: 'Beta', name: 'Alice', id: 'permanent-1' };
  const agent = c.getAllPlayersFlat()[0];
  assert.throws(() => c.buildTransferUpdates(transfer, 't2', c.AppState.market.players, agent), /origem/);
  const updates = c.buildTransferUpdates({ ...transfer, from: 'Beta', to: 'Gamma' }, 't2', c.AppState.market.players, agent);
  assert.equal(updates['players/Alpha_Alice/id'], 'permanent-1');
});

test('valida taxa, origem, destino, status e colisão antes de salvar', () => {
  const c = setup();
  const players = c.AppState.market.players;
  const agent = c.getAllPlayersFlat()[0];
  for (const fee of [-1, NaN, Infinity]) assert.throws(() => c.buildTransferUpdates({ ...transfer, fee }, 't1', players, agent), /taxa/);
  assert.throws(() => c.buildTransferUpdates({ ...transfer, to: 'Alpha' }, 't1', players, agent));
  assert.throws(() => c.buildTransferUpdates({ ...transfer, playerKey: 'bad/path' }, 't1', players, agent), /Identificador/);
  assert.throws(() => c.buildTransferUpdates(transfer, 't1', players, { ...agent, status: 'suspenso' }), /status/);
  players.Beta_Alice = { name: 'Alice', marketValue: 500 };
  assert.throws(() => c.buildTransferUpdates(transfer, 't1', players, agent), /destino/);
});

test('negociação grava apenas histórico, sem mudar vínculo', () => {
  const c = setup();
  const updates = c.buildTransferUpdates({ ...transfer, status: 'negociando' }, 't1', c.AppState.market.players, c.getAllPlayersFlat()[0]);
  assert.deepEqual(Object.keys(updates), ['transfers/t1']);
});

test('contratação de livre torna o agente elegível sem mudar sua chave', () => {
  const c = setup();
  c.AppState.market.players.Alpha_Alice.status = 'livre';
  c.AppState.market.players.Alpha_Alice.freeAgent = true;
  const agent = c.getAllPlayersFlat()[0];
  const updates = c.buildTransferUpdates({ ...transfer, from: 'Livre' }, 't1', c.AppState.market.players, agent);
  assert.equal(updates['players/Alpha_Alice/status'], 'ativo');
  assert.equal(updates['players/Alpha_Alice/freeAgent'], false);
});

test('registro usa uma única escrita atômica e propaga falhas', async () => {
  const c = setup();
  const writes = [];
  c.marketDb = { ref(path) { return {
    once: async () => ({ val: () => c.AppState.market.players }),
    push: () => ({ key: 'unique' }),
    update: async updates => { writes.push({ path, updates }); }
  }; } };
  await c.recordTransfer(transfer, c.getAllPlayersFlat()[0]);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].path, undefined);
  assert.ok(writes[0].updates['transfers/unique']);
  c.marketDb.ref = () => ({ once: async () => ({ val: () => c.AppState.market.players }), push: () => ({ key: 'fail' }), update: async () => { throw Error('permission_denied'); } });
  await assert.rejects(c.recordTransfer(transfer, c.getAllPlayersFlat()[0]), /permission_denied/);
  c.AppState.market.settings.transferWindowOpen = false;
  await assert.rejects(c.recordTransfer(transfer, c.getAllPlayersFlat()[0]), /fechada/);
});

test('sessão Fantasy restaura uma vez e permite logout com storage bloqueado', () => {
  const c = setup();
  c.localStorage.getItem = key => key === 'fantasyParticipantId' ? 'human1' : 'Richard';
  assert.equal(c.ensureFantasyState().session.participantId, 'human1');
  c.localStorage.removeItem = () => { throw Error('blocked'); };
  c.setFantasySession(null, null);
  assert.equal(c.ensureFantasyState().session.participantId, null);
});

test('sincronização da liga usa transação, evita duplicação e não informa falso sucesso', async () => {
  const c = setup();
  const alerts = [];
  c.alert = message => alerts.push(message);
  load(c, 'js/features/admin/admin.js');
  let rosters = { Alpha: [{ n: 'Alice' }, { n: 'Bob' }], Beta: [], Other: [{ n: 'Eve' }] };
  c.jetDb = { ref: path => {
    assert.equal(path, 'liga/rosters');
    return { once: async () => ({ val: () => rosters }), transaction: async callback => {
      const updated = callback(rosters);
      if (updated) rosters = updated;
      return { committed: !!updated };
    } };
  } };
  assert.equal(await c.syncTransferToJetLeague(transfer), true);
  assert.equal(rosters.Alpha.length, 1);
  assert.equal(rosters.Beta.length, 1);
  assert.equal(rosters.Other[0].n, 'Eve');
  assert.equal(await c.syncTransferToJetLeague(transfer), false);
  assert.equal(rosters.Beta.length, 1);
  assert.match(alerts.at(-1), /não foi alterado/);
});

test('edição recusada não modifica histórico em memória nem sobrescreve campos não editados', async () => {
  const c = setup();
  load(c, 'js/features/admin/admin.js');
  const before = JSON.stringify(c.AppState.market.players);
  const alerts = [];
  c.alert = message => alerts.push(message);
  const row = {
    dataset: { key: 'Alpha_Alice' },
    querySelectorAll: selector => selector === '.admin-title' ? [] : [{ dataset: { field: 'marketValue' }, value: '21000000' }]
  };
  let patch;
  c.marketDb = { ref: () => ({ once: async () => {}, push: () => ({ key: 'event1' }), transaction: async callback => { patch = callback(c.AppState.market.players.Alpha_Alice); throw Error('permission_denied'); } }) };
  await c.savePlayerRow({ closest: () => row });
  assert.equal(JSON.stringify(c.AppState.market.players), before);
  assert.equal(patch.id, 'legacy:Alpha_Alice');
  assert.equal(patch.marketValue, 21000000);
  assert.equal(patch.photo, undefined);
  assert.match(alerts[0], /permission_denied/);
});

test('links externos rejeitam protocolos executáveis e escapam texto e atributos', () => {
  const c = setup();
  c.AppState.market.settings.jetLeagueUrl = 'javascript:alert(1)';
  assert.equal(c.getJetLeagueUrl(), 'https://teste-jet.pages.dev');
  assert.equal(c.escapeHTML('<img src="x">'), '&lt;img src=&quot;x&quot;&gt;');
  assert.ok(!c.escapeInlineJsSingle('" onclick="alert(1)').includes('"'));
});
