const test = require('node:test');
const assert = require('node:assert/strict');
const { context, load } = require('./helpers.cjs');
const dir = 'js/features/fantasy/';

function setup() {
  const players = Array.from({ length: 9 }, (_, i) => ({ key: 'p' + i, id: 'id' + i, name: 'Agent ' + i, club: 'Team ' + Math.floor(i / 2), marketValue: 1000000, status: 'ativo', rank: 'A' }));
  const c = load(context({ getAllPlayersFlat: () => players }), 'js/core/state.js', 'js/utils/format.js', dir + 'fantasy-state.js', dir + 'fantasy-market.js', dir + 'fantasy-data.js', dir + 'fantasy-scoring.js', dir + 'fantasy-rounds.js', dir + 'fantasy-npcs.js');
  c.ensureFantasyState();
  c.AppState.fantasy.settings = { ...c.FANTASY.DEFAULTS, currentRoundId: 'r1', seasonId: 'T2' };
  const participant = { displayName: 'Richard', type: 'human', budgetRemaining: 5000000, squad: { starters: ['p0', 'p1', 'p2', 'p3', 'p4'], bench: 'p5', captainKey: 'p0' } };
  return { c, players, participant };
}

test('Fantasy compartilha elegibilidade e recusa saldo, slot e agentes inválidos', () => {
  const { c, players, participant: p } = setup();
  assert.equal(c.validateSquad(p.squad, p.budgetRemaining).ok, true);
  players[7].status = 'suspenso'; players[8].marketValue = 0;
  assert.equal(c.fantasyPlayerMap().p7, undefined);
  assert.equal(c.fantasyEligiblePlayers().length, 7);
  for (const slot of [NaN, 1.5, '0', null, -1, 5]) assert.equal(c.tryAddToSquad(p, 'p6', slot).ok, false);
  assert.equal(c.tryAddToSquad(p, 'p7', 0).ok, false);
  assert.equal(c.tryAddToSquad({ ...p, budgetRemaining: NaN }, 'p6', 0).ok, false);
  assert.equal(c.validateSquad(p.squad, -1).ok, false);
  players[0].status = 'aposentado';
  assert.equal(c.validateSquad(p.squad, 0).ok, false);
});

test('troca calcula custo líquido, retira capitão e conserva valor ao vender agente suspenso', () => {
  const { c, players, participant: p } = setup();
  players[0].status = 'suspenso'; players[6].marketValue = 2000000;
  const swap = c.tryAddToSquad({ ...p, budgetRemaining: 150000 }, 'p6', 0);
  assert.equal(swap.ok, true);
  assert.equal(swap.budgetRemaining, 50000);
  assert.equal(swap.squad.captainKey, null);
  const duplicated = { ...p, squad: { ...p.squad, bench: 'p0' } };
  assert.equal(c.tryRemoveFromSquad(duplicated, 'p0').budgetRemaining, 5100000, 'um único reembolso');
  players.splice(0, 1);
  assert.equal(c.tryRemoveFromSquad({ ...p, acquisitions: { p0: { boughtFor: 150000 } } }, 'p0').budgetRemaining, 5150000);
});

test('edição usa participante remoto, aborta mercado fechado e propaga falhas sem gravação local', async () => {
  const { c, participant, players } = setup();
  players[6].marketValue = 2000000;
  c.setFantasySession('human1', 'Richard');
  let raw = { ...participant, budgetRemaining: 50000 };
  let settings = c.fantasySettings(); let writes = 0;
  c.marketDb = { ref: path => ({ once: async () => ({ val: () => settings }), transaction: async cb => {
    const next = cb(structuredClone(raw));
    if (next === undefined) return { committed: false };
    raw = next; writes++;
    return { committed: true, snapshot: { val: () => raw } };
  } }) };
  c.AppState.fantasy.participants.human1 = { ...participant, budgetRemaining: 5000000 };
  await assert.rejects(c.mutateFantasySquad('human1', p => c.tryAddToSquad(p, 'p6', 'bench')), /Orçamento/);
  assert.equal(writes, 0);
  raw.budgetRemaining = 100000;
  await c.mutateFantasySquad('human1', p => c.tryAddToSquad(p, 'p6', 'bench'));
  assert.equal(writes, 1); assert.equal(c.AppState.fantasy.participants.human1.squad.bench, 'p6');
  settings = { ...settings, marketStatus: 'LOCKED' };
  await assert.rejects(c.mutateFantasySquad('human1', p => c.tryRemoveFromSquad(p, 'p6')), /fechado/);
  assert.equal(writes, 1);
});

