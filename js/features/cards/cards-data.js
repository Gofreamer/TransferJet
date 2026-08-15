/* Jet Cards 2.0 — Firebase (listeners enxutos) */
window.CARDS = window.CARDS || {};

function startCardsListeners() {
  ensureCardsState();
  if (!window.marketDb) return;

  const refresh = () => {
    document.dispatchEvent(new CustomEvent("cards:updated"));
    if (window.AppState.cards.active && typeof renderCardsShell === "function") renderCardsShell();
  };

  window.marketDb.ref("cards/settings").on("value", snap => {
    ensureCardsState().settings = { ...window.CARDS.DEFAULTS, ...(snap.val() || {}) };
    refresh();
  });

  window.marketDb.ref("cards/catalog").on("value", snap => {
    ensureCardsState().catalog = snap.val() || {};
    refresh();
  });

  window.marketDb.ref("cards/specials").on("value", snap => {
    ensureCardsState().specials = snap.val() || {};
    refresh();
  });

  window.marketDb.ref("cards/packs").on("value", snap => {
    ensureCardsState().packs = snap.val() || {};
    refresh();
  });

  window.marketDb.ref("cards/inventory").on("value", snap => {
    ensureCardsState().inventory = snap.val() || {};
    refresh();
  });

  window.marketDb.ref("cards/codes").on("value", snap => {
    ensureCardsState().codes = snap.val() || {};
  });

  window.marketDb.ref("cards/offers").on("value", snap => {
    ensureCardsState().offers = snap.val() || {};
    refresh();
  });

  window.marketDb.ref("cards/showcases").on("value", snap => {
    ensureCardsState().showcases = snap.val() || {};
    refresh();
  });
}

async function ensureCardsSeeded() {
  const snap = await window.marketDb.ref("cards/settings").once("value");
  const season = window.AppState.jet.currentSeason || "Temporada 1";
  if (!snap.exists() || !snap.val()) {
    await window.marketDb.ref("cards/settings").set({
      ...window.CARDS.DEFAULTS,
      seasonId: season,
      cycleLabel: cardsCycleLabel(),
      seededAt: Date.now()
    });
  }
  const catSnap = await window.marketDb.ref("cards/catalog").once("value");
  const existing = catSnap.val() || {};
  const updates = buildBaseCatalogEntries(existing);
  if (Object.keys(updates).length) {
    await window.marketDb.ref("cards/catalog").update(updates);
  }
  const scSnap = await window.marketDb.ref("cards/showcases").once("value");
  if (!scSnap.exists()) {
    const showcases = {};
    (window.CARDS.NPC_VITRINES || []).forEach(n => {
      showcases[n.id] = { type: "npc", name: n.name, title: n.title, avatar: n.avatar, slots: [] };
    });
    await window.marketDb.ref("cards/showcases").update(showcases);
  }
  return true;
}

function saveCardsSettings(partial) {
  return window.marketDb.ref("cards/settings").update(partial);
}

/** Sincroniza catálogo BASE com agentes atuais (só adiciona novos) */
async function syncCardsCatalog() {
  const snap = await window.marketDb.ref("cards/catalog").once("value");
  const updates = buildBaseCatalogEntries(snap.val() || {});
  if (Object.keys(updates).length) {
    await window.marketDb.ref("cards/catalog").update(updates);
  }
  return Object.keys(updates).length;
}

window.startCardsListeners = startCardsListeners;
window.ensureCardsSeeded = ensureCardsSeeded;
window.saveCardsSettings = saveCardsSettings;
window.syncCardsCatalog = syncCardsCatalog;
