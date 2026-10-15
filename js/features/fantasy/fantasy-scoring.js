/* Jet Fantasy — pontuação determinística (autoridade única) */
window.FANTASY = window.FANTASY || {};

function normalizeNameFX(n) {
  return String(n || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function getMatchesForRound(season, roundNumber, source = window.AppState.jet.matches || []) {
  const list = Object.entries(source).map(([id, match]) => match ? { ...match, id: match.id || id } : null);
  return list.filter(m => {
    if (!m) return false;
    const s = m.temporada || window.AppState.jet.currentSeason;
    const r = Number(m.rodada) || 0;
    const validScore = m.scoreA !== null && m.scoreB !== null && m.scoreA !== "" && m.scoreB !== ""
      && Number.isFinite(Number(m.scoreA)) && Number.isFinite(Number(m.scoreB))
      && Number(m.scoreA) >= 0 && Number(m.scoreB) >= 0 && Number(m.scoreA) !== Number(m.scoreB);
    return s === season && r === Number(roundNumber) && validScore && Array.isArray(m.fights) && m.fights.length > 0
      && !/cancel|pending|scheduled|agend|andamento|live/i.test(String(m.status || ""));
  });
}

/** Zebra: time com valor >= threshold% inferior ao adversário */
function computeZebraFlags(match, threshold, teamValues) {
  const va = teamValues ? teamValues[match.timeA] : teamSquadValue(match.timeA);
  const vb = teamValues ? teamValues[match.timeB] : teamSquadValue(match.timeB);
  if (!va || !vb || va === vb) return { underdog: null, favorite: null };
  const ratio = Math.min(va, vb) / Math.max(va, vb);
  if (ratio > 1 - threshold) return { underdog: null, favorite: null };
  if (va < vb) return { underdog: match.timeA, favorite: match.timeB };
  return { underdog: match.timeB, favorite: match.timeA };
}

function fantasyAgentMatches(ref, player, team, map) {
  if (!ref) return false;
  if (typeof ref === "object") {
    const id = ref.playerId || ref.id;
    const key = ref.playerKey || ref.key;
    if (id) return id === player.id;
    if (key) return key === player.key;
    ref = ref.name || ref.n || ref.agent;
  }
  const name = normalizeNameFX(ref);
  if (!name || (team && team !== player.club)) return false;
  const sameName = Object.values(map).filter(p => (!team || p.club === team) && normalizeNameFX(p.name) === name);
  return sameName.length === 1 && sameName[0].key === player.key;
}

function fantasyPlayedTeam(match, player, map) {
  const teams = new Set();
  (match.fights || []).forEach(fight => {
    [[fight.teamA, match.timeA], [fight.teamB, match.timeB]].forEach(([side, team]) => {
      const agents = Array.isArray(side) ? side : side?.agents || [];
      if (agents.some(ref => fantasyAgentMatches(ref, player, team, map))) teams.add(team);
    });
  });
  return teams.size === 1 ? [...teams][0] : null;
}

/**
 * Pontua um playerKey na rodada com base nos matches oficiais.
 * @returns {{ points: number, events: string[], played: boolean, detail: object }}
 */
function scoreAgentInRound(playerKey, matches, opts = {}) {
  const S = opts.scoring || window.FANTASY.SCORING;
  const threshold = opts.zebraThreshold ?? fantasySettings().zebraThreshold ?? 0.2;
  // perSeries (padrão): soma cada série da rodada
  // perRoundOnce: no máximo uma participação/placar por rodada (melhor série por pontos base)
  const scoreMode = opts.scoreMode || fantasySettings().scoreMode || "perSeries";
  const map = opts.playerMap || fantasyPlayerMap();
  const player = map[playerKey];
  if (!player) return { points: 0, events: ["agente não encontrado"], played: false, detail: {} };

  let points = 0;
  const events = [];
  let playedAny = false;
  let seriesResults = [];

  const seriesScores = []; // { points, events, meta }

  matches.forEach(m => {
    const team = fantasyPlayedTeam(m, player, map);
    if (!team) return;

    playedAny = true;
    let sp = 0;
    const se = [];
    sp += S.played;
    se.push(`+${S.played} participou (${m.timeA}×${m.timeB})`);

    const scoreForTeam = team === m.timeA ? Number(m.scoreA) : Number(m.scoreB);
    const scoreAgainst = team === m.timeA ? Number(m.scoreB) : Number(m.scoreA);
    const won = scoreForTeam > scoreAgainst;

    if (won) {
      if (scoreAgainst === 0) {
        sp += S.win20;
        se.push(`+${S.win20} vitória ${scoreForTeam}–${scoreAgainst}`);
      } else {
        sp += S.win21;
        se.push(`+${S.win21} vitória ${scoreForTeam}–${scoreAgainst}`);
      }
    } else {
      if (scoreForTeam === 0) {
        sp += S.loss02;
        se.push(`${S.loss02} derrota ${scoreForTeam}–${scoreAgainst}`);
      } else {
        sp += S.loss12;
        se.push(`${S.loss12} derrota ${scoreForTeam}–${scoreAgainst}`);
      }
    }

    const mvp = m.seriesMvp || m.mvp;
    if (fantasyAgentMatches(mvp, player, m.seriesMvp?.team || null, map)) {
      sp += S.mvp;
      se.push(`+${S.mvp} MVP da série`);
    }

    const z = computeZebraFlags(m, threshold, opts.teamValues);
    if (z.underdog && won && team === z.underdog) {
      sp += S.zebraWin;
      se.push(`+${S.zebraWin} vitória zebra`);
    }
    if (z.favorite && !won && team === z.favorite) {
      sp += S.zebraLoss;
      se.push(`${S.zebraLoss} derrota zebra`);
    }

    seriesScores.push({ points: sp, events: se, meta: { matchId: m.id, team, won, scoreForTeam, scoreAgainst } });
    seriesResults.push({ matchId: m.id, team, won, scoreForTeam, scoreAgainst });
  });

  if (scoreMode === "perRoundOnce" && seriesScores.length > 0) {
    seriesScores.sort((a, b) => b.points - a.points);
    const best = seriesScores[0];
    points += best.points;
    events.push(...best.events);
    if (seriesScores.length > 1) {
      events.push(`(modo 1× por rodada: ${seriesScores.length - 1} série(s) extra ignorada(s))`);
    }
  } else {
    seriesScores.forEach(s => {
      points += s.points;
      events.push(...s.events);
    });
  }

  if (!playedAny) {
    points += S.noShow;
    events.push(`${S.noShow} escalado e não entrou`);
  }

  if (playedAny && matches.some(m => fantasyAgentMatches(m.destaqueRodada, player, null, map))) {
    points += S.highlight;
    events.push(`+${S.highlight} Destaque da rodada`);
  }

  return { points, events, played: playedAny, detail: { seriesResults, scoreMode } };
}

function scoreParticipantRound(participant, matches, opts = {}) {
  const S = opts.scoring || window.FANTASY.SCORING;
  const squad = typeof normalizeFantasySquad === "function" ? normalizeFantasySquad(participant.squad) : (participant.squad || emptySquad());
  const starters = (squad.starters || []).filter(Boolean);
  const captainKey = squad.captainKey;
  const breakdown = [];

  starters.forEach(key => {
    const r = scoreAgentInRound(key, matches, opts);
    let pts = r.points;
    const isCap = key === captainKey;
    if (isCap) {
      pts = Math.round(pts * S.captainMult * 10) / 10;
      r.events.push(`Capitão ×${S.captainMult} → ${pts}`);
    }
    breakdown.push({
      playerKey: key,
      playerId: (opts.playerMap || fantasyPlayerMap())[key]?.id || `legacy:${key}`,
      name: (opts.playerMap || fantasyPlayerMap())[key]?.name || key,
      club: (opts.playerMap || fantasyPlayerMap())[key]?.club || "",
      role: isCap ? "captain" : "starter",
      base: r.points,
      points: pts,
      events: r.events,
      played: r.played
    });
  });

  // Reserva: não pontua automaticamente (V1)
  if (squad.bench) {
    breakdown.push({
      playerKey: squad.bench,
      playerId: (opts.playerMap || fantasyPlayerMap())[squad.bench]?.id || `legacy:${squad.bench}`,
      name: (opts.playerMap || fantasyPlayerMap())[squad.bench]?.name || squad.bench,
      club: (opts.playerMap || fantasyPlayerMap())[squad.bench]?.club || "",
      role: "bench",
      base: 0,
      points: 0,
      events: ["reserva (sem pontuação automática)"],
      played: false
    });
  }

  const total = Math.round(breakdown.reduce((s, b) => s + b.points, 0) * 10) / 10;
  return { total, breakdown };
}

/**
 * Processa todos os participantes de uma rodada.
 */
function processFantasyRound(roundMeta, participants, opts = {}) {
  const snapshot = roundMeta.snapshot;
  if (!snapshot) throw new Error("Escalação oficial ausente. Feche o mercado antes de processar.");
  const season = roundMeta.seasonId;
  const roundNumber = roundMeta.rodadaNumber;
  const matches = getMatchesForRound(season, roundNumber, opts.matches || window.AppState.jet.matches || []);
  opts = { scoreMode: snapshot.settings.scoreMode, zebraThreshold: snapshot.settings.zebraThreshold,
    playerMap: snapshot.players, teamValues: snapshot.teamValues, scoring: snapshot.scoring };
  const jetMatchIds = matches.map(m => m.id);
  const scores = {};
  Object.entries(snapshot.participants).forEach(([id, p]) => {
    const result = p.valid ? scoreParticipantRound(p, matches, opts) : { total: 0, breakdown: [] };
    scores[id] = { ...result, displayName: p.displayName, teamName: p.teamName, valid: p.valid,
      errors: p.errors || [], lockedAt: snapshot.capturedAt };
  });

  return { scores, jetMatchIds, matchesCount: matches.length, season, roundNumber, matchSnapshot: JSON.parse(JSON.stringify(matches)) };
}

window.getMatchesForRound = getMatchesForRound;
window.scoreAgentInRound = scoreAgentInRound;
window.scoreParticipantRound = scoreParticipantRound;
window.processFantasyRound = processFantasyRound;
window.computeZebraFlags = computeZebraFlags;