test('estratégia Caos é repetível por rodada e usa somente agentes elegíveis', () => {
  const { c, players } = setup(); players[0].status = 'suspenso';
  const a = c.rankPlayersForStrategy('chaos').map(p => p.key);
  assert.deepEqual(a, c.rankPlayersForStrategy('chaos').map(p => p.key));
  assert.equal(a.includes('p0'), false);
});

function match(extra = {}) {
  return { temporada: 'T2', rodada: 1, timeA: 'Team 0', timeB: 'Team 1', scoreA: 2, scoreB: 0,
    fights: [{ teamA: { agents: ['Agent 0', 'Agent 1'] }, teamB: { agents: ['Agent 2', 'Agent 3'] } }], seriesMvp: { agent: 'Agent 0' }, destaqueRodada: 'Agent 0', ...extra };
}

test('pontuação usa cópia oficial e regras originais após troca, suspensão e renomeação', () => {
  const { c, players, participant } = setup();
  const snapshot = c.buildFantasySnapshot({ human1: participant }, players, c.fantasySettings(), '2026-10-15T00:00:00Z');
  const round = { id: 'r1', seasonId: 'T2', rodadaNumber: 1, snapshot };
  const opts = { matches: { official: match(), pending: match({ scoreA: null, scoreB: null }), tied: match({ scoreA: 1, scoreB: 1 }), other: match({ rodada: 2 }) } };
  const first = c.processFantasyRound(round, {}, opts);
  assert.equal(first.matchesCount, 1);
  assert.equal(first.scores.human1.total, 27);
  assert.equal(first.scores.human1.breakdown[0].points, 27, '(2 + 8 + 5 + 3) × 1.5');
  assert.equal(first.scores.human1.breakdown[1].points, 10);
  assert.equal(first.scores.human1.breakdown[2].points, -3);
  assert.equal(first.scores.human1.breakdown[4].points, -4);
  assert.equal(first.scores.human1.breakdown[5].points, 0);
  players[0].name = 'Novo nome'; players[0].club = 'Outra equipe'; players[0].status = 'suspenso';
  participant.squad.captainKey = 'p1'; c.FANTASY.SCORING.win20 = 100;
  assert.equal(JSON.stringify(c.processFantasyRound(round, { human1: participant }, opts)), JSON.stringify(first));
  assert.equal(first.scores.human1.breakdown[0].name, 'Agent 0');
  assert.equal(first.scores.human1.breakdown[0].playerId, 'id0');
  assert.throws(() => c.processFantasyRound({ seasonId: 'T2' }, {}), /oficial/);
});

test('homônimos usam equipe e IDs; partidas pendentes não pontuam; inválidos ficam explícitos', () => {
  const { c, players, participant } = setup();
  players[2].name = 'Agent 0';
  const snapshot = c.buildFantasySnapshot({ human1: participant, incomplete: { ...participant, squad: {} } }, players, c.fantasySettings());
  const round = { seasonId: 'T2', rodadaNumber: 1, snapshot };
  const series = match({ fights: [{ teamA: ['Agent 0'], teamB: ['Agent 0'] }], destaqueRodada: null });
  let scores = c.processFantasyRound(round, {}, { matches: [series] }).scores;
  assert.equal(scores.human1.breakdown[0].base, 10, 'MVP homônimo sem equipe não é atribuído');
  assert.equal(scores.human1.breakdown[2].base, -3);
  assert.equal(scores.incomplete.total, 0); assert.equal(scores.incomplete.valid, false);
  series.fights = [{ teamA: [{ playerId: 'id2' }], teamB: [] }];
  scores = c.processFantasyRound(round, {}, { matches: [series] }).scores;
  assert.equal(scores.human1.breakdown[2].base, 10, 'ID explícito identifica agente mesmo em outra equipe');
  assert.equal(c.getMatchesForRound('T2', 1, [match({ status: 'pending' })]).length, 0);
});

