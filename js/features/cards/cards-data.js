/* Jet Cards 2.0 — Firebase (listeners enxutos por dono) */
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

  window.marketDb.ref("cards/packTypes").on("value", snap => {
    ensureCardsState().packTypes = snap.val() || {};
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

  // Inventário e packs: só do jogador logado (re-bind no login)
  cardsRebindOwnerListeners();
}

/** Cancela listeners anteriores e escuta só inventory/packs do owner atual */
function cardsRebindOwnerListeners() {
  if (!window.marketDb) return;

  if (window._jcInvRef && window._jcInvHandler) {
    window._jcInvRef.off("value", window._jcInvHandler);
  }
  if (window._jcPacksRef && window._jcPacksHandler) {
    window._jcPacksRef.off("value", window._jcPacksHandler);
  }

  const ownerId = typeof getCardsOwnerId === "function" ? getCardsOwnerId() : null;
  const refresh = () => {
    document.dispatchEvent(new CustomEvent("cards:updated"));
    if (window.AppState.cards.active && typeof renderCardsShell === "function") renderCardsShell();
  };

  if (!ownerId) {
    ensureCardsState().packs = ensureCardsState().packs || {};
    return;
  }

  window._jcInvRef = window.marketDb.ref("cards/inventory/" + ownerId);
  window._jcInvHandler = snap => {
    const all = ensureCardsState().inventory || {};
    all[ownerId] = snap.val() || {};
    ensureCardsState().inventory = all;
    refresh();
  };
  window._jcInvRef.on("value", window._jcInvHandler);

  try {
    window._jcPacksRef = window.marketDb.ref("cards/packs").orderByChild("ownerId").equalTo(ownerId);
  } catch (e) {
    window._jcPacksRef = window.marketDb.ref("cards/packs");
  }
  window._jcPacksHandler = snap => {
    const raw = snap.val() || {};
    const filtered = {};
    Object.entries(raw).forEach(([id, p]) => {
      if (p && p.ownerId === ownerId) filtered[id] = p;
    });
    ensureCardsState().packs = filtered;
    refresh();
  };
  window._jcPacksRef.on("value", window._jcPacksHandler);
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

async function syncCardsCatalog() {
  const snap = await window.marketDb.ref("cards/catalog").once("value");
  const updates = buildBaseCatalogEntries(snap.val() || {});
  if (Object.keys(updates).length) {
    await window.marketDb.ref("cards/catalog").update(updates);
  }
  return Object.keys(updates).length;
}

async function cardsFetchInventoryOnce(ownerId) {
  if (!ownerId || !window.marketDb) return null;
  if ((window.AppState.cards?.inventory || {})[ownerId]) return window.AppState.cards.inventory[ownerId];
  if (!window._jcInvFetching) window._jcInvFetching = {};
  if (window._jcInvFetching[ownerId]) return window._jcInvFetching[ownerId];
  window._jcInvFetching[ownerId] = window.marketDb.ref("cards/inventory/" + ownerId).once("value").then(snap => {
    const all = ensureCardsState().inventory || {};
    all[ownerId] = snap.val() || {};
    ensureCardsState().inventory = all;
    delete window._jcInvFetching[ownerId];
    if (window.AppState.cards.active && typeof renderCardsShell === "function") {
      const view = (window.AppState.cards.ui || {}).view;
      if (view === "showcase" || view === "hub") renderCardsShell();
    }
    return all[ownerId];
  }).catch(() => {
    delete window._jcInvFetching[ownerId];
    return null;
  });
  return window._jcInvFetching[ownerId];
}

/** Remove packs já abertos do Firebase (cartas no inventário não são tocadas) */
async function cardsPurgeOpenedPacks() {
  if (!window.marketDb) return 0;
  const snap = await window.marketDb.ref("cards/packs").once("value");
  const packs = snap.val() || {};
  const updates = {};
  let n = 0;
  Object.entries(packs).forEach(([id, p]) => {
    if (p && p.status === "opened") {
      updates["cards/packs/" + id] = null;
      n++;
    }
  });
  if (n) await window.marketDb.ref().update(updates);
  return n;
}

window.startCardsListeners = startCardsListeners;
window.cardsRebindOwnerListeners = cardsRebindOwnerListeners;
window.ensureCardsSeeded = ensureCardsSeeded;
window.saveCardsSettings = saveCardsSettings;
window.syncCardsCatalog = syncCardsCatalog;
window.cardsFetchInventoryOnce = cardsFetchInventoryOnce;
window.cardsPurgeOpenedPacks = cardsPurgeOpenedPacks;
