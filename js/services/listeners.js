/* Leituras idempotentes. Abrir o site nunca inicializa nem sobrescreve o banco. */
(function () {
  const subscriptions = new Map();
  const errors = new Map();

  function listen(group, db, path, receive, onError) {
    const key = `${group}:${path}`;
    if (subscriptions.has(key)) return;
    const ref = db.ref(path);
    const callback = snap => {
      if (subscriptions.get(key)?.callback !== callback) return;
      errors.delete(key);
      window.AppState.ui[`${group}Error`] = [...errors].find(([k]) => k.startsWith(group + ":"))?.[1] || null;
      receive(snap.val());
      updateConnectionStatus();
    };
    subscriptions.set(key, { ref, callback });
    ref.on("value", callback, error => {
      if (subscriptions.get(key)?.callback !== callback) return;
      errors.set(key, error.message || "Falha ao carregar dados");
      window.AppState.ui[`${group}Error`] = errors.get(key);
      // O Firebase remove listeners cancelados; permite uma nova tentativa explícita.
      subscriptions.delete(key);
      onError?.(error);
      updateConnectionStatus();
      document.dispatchEvent(new CustomEvent(`${group}:updated`));
    });
  }

  function connection(group, db) {
    listen(group, db, ".info/connected", value => {
      window.AppState.ui[`${group}Connected`] = value === true;
    });
  }

  window.startJetListeners = function () {
    const state = window.AppState;
    connection("jet", window.jetDb);
    for (const field of ["rosters", "teams", "currentSeason", "matches", "hallOfFame"]) {
      listen("jet", window.jetDb, window.JET_PATHS[field], value => {
        state.jet[field] = value || (field === "currentSeason" ? "Temporada 1" : field === "teams" || field === "matches" ? [] : {});
        if (field === "rosters") state.ui.jetLoaded = true;
        state.jet.lastUpdated = Date.now();
        document.dispatchEvent(new CustomEvent("jet:updated"));
      });
    }
  };

  function stopGroup(group) {
    subscriptions.forEach(({ ref, callback }, key) => {
      if (key.startsWith(group + ":")) {
        ref.off("value", callback);
        subscriptions.delete(key);
      }
    });
    for (const key of errors.keys()) if (key.startsWith(group + ":")) errors.delete(key);
    window.AppState.ui[`${group}Error`] = null;
  }

  window.DataListeners = { listen, stopGroup };

  window.startMarketListeners = function () {
    const state = window.AppState;
    connection("market", window.marketDb);
    for (const field of ["players", "transfers", "rumors", "settings"]) {
      listen("market", window.marketDb, field, value => {
        state.market[field] = field === "settings"
          ? { currency: "USD", currencySymbol: "US$", transferWindowOpen: false, jetLeagueUrl: "https://teste-jet.pages.dev", ...(value || {}) }
          : value || {};
        if (field === "players") state.ui.marketLoaded = true;
        document.dispatchEvent(new CustomEvent("market:updated"));
      });
    }
  };

  window.stopDataListeners = function () {
    subscriptions.forEach(({ ref, callback }) => ref.off("value", callback));
    subscriptions.clear();
    errors.clear();
    window.AppState.ui.jetError = null;
    window.AppState.ui.marketError = null;
    window.AppState.ui.jetConnected = false;
    window.AppState.ui.marketConnected = false;
    window.stopFantasyListeners?.();
    updateConnectionStatus();
  };
})();

function updateConnectionStatus() {
  const el = document.getElementById("connectionStatus");
  if (!el) return;
  const ui = window.AppState.ui;
  const jetOk = ui.jetConnected && !ui.jetError;
  const marketOk = ui.marketConnected && !ui.marketError;
  const status = jetOk && marketOk ? "online" : jetOk || marketOk ? "partial" : "offline";
  el.innerHTML = `<span class="status-dot ${status}"></span> ${status === "online" ? "Online" : status === "partial" ? "Parcial" : "Offline"}`;
  el.className = `connection-status ${status}`;
  el.title = ui.jetError || ui.marketError || (status === "online" ? "Jet League + Market conectados" : "Aguardando conexão com Jet League e Market");
  document.dispatchEvent(new CustomEvent("connection:updated"));
}

window.updateConnectionStatus = updateConnectionStatus;
