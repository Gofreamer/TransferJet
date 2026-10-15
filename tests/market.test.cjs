const test = require('node:test');
const assert = require('node:assert/strict');
const { context, load } = require('./helpers.cjs');
function setup() { return load(context(), 'js/core/state.js', 'js/utils/format.js', 'js/utils/valuation.js', 'js/services/market.js'); }

test('alterações de valor acumulam eventos reais sem tocar no legado ou estado original', () => {
  const { Market } = setup();
  const old = { marketValue: 30000000, photo: 'photo', valueHistory: [{ season: 'T1', value: 500 }] };
  const before = JSON.stringify(old);
  const first = Market.createRecord('Alpha_Alice', old, { marketValue: 32000000 }, { at: 1, season: 'T2', round: 1 }, 'a');
  const second = Market.createRecord('Alpha_Alice', first, { marketValue: 31000000 }, { at: 2, season: 'T2', round: 2 }, 'b');
  assert.equal(JSON.stringify(old), before);
  assert.equal(first.id, second.id);
  assert.equal(second.peakValue, 32000000);
  assert.equal(Market.events(second).length, 2);
  assert.equal(second.valueEvents.b.previousValue, 32000000);
  assert.equal(Market.variation(second).diff, -1000000);
  assert.equal(Market.history(second, { season: 'T2', round: 1 }).length, 1);
  assert.equal(Market.history(second, { source: 'legacy' })[0].kind, 'legacy');
  assert.equal(second.photo, 'photo');
});

test('metadados não criam valorização; registros sem origem nunca viram históricos reais', () => {
  const { Market } = setup();
  const old = { marketValue: 100, peakValue: 100, valueHistory: [{ season: 'T1', value: 25 }] };
  const next = Market.createRecord('k', old, { salary: 20 }, { at: 1 }, 'a');
  assert.equal(Market.events(next).length, 0);
  assert.equal(Market.variation(next), null);
  assert.equal(Market.history(next).length, 0);
  assert.equal(Market.createRecord('k', next, { salary: 20 }, {}, 'b'), next);
});

test('validação rejeita valores negativos, campos protegidos e edição desatualizada', () => {
  const { Market } = setup();
  assert.throws(() => Market.createRecord('k', {}, { marketValue: -1 }, {}, 'a'), /válido/);
  assert.throws(() => Market.createRecord('k', {}, { marketValue: NaN }, {}, 'a'), /válido/);
  assert.throws(() => Market.createRecord('k', {}, { id: 'new' }, {}, 'a'), /protegido/);
  assert.throws(() => Market.createRecord('k', { marketValue: 150 }, { marketValue: 200 }, { expected: { marketValue: 100 } }, 'a'), /outra sessão/);
});

test('filtros combinam acentos, rank exato, status, equipe e faixa de valor', () => {
  const { Market } = setup();
  const players = [{ name: 'Álice', rank: 'Rank A', status: 'suspenso', club: 'Alpha', marketValue: 30 }, { name: 'Alice', rank: 'Clandestino', club: 'Alpha', status: 'ativo', marketValue: 20 }];
  assert.equal(Market.filter(players, { search: 'alice', rank: 'Rank A', status: 'suspenso', club: 'Alpha', minValue: 20, maxValue: 40 }).length, 1);
  assert.equal(Market.filter(players, { rank: 'Rank A', status: 'ativo' }).length, 0);
});

test('importação mantém identidade e recusa homônimos sem ID', () => {
  const { Market } = setup();
  const players = [{ id: 'id1', key: 'Old_Alice', name: 'Alice', club: 'Beta' }, { id: 'id2', key: 'Gamma_Alice', name: 'Alice', club: 'Gamma' }];
  assert.equal(Market.resolveImportPlayer(players, { id: 'id1', name: 'Outro nome', team: 'New' }).key, 'Old_Alice');
  assert.equal(Market.resolveImportPlayer(players, { name: 'Alice', team: 'Beta' }).id, 'id1');
  assert.throws(() => Market.resolveImportPlayer(players, { name: 'Alice', team: 'New' }), /ambíguo/);
});

