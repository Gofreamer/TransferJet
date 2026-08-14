/* Jet Market — Listeners (Jet League + Market) */

function startJetListeners() {
  const state = window.AppState;

  window.jetDb.ref(window.JET_PATHS.rosters).on("value", (snap) => {
    state.jet.rosters = snap.val() || {};
    state.jet.lastUpdated = Date.now();
    state.ui.jetConnected = true;
    document.dispatchEvent(new CustomEvent("jet:updated"));
    updateConnectionStatus();
  });

  window.jetDb.ref(window.JET_PATHS.teams).on("value", (snap) => {
    state.jet.teams = snap.val() || [];
    document.dispatchEvent(new CustomEvent("jet:updated"));
  });

  window.jetDb.ref(window.JET_PATHS.currentSeason).on("value", (snap) => {
    state.jet.currentSeason = snap.val() || "Temporada 1";
    document.dispatchEvent(new CustomEvent("jet:updated"));
  });

  window.jetDb.ref(window.JET_PATHS.matches).on("value", (snap) => {
    state.jet.matches = snap.val() || [];
  });

  window.jetDb.ref(window.JET_PATHS.hallOfFame).on("value", (snap) => {
    state.jet.hallOfFame = snap.val() || {};
  });
}

function startMarketListeners() {
  const state = window.AppState;

  window.marketDb.ref("players").on("value", (snap) => {
    const data = snap.val();
    if (!data || Object.keys(data).length === 0) {
      // Se estiver vazio, faz seed automático dos valores fictícios
      seedMarketData();
      return;
    }
    state.market.players = data;
    state.ui.marketConnected = true;
    document.dispatchEvent(new CustomEvent("market:updated"));
    updateConnectionStatus();
  });

  window.marketDb.ref("transfers").on("value", (snap) => {
    state.market.transfers = snap.val() || {};
    document.dispatchEvent(new CustomEvent("market:updated"));
  });

  window.marketDb.ref("rumors").on("value", (snap) => {
    state.market.rumors = snap.val() || {};
    document.dispatchEvent(new CustomEvent("market:updated"));
  });

  window.marketDb.ref("settings").on("value", (snap) => {
    const s = snap.val();
    if (s) state.market.settings = { ...state.market.settings, ...s };
  });
}

function seedMarketData() {
  console.log("[Jet Market] Banco vazio → aplicando seed de valores fictícios...");
  const updates = {
    players: window.SEED_MARKET_PLAYERS,
    transfers: window.SEED_TRANSFERS,
    rumors: window.SEED_RUMORS,
    settings: {
      currency: "USD",
      currencySymbol: "US$",
      seededAt: Date.now()
    }
  };
  window.marketDb.ref().update(updates).then(() => {
    console.log("[Jet Market] Seed aplicado com sucesso");
  }).catch(err => {
    console.error("[Jet Market] Erro ao aplicar seed:", err);
    // Fallback local para visualização mesmo sem escrita
    window.AppState.market.players = window.SEED_MARKET_PLAYERS;
    window.AppState.market.transfers = window.SEED_TRANSFERS;
    window.AppState.market.rumors = window.SEED_RUMORS;
    window.AppState.ui.marketConnected = true;
    document.dispatchEvent(new CustomEvent("market:updated"));
    updateConnectionStatus();
  });
}

function updateConnectionStatus() {
  const el = document.getElementById("connectionStatus");
  if (!el) return;

  const jetOk = window.AppState.ui.jetConnected;
  const marketOk = window.AppState.ui.marketConnected;

  if (jetOk && marketOk) {
    el.innerHTML = `<span class="status-dot online"></span> Jet League + Market online`;
    el.className = "connection-status online";
  } else if (jetOk) {
    el.innerHTML = `<span class="status-dot partial"></span> Jet League online · Market conectando...`;
    el.className = "connection-status partial";
  } else {
    el.innerHTML = `<span class="status-dot offline"></span> Conectando...`;
    el.className = "connection-status offline";
  }
}

window.startJetListeners = startJetListeners;
window.startMarketListeners = startMarketListeners;
window.updateConnectionStatus = updateConnectionStatus;
