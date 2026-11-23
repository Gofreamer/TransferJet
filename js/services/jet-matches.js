/* Consultas pontuais ao histórico oficial da Jet League. */
(function () {
  const unavailableIndexes = new Set();
  let historyRequest;

  function readHistory() {
    if (!historyRequest) {
      historyRequest = window.jetDb.ref(window.JET_PATHS.matches).once("value")
        .then(snapshot => snapshot.val() || {})
        .finally(() => { historyRequest = null; });
    }
    return historyRequest;
  }

  function matchSeason(match) {
    return match.temporada || window.AppState.jet.currentSeason || "Temporada ?";
  }

  function matchRound(match) {
    return Number(match.rodada) || 0;
  }

  async function readIndexed(field, values) {
    if (unavailableIndexes.has(field)) return null;
    const url = new URL(window.JET_FIREBASE_CONFIG.databaseURL);
    url.pathname = "/" + window.JET_PATHS.matches + ".json";
    url.searchParams.set("orderBy", JSON.stringify(field));
    const groups = [];
    for (const value of values) {
      url.searchParams.set("equalTo", JSON.stringify(value));
      const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000) });
      const data = await response.json();
      if (response.status === 400 && /index not defined/i.test(data?.error || "")) {
        unavailableIndexes.add(field);
        return null;
      }
      if (!response.ok) throw Error("Não foi possível consultar as partidas da Jet League.");
      groups.push(data || {});
    }
    return Object.assign({}, ...groups);
  }

  async function readRound(season, round) {
    const values = round === 0 ? [0, "0", null, ""] : [round, String(round)];
    const indexed = await readIndexed("rodada", values);
    const matches = indexed ?? await readHistory();
    return Object.fromEntries(Object.entries(matches).filter(([, match]) =>
      match && matchSeason(match) === season && matchRound(match) === round));
  }

  async function readSeason(season) {
    const values = season === window.AppState.jet.currentSeason ? [season, null, ""] : [season];
    const indexed = await readIndexed("temporada", values);
    const matches = indexed ?? await readHistory();
    return Object.values(matches).filter(match => match && matchSeason(match) === season);
  }

  window.JetMatches = { readSeason, readRound, matchRound };
})();
