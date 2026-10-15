const test = require('node:test');
const assert = require('node:assert/strict');
const { context, load } = require('./helpers.cjs');

function setup() {
  const subscriptions = [];
  let off = 0;
  const db = { ref(path) { return {
    on(event, callback, cancel) { subscriptions.push({ path, callback, cancel }); },
    off() { off++; },
    update() { throw Error('Nenhuma escrita é permitida neste teste'); },
    set() { throw Error('Nenhuma escrita é permitida neste teste'); }
  }; } };
  const c = load(context({ marketDb: db, jetDb: db, JET_PATHS: { rosters: 'liga/rosters', teams: 'liga/teams', matches: 'liga/matches', currentSeason: 'liga/currentSeason', hallOfFame: 'liga/hallOfFame' } }), 'js/core/state.js', 'js/services/listeners.js');
  return { c, subscriptions, off: () => off };
}

test('start repetido não duplica listeners; stop remove todos', () => {
  const { c, subscriptions, off } = setup();
  c.startJetListeners(); c.startMarketListeners();
  const count = subscriptions.length;
  assert.equal(count, 11);
  c.startJetListeners(); c.startMarketListeners();
  assert.equal(subscriptions.length, count);
  c.stopDataListeners();
  assert.equal(off(), count);
  c.startJetListeners(); c.startMarketListeners();
  assert.equal(subscriptions.length, count * 2);
});

test('players vazio não executa seed nem deixa dados anteriores na tela', () => {
  const { c, subscriptions } = setup();
  c.AppState.market.players = { old: {} };
  c.startMarketListeners();
  subscriptions.find(s => s.path === 'players').callback({ val: () => null });
  assert.equal(Object.keys(c.AppState.market.players).length, 0);
  assert.equal(c.AppState.ui.marketLoaded, true);
});

test('desconexão e acesso negado ficam explícitos; retry reinscreve somente o cancelado', () => {
  const { c, subscriptions } = setup();
  c.startMarketListeners();
  const connection = subscriptions.find(s => s.path === '.info/connected');
  connection.callback({ val: () => true });
  assert.equal(c.AppState.ui.marketConnected, true);
  const players = subscriptions.find(s => s.path === 'players');
  players.cancel(Error('permission_denied'));
  // Atualizações de outra coleção não escondem a falha.
  subscriptions.find(s => s.path === 'rumors').callback({ val: () => null });
  assert.equal(c.AppState.ui.marketError, 'permission_denied');
  c.startMarketListeners();
  assert.equal(subscriptions.length, 6);
  subscriptions.at(-1).callback({ val: () => ({}) });
  assert.equal(c.AppState.ui.marketError, null);
  connection.callback({ val: () => false });
  assert.equal(c.AppState.ui.marketConnected, false);
});

test('Fantasy carrega sob demanda, não duplica e participa do desligamento global', () => {
  const { c, subscriptions, off } = setup();
  load(c, 'js/features/fantasy/fantasy-state.js', 'js/features/fantasy/fantasy-data.js');
  c.startJetListeners(); c.startMarketListeners();
  assert.equal(subscriptions.length, 11);
  c.startFantasyListeners(); c.startFantasyListeners();
  assert.equal(subscriptions.length, 16);
  c.stopDataListeners();
  assert.equal(off(), 16);
  assert.equal(c.ensureFantasyState().ui.listenersStarted, false);
  c.startFantasyListeners();
  assert.equal(subscriptions.length, 21);
});

test('Fantasy recupera somente a leitura cancelada e não esconde erros de outra coleção', () => {
  const { c, subscriptions } = setup();
  load(c, 'js/features/fantasy/fantasy-state.js', 'js/features/fantasy/fantasy-data.js');
  c.startFantasyListeners();
  subscriptions.find(s => s.path === 'fantasy/participants').cancel(Error('permission_denied'));
  assert.match(c.ensureFantasyState().ui.lastError, /Não foi possível/);
  subscriptions.find(s => s.path === 'fantasy/settings').callback({ val: () => ({}) });
  assert.match(c.ensureFantasyState().ui.lastError, /Não foi possível/);
  c.startFantasyListeners();
  assert.equal(subscriptions.length, 6);
  subscriptions.at(-1).callback({ val: () => ({ human: { displayName: 'Amigo' } }) });
  assert.equal(c.ensureFantasyState().ui.lastError, null);
  assert.equal(c.ensureFantasyState().participants.human.displayName, 'Amigo');
});

test('callbacks enfileirados de listeners desligados não sobrescrevem dados novos', () => {
  const { c, subscriptions } = setup();
  c.startMarketListeners(); const previous = subscriptions.find(s => s.path === 'players');
  c.stopDataListeners(); c.startMarketListeners();
  subscriptions.filter(s => s.path === 'players').at(-1).callback({ val: () => ({ new: {} }) });
  previous.callback({ val: () => ({ obsolete: {} }) });
  previous.cancel(Error('antigo'));
  assert.equal(c.AppState.market.players.new !== undefined, true);
  assert.equal(c.AppState.ui.marketError, null);
});
