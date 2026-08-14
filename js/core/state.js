/* Jet Market — Estado global */

window.AppState = {
  jet: {
    rosters: {},
    teams: [],
    currentSeason: "Temporada 1",
    matches: [],
    hallOfFame: {},
    lastUpdated: null
  },

  market: {
    players: {},       // dados de mercado por playerKey
    transfers: {},
    rumors: {},
    settings: {
      currency: "USD",
      currencySymbol: "US$"
    }
  },

  ui: {
    currentView: "home",
    selectedPlayer: null,
    selectedClub: null,
    loading: true,
    jetConnected: false,
    marketConnected: false
  }
};
