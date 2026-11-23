const test = require('node:test');
const assert = require('node:assert/strict');
const { context, load } = require('./helpers.cjs');

const matches = {
  modern: { id: 'm1', temporada: 'T4', rodada: 3 },
  legacy: { id: 'm2', rodada: '3' },
  old: { id: 'm3', temporada: 'T3', rodada: 3 },
  otherRound: { id: 'm4', temporada: 'T4', rodada: 4 },
  unnumbered: { id: 'm5', rodada: '' }
};

function setup(hasIndex) {
  const queries = [];
  let reads = 0;
  const c = load(context({
    AbortSignal,
    JET_FIREBASE_CONFIG: { databaseURL: 'https://example.invalid' },
    JET_PATHS: { matches: 'liga/matches' },
    jetDb: { ref(path) {
      assert.equal(path, 'liga/matches');
      return { once: async () => { reads++; return { val: () => matches }; } };
    } },
    async fetch(url) {
      const field = JSON.parse(url.searchParams.get('orderBy'));
      const value = JSON.parse(url.searchParams.get('equalTo'));
      queries.push([field, value]);
      return hasIndex ? {
        ok: true, json: async () => Object.fromEntries(Object.entries(matches).filter(([, match]) => (match[field] ?? null) === value))
      } : { ok: false, status: 400, json: async () => ({ error: 'Index not defined' }) };
    }
  }), 'js/core/state.js', 'js/services/jet-matches.js');
  c.AppState.jet.currentSeason = 'T4';
  return { c, queries, reads: () => reads };
}

test('lê somente consultas filtradas quando a liga tem índices e conserva rodadas legadas', async () => {
  const { c, queries, reads } = setup(true);
  assert.deepEqual(Object.keys(await c.JetMatches.readRound('T4', 3)).sort(), ['legacy', 'modern']);
  assert.deepEqual(Object.keys(await c.JetMatches.readRound('T4', 0)), ['unnumbered']);
  assert.equal((await c.JetMatches.readSeason('T3'))[0].id, 'm3');
  assert.deepEqual(queries.slice(0, 2), [['rodada', 3], ['rodada', '3']]);
  assert.equal(reads(), 0);
});

test('sem índice, a leitura legada acontece sob demanda e consultas simultâneas a compartilham', async () => {
  const { c, queries, reads } = setup(false);
  assert.equal(reads(), 0);
  const [current, old] = await Promise.all([c.JetMatches.readRound('T4', 3), c.JetMatches.readSeason('T3')]);
  assert.deepEqual(Object.keys(current).sort(), ['legacy', 'modern']);
  assert.equal(old.length, 1);
  assert.equal(reads(), 1);
  await c.JetMatches.readRound('T3', 3);
  assert.equal(queries.length, 2);
  assert.equal(reads(), 2);
});
