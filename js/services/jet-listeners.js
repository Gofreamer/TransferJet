/* Jet Transfer — Listeners do Jet League (SOMENTE LEITURA)
   Escuta mudanças em tempo real nos dados da liga.
*/

function startJetListeners() {
  const state = window.AppState;

  // 1. Elencos (rosters)
  window.jetDb.ref(window.JET_PATHS.rosters).on("value", (snap) => {
    state.jet.rosters = snap.val() || {};
    state.jet.lastUpdated = Date.now();
    state.ui.jetConnected = true;

    console.log("[Jet League] Rosters atualizados:", Object.keys(state.jet.rosters).length, "times");
    document.dispatchEvent(new CustomEvent("jet:rosters-updated", { detail: state.jet.rosters }));
    updateConnectionStatus();
  }, (err) => {
    console.error("[Jet League] Erro ao ouvir rosters:", err);
  });

  // 2. Times
  window.jetDb.ref(window.JET_PATHS.teams).on("value", (snap) => {
    state.jet.teams = snap.val() || [];
    document.dispatchEvent(new CustomEvent("jet:teams-updated", { detail: state.jet.teams }));
  });

  // 3. Temporada atual
  window.jetDb.ref(window.JET_PATHS.currentSeason).on("value", (snap) => {
    state.jet.currentSeason = snap.val() || "Temporada ?";
    document.dispatchEvent(new CustomEvent("jet:season-updated", { detail: state.jet.currentSeason }));
  });

  // 4. Partidas (opcional — útil para estatísticas futuras)
  window.jetDb.ref(window.JET_PATHS.matches).on("value", (snap) => {
    state.jet.matches = snap.val() || [];
  });
}

function updateConnectionStatus() {
  const el = document.getElementById("connectionStatus");
  if (!el) return;

  const jetOk = window.AppState.ui.jetConnected;
  const transferOk = window.AppState.ui.transferConnected;

  if (jetOk && transferOk) {
    el.innerHTML = `<span class="status-dot online"></span> Conectado · Jet League + Transfermarkt`;
    el.className = "connection-status online";
  } else if (jetOk) {
    el.innerHTML = `<span class="status-dot partial"></span> Jet League online · Transfermarkt conectando...`;
    el.className = "connection-status partial";
  } else {
    el.innerHTML = `<span class="status-dot offline"></span> Conectando...`;
    el.className = "connection-status offline";
  }
}

// Expõe globalmente
window.startJetListeners = startJetListeners;
window.updateConnectionStatus = updateConnectionStatus;
