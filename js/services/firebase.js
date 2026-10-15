/* Jet Market — Firebase Service */

(function () {
  const marketApp = firebase.initializeApp(window.MARKET_FIREBASE_CONFIG);
  const marketDb  = firebase.database(marketApp);

  const jetApp = firebase.initializeApp(window.JET_FIREBASE_CONFIG, "jetLeague");
  const jetDb  = firebase.database(jetApp);

  window.db       = marketDb;   // atalho principal
  window.marketDb = marketDb;
  window.jetDb    = jetDb;

  window.JET_PATHS = {
    liga: "liga",
    rosters: "liga/rosters",
    teams: "liga/teams",
    matches: "liga/matches",
    currentSeason: "liga/currentSeason",
    seasonsArchive: "liga/seasonsArchive",
    hallOfFame: "liga/hallOfFame"
  };

  console.log("[Jet Market] Firebase dual inicializado");
})();