test('fórmula mantém teto vigente e interpreta ranks sem confundir letras de rank/clandestino', () => {
  const { VALUATION } = setup();
  assert.equal(VALUATION.resolveRankBase('rank b'), 1500000);
  assert.equal(VALUATION.resolveRankBase('CLANDESTINO'), 1500000);
  assert.equal(VALUATION.resolveRankBase(' Rank E '), 250000);
  assert.equal(VALUATION.maxValue, 12000000);
  assert.equal(VALUATION.calculate({ rank: 'Especial', P: 20, V: 20, titles: { mundial: 100 } }).value, 12000000);
});

test('lote grava campos e eventos em uma operação, preservando legado e recusando conflitos', async () => {
  const c = setup();
  const existing = { marketValue: 30000000, photo: 'kept', valueHistory: [{ season: 'T1', value: 100 }] };
  const writes = [];
  c.marketDb = { ref: () => ({ once: async () => ({ val: () => ({ k: existing }) }), push: () => ({ key: 'ev1' }), update: async updates => writes.push(updates) }) };
  await c.Market.saveBatch([{ key: 'k', changes: { marketValue: 31000000 }, expected: existing }], { season: 'T2', round: 2 }, { 'settings/syncedMatches/m1': { round: 2 } });
  assert.equal(writes.length, 1);
  assert.equal(writes[0]['players/k/marketValue'], 31000000);
  assert.equal(writes[0]['players/k/valueEvents/ev1'].previousValue, 30000000);
  assert.equal(writes[0]['players/k/valueHistory'], undefined);
  assert.equal(writes[0]['players/k/photo'], undefined);
  assert.ok(writes[0]['settings/syncedMatches/m1']);
  await assert.rejects(c.Market.saveBatch([{ key: 'k', changes: { marketValue: 1 }, expected: { marketValue: 2 } }]), /outra sessão/);
  assert.equal(writes.length, 1);
  assert.equal(existing.marketValue, 30000000);
});

test('importação conserva chave ao trocar nome/equipe e modo statsOnly não altera preço nem pico', async () => {
  const c = setup();
  load(c, 'js/app.js', 'js/features/admin/admin.js', 'js/features/admin/admin-market.js');
  c.AppState.jet.rosters = { Alpha: [{ n: 'Alice' }] };
  c.AppState.market.players = { Alpha_Alice: { marketValue: 32000000, peakValue: 35000000, id: 'id1', titles: {} } };
  const rows = c.calculateValuesFromRows([{ ID: 'id1', Equipe: 'Beta', Agente: 'Alicia', Rank: 'Rank A', P: 10, V: 8, D: 2 }]);
  assert.equal(rows[0].key, 'Alpha_Alice');
  let saved;
  c.Market.saveBatch = async entries => { saved = entries; };
  await c.MarketAdmin.applyImport(rows, 'statsOnly', {});
  assert.equal(saved[0].key, 'Alpha_Alice');
  assert.equal(saved[0].changes.team, 'Beta');
  assert.equal(saved[0].changes.name, 'Alicia');
  assert.equal(saved[0].changes.marketValue, undefined);
  assert.equal(saved[0].changes.peakValue, undefined);
  assert.equal(c.AppState.market.players.Alpha_Alice.marketValue, 32000000);
});

test('transação repetida mantém eventos paralelos e rejeita preço de revisão desatualizado', async () => {
  const c = setup();
  let saved;
  c.marketDb = { ref: () => ({ once: async () => {}, push: () => ({ key: 'event2' }), transaction: async callback => {
    callback({ marketValue: 100 });
    saved = callback({ marketValue: 100, photo: 'concurrent', valueEvents: { event1: { kind: 'recorded', value: 100, previousValue: 80, at: 1 } } });
    return { committed: saved !== undefined, snapshot: { val: () => saved } };
  } }) };
  const next = await c.Market.savePlayer('k', { marketValue: 120 }, { expected: { marketValue: 100 } });
  assert.equal(next.photo, 'concurrent');
  assert.equal(c.Market.events(next).length, 2);
  assert.equal(next.valueEvents.event2.previousValue, 100);
});

