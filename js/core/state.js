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
  },

  fantasy: {
    settings: {},
    participants: {},
    rounds: {},
    scores: {},
    leaderboard: { byRound: {}, overall: {} },
    session: { participantId: null, displayName: null },
    ui: { view: "hub", connected: false },
    active: false
  },

  cards: {
    settings: {},
    packs: {},
    inventory: {},
    codes: {},
    offers: {},
    showcases: {},
    catalog: {},
    specials: {},
    session: { ownerId: null, displayName: null },
    ui: { view: "hub" },
    active: false
  }
};