function fakeDatabase(c, participant) {
  const state = { fantasy: { settings: c.fantasySettings(), participants: { human1: participant }, rounds: { r1: { id: 'r1', seasonId: 'T2', rodadaNumber: 1, status: 'OPEN' } }, scores: {} }, players: {}, liga: { matches: { m1: match() } } };
  const writes = []; let failPublish = false;
  const get = path => path.split('/').filter(Boolean).reduce((v, k) => v?.[k], state) ?? null;
  const put = (path, value) => { const keys = path.split('/'); const key = keys.pop(); let target = state; for (const k of keys) target = target[k] ||= {}; target[key] = structuredClone(value); };
  const snapshot = value => ({ val: () => structuredClone(value) });
  c.marketDb = c.jetDb = { ref: (path = '') => ({
    once: async () => snapshot(get(path)),
    transaction: async callback => {
      const next = callback(structuredClone(get(path)));
      if (next === undefined) return { committed: false, snapshot: snapshot(get(path)) };
      put(path, next); writes.push(path); return { committed: true, snapshot: snapshot(next) };
    },
    update: async updates => { if (failPublish) throw Error('offline'); Object.entries(updates).forEach(([key, value]) => put([path, key].filter(Boolean).join('/'), value)); writes.push(updates); }
  }) };
  return { state, writes, fail(value) { failPublish = value; } };
}

test('fechamento preserva snapshot; publicação é atômica e repetição não duplica pontos', async () => {
  const { c, participant } = setup();
  const { state, writes } = fakeDatabase(c, participant);
  const round = await c.closeFantasyRound();
  assert.equal(state.fantasy.settings.marketStatus, 'LOCKED');
  state.fantasy.participants.human1.squad.captainKey = 'p1';
  const again = await c.closeFantasyRound();
  assert.equal(JSON.stringify(again.snapshot), JSON.stringify(round.snapshot));
  const reviewed = await c.prepareFantasyRound('r1');
  await c.publishFantasyRound('r1', reviewed.result);
  assert.equal(state.fantasy.rounds.r1.status, 'PROCESSED');
  assert.equal(state.fantasy.scores.r1.human1.total, 27);
  const count = writes.length;
  assert.equal((await c.publishFantasyRound('r1', reviewed.result)).alreadyProcessed, true);
  assert.equal(writes.length, count);
  const general = c.fantasyOverallFromScores(state.fantasy.scores);
  assert.equal(general.human1.points, 27);
});

test('revisão desatualizada aborta; falha atômica libera processamento sem publicar pontos', async () => {
  const { c, participant } = setup(); const db = fakeDatabase(c, participant);
  await c.closeFantasyRound(); const reviewed = await c.prepareFantasyRound('r1');
  db.state.liga.matches.m1.scoreB = 1;
  await assert.rejects(c.publishFantasyRound('r1', reviewed.result), /mudaram/);
  assert.equal(db.state.fantasy.rounds.r1.status, 'LOCKED');
  const updated = await c.prepareFantasyRound('r1'); db.fail(true);
  await assert.rejects(c.publishFantasyRound('r1', updated.result), /offline/);
  assert.equal(db.state.fantasy.rounds.r1.status, 'LOCKED');
  assert.equal(db.state.fantasy.rounds.r1.processingToken, undefined);
  assert.deepEqual(db.state.fantasy.scores, {});
  db.fail(false); await c.publishFantasyRound('r1', updated.result);
  assert.equal(db.state.fantasy.rounds.r1.status, 'PROCESSED');
});

test('duas confirmações simultâneas publicam uma única rodada', async () => {
  const { c, participant } = setup(); const db = fakeDatabase(c, participant);
  await c.closeFantasyRound(); const reviewed = await c.prepareFantasyRound('r1');
  const results = await Promise.allSettled([c.publishFantasyRound('r1', reviewed.result), c.publishFantasyRound('r1', reviewed.result)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(db.writes.filter(v => typeof v === 'object').length, 1);
});

test('modos por série e melhor série mantêm vitória, derrota, zebra e ausência vigentes', () => {
  const { c, players, participant } = setup();
  players[0].marketValue = players[1].marketValue = 500000;
  const snapshot = c.buildFantasySnapshot({ human1: participant }, players, c.fantasySettings());
  const matches = [match({ seriesMvp: null, destaqueRodada: null }), match({ scoreB: 1, seriesMvp: null, destaqueRodada: null })];
  const opts = { playerMap: snapshot.players, teamValues: snapshot.teamValues, scoring: snapshot.scoring, zebraThreshold: .2 };
  assert.equal(c.scoreAgentInRound('p0', matches, { ...opts, scoreMode: 'perSeries' }).points, 22);
  assert.equal(c.scoreAgentInRound('p0', matches, { ...opts, scoreMode: 'perRoundOnce' }).points, 12);
  assert.equal(c.scoreAgentInRound('p2', matches, { ...opts, scoreMode: 'perSeries' }).points, -8);
  assert.equal(c.scoreAgentInRound('p2', matches, { ...opts, scoreMode: 'perRoundOnce' }).points, -3);
  assert.equal(c.scoreAgentInRound('p4', matches, opts).points, -4);
});
