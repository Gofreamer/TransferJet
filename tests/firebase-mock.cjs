// Executado dentro do navegador. Não conecta a nenhum serviço externo.
module.exports = function firebaseMock() {
  const config = window.__testConfig || {};
  const listeners = [];
  window.__mockSubscriptions = listeners;
  window.__writes = [];
  let serial = 0;
  const rosters = { Alpha: [{ n: 'Alice', role: 'titular' }], Beta: [{ n: 'Bob', role: 'titular' }] };
  const players = {
    Alpha_Alice: { name: 'Alice', status: 'ativo', marketValue: 20000000, rank: 'Rank A', stats: { P: 10, V: 8, D: 2, winRate: 0.8 }, valueHistory: [{ season: 'T1', value: 18000000 }, { season: 'T2', value: 20000000 }] },
    Beta_Bob: { name: 'Bob', status: 'ativo', marketValue: 10000000, rank: 'Rank B' }
  };
  for (let i = 0; i < 30; i++) {
    rosters.Alpha.push({ n: `Agent ${i}`, role: 'reserva' });
    players[`Alpha_Agent ${i}`] = { name: `Agent ${i}`, marketValue: 1000000 + i * 10000, status: 'ativo', rank: 'Rank C' };
  }
  if (config.specialName) {
    rosters.Alpha.push({ n: config.specialName, role: 'titular' });
    players['Alpha_O\'Neil " & Friends'] = { name: config.specialName, team: 'Alpha', status: 'ativo', marketValue: 3000000, photo: 'https://example.invalid/" onload="window.__xss=1' };
  }
  const data = {
    market: { players: config.empty ? null : config.players || players, transfers: config.transfers || {}, rumors: config.rumors || {}, settings: { transferWindowOpen: true, ...(config.settings || {}) }, fantasy: {
      settings: { currentRoundId: 'r1', marketStatus: 'OPEN', seasonId: 'T2' },
      participants: { human1: { displayName: 'Richard', type: 'human', budgetRemaining: 5000000, squad: { starters: [], bench: null, captainKey: null } } },
      rounds: { r1: { id: 'r1', rodadaNumber: 1, status: 'OPEN' } }, scores: {}, leaderboard: { byRound: {}, overall: {} }
    } },
    jet: { liga: { rosters: config.rosters || rosters, teams: Object.keys(config.rosters || rosters), currentSeason: config.season || 'T2', matches: [], hallOfFame: {} } }
  };
  window.__mockData = data;
  function get(group, path) {
    if (path === '.info/connected') return !config.offline;
    return path.split('/').filter(Boolean).reduce((value, key) => value?.[key], data[group]) ?? null;
  }
  function snapshot(value) { return { val: () => structuredClone(value), exists: () => value != null }; }
  function emit() { listeners.forEach(({ group, path, callback }) => callback(snapshot(get(group, path)))); }
  window.__mockEmit = emit;
  function db(group) {
    return { ref(path = '') {
      return {
        on(event, callback, cancel) {
          listeners.push({ group, path, callback });
          const delay = group === 'jet' ? config.jetDelay || 30 : config.marketDelay || 5;
          setTimeout(() => {
            if (config.offline && path !== '.info/connected') return;
            if (group === 'market' && (config.denied && path === 'players' || config.fantasyDenied && path === 'fantasy/participants')) {
              const index = listeners.findIndex(item => item.callback === callback);
              if (index >= 0) listeners.splice(index, 1);
              return cancel?.(Error('permission_denied'));
            }
            callback(snapshot(get(group, path)));
          }, delay);
        },
        off(event, callback) {
          const i = listeners.findIndex(l => l.callback === callback);
          if (i >= 0) listeners.splice(i, 1);
        },
        once: async () => snapshot(get(group, path)),
        push: () => ({ key: 'mock-transfer-' + (++serial) }),
        async transaction(callback) {
          const next = callback(structuredClone(get(group, path)));
          if (next === undefined) return { committed: false, snapshot: snapshot(get(group, path)) };
          window.__writes.push({ group, path, transaction: next });
          const segments = path.split('/');
          const leaf = segments.pop();
          let target = data[group];
          for (const segment of segments) target = target[segment] ||= {};
          target[leaf] = structuredClone(next);
          emit();
          return { committed: true, snapshot: snapshot(next) };
        },
        async update(updates) {
          window.__writes.push({ group, path, updates });
          for (const [key, value] of Object.entries(updates)) {
            const segments = [path, key].filter(Boolean).join('/').split('/');
            const leaf = segments.pop();
            let target = data[group];
            for (const segment of segments) target = target[segment] ||= {};
            if (value === null) delete target[leaf];
            else target[leaf] = structuredClone(value);
          }
          emit();
        },
        set() { throw Error('Escrita inesperada no teste: ' + path); },
        remove() { throw Error('Exclusão inesperada no teste: ' + path); }
      };
    } };
  }
  window.firebase = {
    apps: [],
    initializeApp(config, name = '[DEFAULT]') { const app = { name }; this.apps.push(app); return app; },
    database: app => db(app.name === 'jetLeague' ? 'jet' : 'market'),
    auth: () => ({ onAuthStateChanged(callback) { window.__mockAuthChange = callback; callback(config.admin ? { uid: 'admin-fixture', email: 'admin@example.invalid' } : null); } })
  };
};
