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

  // Inventário só do jogador logado (economiza download no free tier)
  window._jcInvOwnerBound = null;
  window._jcInvRef = null;
  const bindOwnInventory = () => {
    const ownerId = typeof getCardsOwnerId === "function" ? getCardsOwnerId() : null;
    if (ownerId === window._jcInvOwnerBound) return;
    if (window._jcInvRef) {
      try { window._jcInvRef.off(); } catch (_) {}
      window._jcInvRef = null;
    }
    window._jcInvOwnerBound = ownerId;
    if (!ownerId) return;
    window._jcInvRef = window.marketDb.ref("cards/inventory/" + ownerId);
    window._jcInvRef.on("value", snap => {
      const all = ensureCardsState().inventory || {};
      all[ownerId] = snap.val() || {};
      ensureCardsState().inventory = all;
      refresh();
    });
  };
  bindOwnInventory();
  window.cardsRebindInventoryListener = bindOwnInventory;

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

/** Carrega inventário de outro jogador uma vez (ex.: hall). Não escuta em tempo real. */
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
      // re-render leve se estiver no hall
      if ((window.AppState.cards.ui || {}).view === "showcase") renderCardsShell();
    }
    return all[ownerId];
  }).catch(() => {
    delete window._jcInvFetching[ownerId];
    return null;
  });
  return window._jcInvFetching[ownerId];
}

window.startCardsListeners = startCardsListeners;
window.ensureCardsSeeded = ensureCardsSeeded;
window.saveCardsSettings = saveCardsSettings;
window.syncCardsCatalog = syncCardsCatalog;
window.cardsFetchInventoryOnce = cardsFetchInventoryOnce;
