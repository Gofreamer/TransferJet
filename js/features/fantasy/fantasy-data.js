/* Jet Fantasy — Firebase read/write */
window.FANTASY = window.FANTASY || {};

function startFantasyListeners() {
  const f = ensureFantasyState();
  if (!window.marketDb) return;
  if (f.ui.listenersStarted) return;
  f.ui.listenersStarted = true;

  window.marketDb.ref("fantasy/settings").on("value", snap => {
    const f = ensureFantasyState();
    f.settings = { ...window.FANTASY.DEFAULTS, ...(snap.val() || {}) };
    f.ui.connected = true;
    document.dispatchEvent(new CustomEvent("fantasy:updated"));
    if (f.active && typeof renderFantasyShell === "function") renderFantasyShell();
  });

  window.marketDb.ref("fantasy/participants").on("value", snap => {
    const f = ensureFantasyState();
    const raw = snap.val() || {};
    const normalized = {};
    Object.entries(raw).forEach(([id, participant]) => {
      normalized[id] = typeof normalizeFantasyParticipant === "function"
        ? normalizeFantasyParticipant(participant, id)
        : participant;
    });
    f.participants = normalized;
    f.ui.participantsLoaded = true;
    document.dispatchEvent(new CustomEvent("fantasy:updated"));
    if (f.active && typeof renderFantasyShell === "function") renderFantasyShell();
  }, error => {
    const f = ensureFantasyState();
    f.ui.participantsLoaded = true;
    f.ui.lastError = "Não foi possível carregar os participantes do Fantasy.";
    console.error("[Jet Fantasy] participants listener", error);
    if (f.active && typeof renderFantasyShell === "function") renderFantasyShell();
  });

  window.marketDb.ref("fantasy/rounds").on("value", snap => {
    ensureFantasyState().rounds = snap.val() || {};
    document.dispatchEvent(new CustomEvent("fantasy:updated"));
  });

  window.marketDb.ref("fantasy/scores").on("value", snap => {
    ensureFantasyState().scores = snap.val() || {};
    document.dispatchEvent(new CustomEvent("fantasy:updated"));
  });

  window.marketDb.ref("fantasy/leaderboard").on("value", snap => {
    ensureFantasyState().leaderboard = snap.val() || { byRound: {}, overall: {} };
    document.dispatchEvent(new CustomEvent("fantasy:updated"));
  });
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
