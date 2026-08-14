/* Jet Transfer — Listeners do próprio banco (Transfermarkt) */

function startTransferListeners() {
  const state = window.AppState;

  // Dados de jogadores (valores de mercado, etc.)
  window.transferDb.ref("players").on("value", (snap) => {
    state.transfer.players = snap.val() || {};
    state.ui.transferConnected = true;
    document.dispatchEvent(new CustomEvent("transfer:players-updated", { detail: state.transfer.players }));
    updateConnectionStatus();
  });

  // Histórico de transferências
  window.transferDb.ref("transfers").on("value", (snap) => {
    state.transfer.transfers = snap.val() || {};
    document.dispatchEvent(new CustomEvent("transfer:transfers-updated", { detail: state.transfer.transfers }));
  });

  // Rumores
  window.transferDb.ref("rumors").on("value", (snap) => {
    state.transfer.rumors = snap.val() || {};
  });

  // Configurações
  window.transferDb.ref("settings").on("value", (snap) => {
    const settings = snap.val();
    if (settings) {
      state.transfer.settings = { ...state.transfer.settings, ...settings };
    }
  });
}

window.startTransferListeners = startTransferListeners;
