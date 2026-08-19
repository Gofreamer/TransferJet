/* Jet Cards 2.0 — estado e constantes */
window.CARDS = window.CARDS || {};

window.CARDS.DEFAULTS = {
  packSize: 3,
  rates: { common: 0.70, rare: 0.22, epic: 0.065, legend: 0.015 },
  specialChance: 0.08, // chance de virar edição especial (se houver no pool e raridade >= mínima)
  holoChance: { common: 0.02, rare: 0.08, epic: 0.25, legend: 0.55 },
  showcaseSlots: 6,
  seasonId: null,
  cycleLabel: null // ex: "CICLO III"
};

/** Tipos de pack embutidos (usados se ainda não houver cards/packTypes no Firebase) */
window.CARDS.DEFAULT_PACK_TYPES = {
  standard: {
    id: "standard",
    label: "Pack Padrão",
    packSize: 3,
    rates: { common: 0.70, rare: 0.22, epic: 0.065, legend: 0.015 },
    specialChance: 0.06
  },
  legend: {
    id: "legend",
    label: "Pack Lendário",
    packSize: 3,
    rates: { common: 0.50, rare: 0.30, epic: 0.15, legend: 0.05 },
    specialChance: 0.06
  },
  special: {
    id: "special",
    label: "Pack Caça ED",
    packSize: 3,
    rates: { common: 0.70, rare: 0.22, epic: 0.065, legend: 0.015 },
    specialChance: 0.20
  },
  mega: {
    id: "mega",
    label: "Mega Pack",
    packSize: 5,
    rates: { common: 0.60, rare: 0.25, epic: 0.12, legend: 0.03 },
    specialChance: 0.08
  }
};

window.CARDS.RARITY = {
  common: { label: "COMMON", order: 1, color: "#94a3b8" },
  rare: { label: "RARE", order: 2, color: "#3b82f6" },
  epic: { label: "EPIC", order: 3, color: "#a855f7" },
  legend: { label: "LEGEND", order: 4, color: "#fbbf24" }
};

window.CARDS.EDITIONS = {
  BASE: { label: "Base", short: "BASE" },
  MVP: { label: "MVP Edition", short: "MVP" },
  CHAMPION: { label: "Champion Edition", short: "CHAMPION" },
  ALLSTAR: { label: "All-Star Edition", short: "ALL-STAR" },
  BREAKOUT: { label: "Breakout Edition", short: "BREAKOUT" },
  RIVALRY: { label: "Rivalry Edition", short: "RIVALRY" },
  FINALS: { label: "Finals Edition", short: "FINALS" },
  ICON: { label: "Icon Edition", short: "ICON" },
  COMMEMORATIVE: { label: "Commemorative Edition", short: "COMMEMORATIVE" }
};

window.CARDS.NPC_VITRINES = [
  { id: "npc_showcase_orion", name: "Orion Stats", title: "Arquivo Analítico", avatar: "📊" },
  { id: "npc_showcase_luna", name: "Luna Underdog", title: "Coleção de Azarões", avatar: "🦓" },
  { id: "npc_showcase_stella", name: "Stella Prime", title: "Galácticos", avatar: "⭐" }
];

function ensureCardsState() {
  if (!window.AppState.cards) {
    window.AppState.cards = {
      settings: { ...window.CARDS.DEFAULTS },
      packs: {},
      inventory: {},
      codes: {},
      offers: {},
      showcases: {},
      catalog: {},
      specials: {},
      session: {
        ownerId: localStorage.getItem("cardsOwnerId") || localStorage.getItem("fantasyParticipantId") || null,
        displayName: localStorage.getItem("cardsDisplayName") || localStorage.getItem("fantasyDisplayName") || null
      },
      ui: { view: "hub" },
      active: false
    };
  }
  if (!window.AppState.cards.catalog) window.AppState.cards.catalog = {};
  if (!window.AppState.cards.specials) window.AppState.cards.specials = {};
  if (!window.AppState.cards.packTypes) window.AppState.cards.packTypes = {};
  return window.AppState.cards;
}

