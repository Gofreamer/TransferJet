/* Jet Fantasy — Firebase read/write */
window.FANTASY = window.FANTASY || {};

function startFantasyListeners() {
  const f = ensureFantasyState();
  if (!window.marketDb || !window.DataListeners) return;
  f.ui.listenersStarted = true;
  const defaults = { settings: {}, participants: {}, rounds: {}, scores: {}, leaderboard: { byRound: {}, overall: {} } };
  Object.keys(defaults).forEach(field => {
    DataListeners.listen("fantasy", window.marketDb, "fantasy/" + field, value => {
      const f = ensureFantasyState();
      if (field === "settings") f.settings = { ...FANTASY.DEFAULTS, ...(value || {}) };
      else if (field === "participants") f.participants = Object.fromEntries(Object.entries(value || {}).map(([id, p]) => [id, normalizeFantasyParticipant(p, id)]));
      else f[field] = value || defaults[field];
      f.ui[field + "Loaded"] = true;
      f.ui.connected = !window.AppState.ui.fantasyError;
      f.ui.lastError = window.AppState.ui.fantasyError ? "Não foi possível carregar parte dos dados do Fantasy." : null;
      document.dispatchEvent(new CustomEvent("fantasy:updated"));
    }, () => {
      f.ui[field + "Loaded"] = true;
      f.ui.connected = false;
      f.ui.lastError = "Não foi possível carregar parte dos dados do Fantasy.";
    });
  });
}

function stopFantasyListeners() {
  window.DataListeners?.stopGroup("fantasy");
  const f = ensureFantasyState();
  f.ui.listenersStarted = false;
  f.ui.connected = false;
}

function saveFantasySettings(partial) {
  return window.marketDb.ref("fantasy/settings").update(partial);
}

function saveFantasyParticipant(id, data) {
  return window.marketDb.ref("fantasy/participants/" + id).set(data);
}

function updateFantasyParticipant(id, partial) {
  return window.marketDb.ref("fantasy/participants/" + id).update(partial);
}

async function mutateFantasySquad(id, operation) {
  const f = ensureFantasyState();
  if (!id || id !== f.session.participantId) throw new Error("Entre no seu participante.");
  const settings = (await window.marketDb.ref("fantasy/settings").once("value")).val();
  f.settings = { ...window.FANTASY.DEFAULTS, ...(settings || {}) };
  if (!isFantasyMarketOpen()) throw new Error("Mercado fechado");
  let failure = "Participante não encontrado";
  const result = await window.marketDb.ref("fantasy/participants/" + id).transaction(raw => {
    if (!raw || !isFantasyMarketOpen()) { failure = "Mercado fechado ou participante indisponível"; return; }
    const change = operation(normalizeFantasyParticipant(raw, id));
    if (!change.ok) { failure = change.error; return; }
    const { ok, replaced, ...fields } = change;
    return { ...raw, ...fields };
  });
  if (!result.committed) throw new Error(failure);
  f.participants[id] = normalizeFantasyParticipant(result.snapshot.val(), id);
  return f.participants[id];
}

async function ensureFantasySeeded() {
  const snap = await window.marketDb.ref("fantasy/settings").once("value");
  if (snap.exists() && snap.val()) return false;

  const season = window.AppState.jet.currentSeason || "Temporada 1";
  const settings = {
    ...window.FANTASY.DEFAULTS,
    seasonId: season,
    currentRoundId: "r1",
    marketStatus: "OPEN",
    scoreMode: window.FANTASY.DEFAULTS.scoreMode || "perSeries",
    priceScale: window.FANTASY.DEFAULTS.priceScale || 0.10,
    budgetInitial: window.FANTASY.DEFAULTS.budgetInitial || 5000000,
    seededAt: Date.now()
  };

  const participants = {};
  (window.FANTASY.NPC_SEED || []).forEach(seed => {
    participants[seed.id] = createNpcParticipant(seed);
  });

  await window.marketDb.ref("fantasy").update({
    settings,
    participants,
    rounds: {
      r1: {
        id: "r1",
        name: "Rodada 1",
        seasonId: season,
        rodadaNumber: 1,
        status: "OPEN",
        locksAt: null,
        processedAt: null,
        jetMatchIds: [],
        analysisCache: null
      }
    },
    scores: {},
    leaderboard: { byRound: {}, overall: {} }
  });
  return true;
}

function findParticipantByInvite(codeOrName) {
  const q = String(codeOrName || "").trim().toLowerCase();
  if (!q) return null;
  const parts = window.AppState.fantasy?.participants || {};
  for (const [id, p] of Object.entries(parts)) {
    if (!p || p.type === "npc") continue;
    if (p.inviteCode && String(p.inviteCode).toLowerCase() === q) return { id, ...p };
    if (p.displayName && p.displayName.toLowerCase() === q) return { id, ...p };
  }
  return null;
}

window.startFantasyListeners = startFantasyListeners;
window.saveFantasySettings = saveFantasySettings;
window.saveFantasyParticipant = saveFantasyParticipant;
window.updateFantasyParticipant = updateFantasyParticipant;
window.ensureFantasySeeded = ensureFantasySeeded;
window.findParticipantByInvite = findParticipantByInvite;
