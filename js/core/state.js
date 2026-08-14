/* Jet Transfer — Estado global da aplicação */

window.AppState = {
  // Dados vindos do Jet League (somente leitura)
  jet: {
    rosters: {},          // { "Asgard": [ {n, role}, ... ], ... }
    teams: [],            // lista de times
    currentSeason: null,
    matches: [],
    lastUpdated: null
  },

  // Dados próprios do Transfermarkt
  transfer: {
    players: {},          // dados enriquecidos (valor de mercado, etc.)
    transfers: {},        // histórico de transferências
    rumors: {},
    settings: {
      currency: "JC",     // Jet Credits
      currencySymbol: "JC"
    }
  },

  // UI
  ui: {
    currentView: "home",
    loading: true,
    jetConnected: false,
    transferConnected: false
  }
};
