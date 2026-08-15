/* Jet Fantasy — estado e constantes */
window.FANTASY = window.FANTASY || {};

window.FANTASY.DEFAULTS = {
  budgetInitial: 5000000,
  priceScale: 0.10,
  minFantasyPrice: 50000,
  scoreMode: "perSeries", // perSeries | perRoundOnce
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


function normalizeFantasySquad(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  let starters = src.starters;

  if (Array.isArray(starters)) {
    starters = starters.slice(0, 5);
  } else if (starters && typeof starters === "object") {
    starters = [0,1,2,3,4].map(i => starters[i] ?? starters[String(i)] ?? null);
  } else {
    starters = [];
  }

  while (starters.length < 5) starters.push(null);
  starters = starters.slice(0, 5).map(v => (typeof v === "string" && v.trim()) ? v : null);

  const bench = (typeof src.bench === "string" && src.bench.trim()) ? src.bench : null;
  let captainKey = (typeof src.captainKey === "string" && src.captainKey.trim()) ? src.captainKey : null;
  if (captainKey && !starters.includes(captainKey)) captainKey = null;

  return { starters, bench, captainKey };
}

function normalizeFantasyParticipant(raw, id = null) {
  const p = raw && typeof raw === "object" ? { ...raw } : {};
  p.id = p.id || id || null;
  p.squad = normalizeFantasySquad(p.squad);
  if (!Number.isFinite(Number(p.budgetRemaining))) {
    p.budgetRemaining = Number(fantasySettings().budgetInitial || 5000000);
  } else {
    p.budgetRemaining = Number(p.budgetRemaining);
  }
  p.acquisitions = p.acquisitions && typeof p.acquisitions === "object" ? p.acquisitions : {};
  return p;
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
  const raw = (window.AppState.fantasy.participants || {})[id];
  return raw ? normalizeFantasyParticipant(raw, id) : null;
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
  const squad = normalizeFantasySquad(participant.squad);
  const keys = [...squad.starters, squad.bench].filter(Boolean);
  const assets = keys.reduce((s, k) => {
    if (typeof playerPrice === "function") return s + Number(playerPrice(k) || 0);
    const mv = Number(map[k]?.marketValue || 0);
    const scale = Number(fantasySettings().priceScale ?? 0.10);
    const min = Number(fantasySettings().minFantasyPrice ?? 50000);
    return s + Math.max(min, Math.round((mv * scale) / 10000) * 10000);
  }, 0);
  return Number(participant.budgetRemaining || 0) + assets;
}

function emptySquad() {
  return normalizeFantasySquad(null);
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

window.normalizeFantasySquad = normalizeFantasySquad;
window.normalizeFantasyParticipant = normalizeFantasyParticipant;
