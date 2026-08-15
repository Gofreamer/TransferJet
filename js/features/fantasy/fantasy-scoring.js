/* Jet Fantasy — pontuação determinística (autoridade única) */
window.FANTASY = window.FANTASY || {};

function normalizeNameFX(n) {
  return String(n || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function getMatchesForRound(season, roundNumber) {
  const matches = window.AppState.jet.matches || [];
  const list = Array.isArray(matches) ? matches : Object.values(matches);
  return list.filter(m => {
    if (!m) return false;
    const s = m.temporada || window.AppState.jet.currentSeason;
    const r = Number(m.rodada) || 0;
    return s === season && r === Number(roundNumber);
  });
}

/** Zebra: time com valor >= threshold% inferior ao adversário */
function computeZebraFlags(match, threshold) {
  const va = teamSquadValue(match.timeA);
  const vb = teamSquadValue(match.timeB);
  if (!va || !vb) return { underdog: null, favorite: null };
  const ratio = Math.min(va, vb) / Math.max(va, vb);
  if (ratio > 1 - threshold) return { underdog: null, favorite: null };
  if (va < vb) return { underdog: match.timeA, favorite: match.timeB };
  return { underdog: match.timeB, favorite: match.timeA };
}

function extractPlayedByTeam(match) {
  const byName = {}; // nameKey -> team
  const fights = Array.isArray(match.fights) ? match.fights : [];
  fights.forEach(f => {
    const a = f.teamA?.agents || (Array.isArray(f.teamA) ? f.teamA : []) || [];
    const b = f.teamB?.agents || (Array.isArray(f.teamB) ? f.teamB : []) || [];
    a.filter(Boolean).forEach(n => { byName[normalizeNameFX(n)] = match.timeA; });
    b.filter(Boolean).forEach(n => { byName[normalizeNameFX(n)] = match.timeB; });
  });
  return { byName, hasFights: fights.length > 0 };
}

/**
 * Pontua um playerKey na rodada com base nos matches oficiais.
 * @returns {{ points: number, events: string[], played: boolean, detail: object }}
 */
function scoreAgentInRound(playerKey, matches, opts = {}) {
  const S = window.FANTASY.SCORING;
  const threshold = opts.zebraThreshold ?? fantasySettings().zebraThreshold ?? 0.2;
  const map = fantasyPlayerMap();
  const player = map[playerKey];
  if (!player) return { points: 0, events: ["agente não encontrado"], played: false, detail: {} };

  const nameKey = normalizeNameFX(player.name);
  let points = 0;
  const events = [];
  let playedAny = false;
  let seriesResults = []; // win margin etc.

  // Destaque da rodada (qualquer match)
  const highlightNames = new Set();
  matches.forEach(m => {
    if (m.destaqueRodada) highlightNames.add(normalizeNameFX(m.destaqueRodada));
  });

  matches.forEach(m => {
    const { byName, hasFights } = extractPlayedByTeam(m);
    if (!hasFights) return;

    const team = byName[nameKey];
    if (!team) return; // não jogou esta série

    playedAny = true;
    points += S.played;
    events.push(`+${S.played} participou (${m.timeA}×${m.timeB})`);

    const scoreForTeam = team === m.timeA ? Number(m.scoreA) : Number(m.scoreB);
    const scoreAgainst = team === m.timeA ? Number(m.scoreB) : Number(m.scoreA);
    const won = scoreForTeam > scoreAgainst;

    if (won) {
      if (scoreAgainst === 0) {
        points += S.win20;
        events.push(`+${S.win20} vitória ${scoreForTeam}–${scoreAgainst}`);
      } else {
        points += S.win21;
        events.push(`+${S.win21} vitória ${scoreForTeam}–${scoreAgainst}`);
      }
    } else {
      if (scoreForTeam === 0) {
        points += S.loss02;
        events.push(`${S.loss02} derrota ${scoreForTeam}–${scoreAgainst}`);
      } else {
        points += S.loss12;
        events.push(`${S.loss12} derrota ${scoreForTeam}–${scoreAgainst}`);
      }
    }

    // MVP da série
    const mvpName = normalizeNameFX(m.seriesMvp?.agent || m.mvp || "");
    if (mvpName && mvpName === nameKey) {
      points += S.mvp;
      events.push(`+${S.mvp} MVP da série`);
    }

    // Zebra
    const z = computeZebraFlags(m, threshold);
    if (z.underdog && won && team === z.underdog) {
      points += S.zebraWin;
      events.push(`+${S.zebraWin} vitória zebra`);
    }
    if (z.favorite && !won && team === z.favorite) {
      points += S.zebraLoss;
      events.push(`${S.zebraLoss} derrota zebra`);
    }

    seriesResults.push({ matchId: m.id, team, won, scoreForTeam, scoreAgainst });
  });

  if (!playedAny) {
    points += S.noShow;
    events.push(`${S.noShow} escalado e não entrou`);
  }

  if (highlightNames.has(nameKey) && playedAny) {
    points += S.highlight;
    events.push(`+${S.highlight} Destaque da rodada`);
  }

  return { points, events, played: playedAny, detail: { seriesResults } };
}

function scoreParticipantRound(participant, matches, opts = {}) {
  const S = window.FANTASY.SCORING;
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
  const season = roundMeta.seasonId || fantasySettings().seasonId || window.AppState.jet.currentSeason;
  const roundNumber = roundMeta.rodadaNumber;
  const matches = getMatchesForRound(season, roundNumber);
  const jetMatchIds = matches.map(m => m.id).filter(Boolean);

  const scores = {};
  Object.entries(participants || {}).forEach(([id, p]) => {
    if (!p || p.active === false) return;
    const result = scoreParticipantRound(p, matches, opts);
    scores[id] = {
      total: result.total,
      breakdown: result.breakdown,
      processedAt: new Date().toISOString()
    };
  });

  return { scores, jetMatchIds, matchesCount: matches.length, season, roundNumber };
}

window.getMatchesForRound = getMatchesForRound;
window.scoreAgentInRound = scoreAgentInRound;
window.scoreParticipantRound = scoreParticipantRound;
window.processFantasyRound = processFantasyRound;
window.computeZebraFlags = computeZebraFlags;
