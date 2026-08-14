/* Jet Transfer — Firebase Service
   Inicializa os dois apps e expõe referências limpas.
   O app do Jet League é SOMENTE LEITURA.
*/

(function () {
  // App principal (Transfermarkt)
  const transferApp = firebase.initializeApp(window.TRANSFER_FIREBASE_CONFIG);
  const transferDb = firebase.database(transferApp);

  // App secundário (Jet League) — nomeado para não conflitar
  const jetApp = firebase.initializeApp(window.JET_FIREBASE_CONFIG, "jetLeague");
  const jetDb = firebase.database(jetApp);

  // Referências úteis
  window.db = transferDb;                 // atalho para o banco do Transfermarkt
  window.transferDb = transferDb;
  window.jetDb = jetDb;                   // banco do Jet League (só leitura)

  // Caminhos mais usados do Jet League
  window.JET_PATHS = {
    liga: "liga",
    rosters: "liga/rosters",
    teams: "liga/teams",
    matches: "liga/matches",
    currentSeason: "liga/currentSeason",
    seasonsArchive: "liga/seasonsArchive"
  };

  console.log("[Jet Transfer] Firebase inicializado");
  console.log("→ Transfermarkt:", transferApp.name);
  console.log("→ Jet League (read-only):", jetApp.name);
})();
