/* Jet Fantasy — estado e constantes */
window.FANTASY = window.FANTASY || {};

window.FANTASY.DEFAULTS = {
  budgetInitial: 100000000,
  maxPerTeam: 2,
  starters: 5,
  bench: 1,
  zebraThreshold: 0.20,
  marketStatus: "OPEN",
  marketClosesAt: null,
  currentRoundId: null,
  seasonId: null,
  geminiEnabled: true
};

window.FANTASY.STRATEGIES = {
  analyst: { label: "Analista", desc: "Prioriza WR e volume" },
  underdog: { label: "Caçador de Zebras", desc: "Aposta em azarões" },
  conservative: { label: "Conservador", desc: "Favoritos e consistência" },
  value: { label: "Caçador de Barganhas", desc: "Custo-benefício" },
  superfan: { label: "Superfã", desc: "Preferência por uma equipe" },
  aggressive: { label: "Agressivo", desc: "Teto máximo de pontos" },
  stars: { label: "Estrelas", desc: "Maiores valores de mercado" },
  balanced: { label: "Equilibrado", desc: "Mix valor e forma" },
  form: { label: "Forma", desc: "Melhor win rate recente" },
  chaos: { label: "Caos", desc: "Escolhas ousadas e baratas" }
};

window.FANTASY.SCORING = {
  played: 2,
  win20: 8,
  win21: 6,
  loss12: -3,
  loss02: -5,
  noShow: -4,
  mvp: 5,
  highlight: 3,
  zebraWin: 2,
  zebraLoss: -2,
  captainMult: 1.5
};

function ensureFantasyState() {
  if (!window.AppState.fantasy) {
    window.AppState.fantasy = {
      settings: { ...window.FANTASY.DEFAULTS },
      participants: {},
      rounds: {},
      scores: {},
      leaderboard: { byRound: {}, overall: {} },
      session: {
        participantId: localStorage.getItem("fantasyParticipantId") || null,
        displayName: localStorage.getItem("fantasyDisplayName") || null
      },
      ui: { view: "hub", connected: false },
      active: false
    };
  }
  return window.AppState.fantasy;
}

function fantasySettings() {
  ensureFantasyState();
  return { ...window.FANTASY.DEFAULTS, ...(window.AppState.fantasy.settings || {}) };
}

function isFantasyMarketOpen() {
  const s = fantasySettings();
  if (s.marketStatus === "LOCKED") return false;
  if (s.marketClosesAt) {
    const t = new Date(s.marketClosesAt).getTime();
    if (!isNaN(t) && Date.now() >= t) return false;
  }
  return s.marketStatus === "OPEN";
}

function getFantasyParticipant(id) {
  ensureFantasyState();
  return (window.AppState.fantasy.participants || {})[id] || null;
}

function getMyFantasyParticipant() {
  const s = ensureFantasyState().session;
  if (!s.participantId) return null;
  return getFantasyParticipant(s.participantId);
}

function setFantasySession(participantId, displayName) {
  const f = ensureFantasyState();
  f.session.participantId = participantId;
  f.session.displayName = displayName;
  if (participantId) {
    localStorage.setItem("fantasyParticipantId", participantId);
    localStorage.setItem("fantasyDisplayName", displayName || "");
  } else {
    localStorage.removeItem("fantasyParticipantId");
    localStorage.removeItem("fantasyDisplayName");
  }
}

function fantasyPlayerMap() {
  const map = {};
  (typeof getAllPlayersFlat === "function" ? getAllPlayersFlat() : []).forEach(p => {
    map[p.key] = p;
  });
  return map;
}

function teamSquadValue(teamName) {
  return (typeof getAllPlayersFlat === "function" ? getAllPlayersFlat() : [])
    .filter(p => p.club === teamName)
    .reduce((s, p) => s + (p.marketValue || 0), 0);
}

function fantasyEquity(participant) {
  if (!participant) return 0;
  const map = fantasyPlayerMap();
  const keys = [...(participant.squad?.starters || []), participant.squad?.bench].filter(Boolean);
  const assets = keys.reduce((s, k) => s + (map[k]?.marketValue || 0), 0);
  return (participant.budgetRemaining || 0) + assets;
}

function emptySquad() {
  return { starters: [null, null, null, null, null], bench: null, captainKey: null };
}

window.ensureFantasyState = ensureFantasyState;
window.fantasySettings = fantasySettings;
window.isFantasyMarketOpen = isFantasyMarketOpen;
window.getFantasyParticipant = getFantasyParticipant;
window.getMyFantasyParticipant = getMyFantasyParticipant;
window.setFantasySession = setFantasySession;
window.fantasyPlayerMap = fantasyPlayerMap;
window.teamSquadValue = teamSquadValue;
window.fantasyEquity = fantasyEquity;
window.emptySquad = emptySquad;