test('transferências de homônimos ou negociações não contam como carreira oficial', () => {
  const { Market } = setup();
  const player = { key: 'k1', id: 'id1', name: 'Alice' };
  const homonym = { key: 'k2', id: 'id2', name: 'Alice' };
  assert.equal(Market.transferMatches({ status: 'negociando', playerId: 'id1' }, player, [player]), false);
  assert.equal(Market.transferMatches({ status: 'oficial', playerId: 'id2', playerName: 'Alice' }, player, [player, homonym]), false);
  assert.equal(Market.transferMatches({ status: 'oficial', playerName: 'Alice' }, player, [player, homonym]), false);
  assert.equal(Market.transferMatches({ status: 'oficial', playerKey: 'old', playerName: 'Alice' }, player, [player]), true);
  assert.equal(Market.transferMatches({ status: 'oficial', playerId: 'id1', playerName: 'Renomeada' }, player, [player, homonym]), true);
});

test('comparação destaca empates e ignora métricas ausentes; auditoria encontra duplicidades reais', () => {
  const { Market } = setup();
  assert.equal(JSON.stringify(Market.compareWinners([{ key: 'a', marketValue: 20 }, { key: 'b', marketValue: 20 }, { key: 'c', marketValue: null }], p => p.marketValue)), '["a","b"]');
  assert.equal(Market.auditPlayers({ a: { id: 'id1', name: 'Alice', team: 'A' }, b: { id: 'id1', name: 'Alice', team: 'A' } }).length, 2);
  assert.equal(Market.auditPlayers({ a: { name: 'Alice', team: 'A' }, b: { name: 'Alice', team: 'B' } }).length, 0);
});

test('restauração recusa registro existente e não executa update ou set', async () => {
  const c = setup();
  load(c, 'js/features/admin/admin-market.js');
  let count = 0;
  c.marketDb = { ref: () => ({ once: async () => ({ val: () => ({}) }), transaction: async callback => {
    const value = callback({ playerName: 'Original' });
    assert.equal(value, undefined);
    count++;
    return { committed: false };
  } }) };
  await assert.rejects(c.MarketAdmin.restoreRecord({ collection: 'transfers', key: 't1', record: { playerName: 'Backup' } }), /já existe/);
  assert.equal(count, 1);
  assert.throws(() => c.MarketAdmin.validateBackup({ format: 'transferjet-market', version: 1, data: { players: { k: { marketValue: -1 } } } }), /numérico/);
  await assert.rejects(c.MarketAdmin.restoreRecord({ collection: 'settings', key: 'k', record: {} }), /não permitida/);
});

test('sync mantém preço em statsOnly e grava marcação das partidas no mesmo lote', async () => {
  const c = setup();
  load(c, 'js/app.js', 'js/features/admin/admin.js', 'js/features/admin/admin-market.js');
  let result;
  c.Market.saveBatch = async (rows, meta, extra) => { result = { rows, meta, extra }; };
  await c.MarketAdmin.applySync([{ key: 'k', name: 'Alice', team: 'Alpha', P: 10, V: 8, D: 2, wr: 0.8, _existing: { marketValue: 32000000, peakValue: 35000000 } }], { mode: 'statsOnly', season: 'T2', round: 3, matchIds: ['m1'], ignoreAwards: true }, {});
  assert.equal(result.rows[0].changes.marketValue, undefined);
  assert.equal(result.rows[0].changes.peakValue, undefined);
  assert.equal(result.rows[0].changes.statsSeason, 'T2');
  assert.equal(result.meta.source, 'jet-sync');
  assert.equal(result.extra['settings/syncedMatches/m1'].round, 3);
});