function cardsSettings() {
  ensureCardsState();
  return { ...window.CARDS.DEFAULTS, ...(window.AppState.cards.settings || {}) };
}

/** Mapa de tipos de pack: Firebase > defaults embutidos */
function getPackTypesMap() {
  ensureCardsState();
  const fromDb = window.AppState.cards.packTypes || {};
  if (fromDb && Object.keys(fromDb).length) return fromDb;
  return { ...(window.CARDS.DEFAULT_PACK_TYPES || {}) };
}

/** Resolve tipo de pack por id (fallback: rates globais / standard) */
function resolvePackType(packTypeId) {
  const map = getPackTypesMap();
  const id = packTypeId || "standard";
  const t = map[id] || map.standard || null;
  const s = cardsSettings();
  if (!t) {
    return {
      id: "standard",
      label: "Pack Padrão",
      packSize: s.packSize || 3,
      rates: s.rates || window.CARDS.DEFAULTS.rates,
      specialChance: s.specialChance != null ? s.specialChance : 0.06
    };
  }
  return {
    id: t.id || id,
    label: t.label || id,
    packSize: Number(t.packSize) || s.packSize || 3,
    rates: t.rates || s.rates || window.CARDS.DEFAULTS.rates,
    specialChance: t.specialChance != null ? Number(t.specialChance) : (s.specialChance != null ? s.specialChance : 0.06)
  };
}

window.getPackTypesMap = getPackTypesMap;
window.resolvePackType = resolvePackType;

function getCardsOwnerId() {
  return ensureCardsState().session.ownerId;
}

function setCardsSession(ownerId, displayName) {
  const c = ensureCardsState();
  c.session.ownerId = ownerId;
  c.session.displayName = displayName;
  if (ownerId) {
    localStorage.setItem("cardsOwnerId", ownerId);
    localStorage.setItem("cardsDisplayName", displayName || "");
  } else {
    localStorage.removeItem("cardsOwnerId");
    localStorage.removeItem("cardsDisplayName");
  }
}

function cardsPlayerPool() {
  return (typeof getAllPlayersFlat === "function" ? getAllPlayersFlat() : [])
    .filter(p => p && p.key && p.club && p.club !== "Livre");
}

function cardsCycleLabel() {
  const s = cardsSettings();
  if (s.cycleLabel) return s.cycleLabel;
  const season = s.seasonId || window.AppState?.jet?.currentSeason || "";
  const m = String(season).match(/(\d+)/);
  if (m) {
    const n = Number(m[1]);
    const roman = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
    return "CICLO " + (roman[n] || n);
  }
  return season || "CICLO —";
}

function formatCardNumber(n) {
  const num = Number(n) || 0;
  return "JL-" + String(num).padStart(3, "0");
}

function rollRarity(rates) {
  const r = rates || cardsSettings().rates || window.CARDS.DEFAULTS.rates;
  const x = Math.random();
  let acc = 0;
  for (const k of ["common", "rare", "epic", "legend"]) {
    acc += Number(r[k]) || 0;
    if (x <= acc) return k;
  }
  return "common";
}

function rollHolo(rarity) {
  const ch = cardsSettings().holoChance || window.CARDS.DEFAULTS.holoChance;
  return Math.random() < (Number(ch[rarity]) || 0);
}

function newCardId() {
  return "card_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

function newPackId() {
  return "pack_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);
}

/** Chave estável de definição (coleção) — não muda com cópias */
function catalogDefId(playerKey, edition) {
  const ed = (edition || "BASE").toUpperCase();
  if (ed === "BASE") return "base_" + playerKey;
  return "ed_" + ed + "_" + playerKey;
}

window.ensureCardsState = ensureCardsState;
window.cardsSettings = cardsSettings;
window.getCardsOwnerId = getCardsOwnerId;
window.setCardsSession = setCardsSession;
window.cardsPlayerPool = cardsPlayerPool;
window.cardsCycleLabel = cardsCycleLabel;
window.formatCardNumber = formatCardNumber;
window.rollRarity = rollRarity;
window.rollHolo = rollHolo;
window.newCardId = newCardId;
window.newPackId = newPackId;
window.catalogDefId = catalogDefId;
