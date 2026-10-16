/* Cópias oficiais imutáveis e publicação atômica por rodada. */
function buildFantasySnapshot(participants, players, settings, at = new Date().toISOString()) {
  const playerMap = {};
  const teamValues = {};
  const eligible = {};
  players.forEach(p => {
    const value = Number(p.marketValue || 0);
    playerMap[p.key] = { key: p.key, id: p.id || `legacy:${p.key}`, name: p.name, club: p.club,
      marketValue: Number.isFinite(value) ? value : 0, status: p.status || "ativo", rank: p.rank || "—",
      fantasyPrice: value > 0 ? Math.max(Number(settings.minFantasyPrice), Math.round(value * Number(settings.priceScale) / 10000) * 10000) : 0 };
    if (isCompetitivePlayer(p)) teamValues[p.club] = (teamValues[p.club] || 0) + playerMap[p.key].marketValue;
    const effects = agentStatusEffects(p.status);
    if (isCompetitivePlayer(p) && effects.fantasyEligible && !p.offLeague && !p.retired && !p.freeAgent && p.fantasyEligible !== false && value > 0 && p.club && p.club !== "Livre") eligible[p.key] = p;
  });
  const official = {};
  Object.entries(participants || {}).forEach(([id, raw]) => {
    if (!raw || raw.active === false) return;
    const p = normalizeFantasyParticipant(raw, id);
    const validation = validateSquad(p.squad, p.budgetRemaining, { playerMap: eligible, settings });
    official[id] = { displayName: p.displayName || id, teamName: p.teamName || "", type: p.type || "human",
      squad: p.squad, budgetRemaining: p.budgetRemaining, valid: validation.ok, errors: validation.errors };
  });
  return JSON.parse(JSON.stringify({ version: 1, capturedAt: at, participants: official, players: playerMap,
    teamValues, settings, scoring: { ...FANTASY.SCORING } }));
}

function fantasyRoundRef(id) {
  if (!id || /[.#$\[\]/]/.test(id)) throw new Error("Rodada inválida");
  return window.marketDb.ref("fantasy/rounds/" + id);
}

async function closeFantasyRound() {
  const settingsRef = window.marketDb.ref("fantasy/settings");
  const initial = (await settingsRef.once("value")).val();
  if (!initial?.currentRoundId) throw new Error("Configure a rodada antes de fechar o mercado.");
  const existing = (await fantasyRoundRef(initial.currentRoundId).once("value")).val();
  if (initial.marketStatus === "LOCKED" && existing?.snapshot) return existing;
  const locked = await settingsRef.transaction(raw => raw?.currentRoundId === initial.currentRoundId ? { ...raw, marketStatus: "LOCKED" } : undefined);
  if (!locked.committed) throw new Error("Configure a rodada antes de fechar o mercado.");
  const settings = { ...FANTASY.DEFAULTS, ...locked.snapshot.val() };
  const ref = fantasyRoundRef(settings.currentRoundId);
  const round = (await ref.once("value")).val();
  if (!round || !round.rodadaNumber || round.seasonId && round.seasonId !== settings.seasonId) throw new Error("Metadados da rodada inválidos. Mercado permanece fechado.");
  if (round.snapshot) return round;
  if (round.status === "PROCESSED") throw new Error("Rodada antiga já processada; histórico preservado.");
  const participants = (await window.marketDb.ref("fantasy/participants").once("value")).val() || {};
  const rawPlayers = (await window.marketDb.ref("players").once("value")).val() || {};
  const players = getAllPlayersFlat().map(p => {
    const merged = { ...p, ...rawPlayers[p.key], key: p.key, id: rawPlayers[p.key]?.id || p.id };
    const effects = agentStatusEffects(merged.status);
    merged.club = effects.isRetired ? "Aposentado" : (effects.isFree || merged.freeAgent ? "Livre" : rawPlayers[p.key]?.team || p.club);
    return merged;
  });
  const snapshot = buildFantasySnapshot(participants, players, settings);
  const result = await ref.transaction(current => {
    if (!current || current.snapshot || current.status === "PROCESSED" || current.status === "PROCESSING") return;
    return { ...current, id: settings.currentRoundId, seasonId: settings.seasonId, status: "LOCKED", lockedAt: snapshot.capturedAt, snapshot };
  });
  const saved = result.snapshot.val();
  if (!saved?.snapshot) throw new Error("Não foi possível salvar as escalações oficiais. Mercado permanece fechado.");
  return saved;
}

async function prepareFantasyRound(id) {
  const round = (await fantasyRoundRef(id).once("value")).val();
  if (!round?.snapshot) throw new Error("Feche o mercado para salvar as escalações oficiais antes de pontuar.");
  if (round.status === "PROCESSING") throw new Error("Esta rodada está em processamento.");
  if (round.status === "PROCESSED") return { round, result: null, alreadyProcessed: true };
  if (round.status !== "LOCKED") throw new Error("A rodada precisa estar fechada.");
  const matches = (await window.jetDb.ref(window.JET_PATHS?.matches || "liga/matches").once("value")).val() || {};
  const result = processFantasyRound(round, null, { matches });
  if (!result.matchesCount) throw new Error("Nenhuma série concluída com confrontos nesta rodada.");
  return { round, result };
}

function fantasyResultSignature(result) {
  return JSON.stringify({ scores: result.scores, jetMatchIds: result.jetMatchIds, matches: result.matchSnapshot });
}

async function publishFantasyRound(id, reviewed) {
  const fresh = await prepareFantasyRound(id);
  if (fresh.alreadyProcessed) return { alreadyProcessed: true };
  if (fantasyResultSignature(fresh.result) !== fantasyResultSignature(reviewed)) throw new Error("Os dados mudaram. Revise a pontuação novamente.");
  const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const ref = fantasyRoundRef(id);
  const lock = await ref.transaction(current => {
    if (!current?.snapshot || current.status !== "LOCKED" || JSON.stringify(current.snapshot) !== JSON.stringify(fresh.round.snapshot)) return;
    return { ...current, status: "PROCESSING", processingToken: token };
  });
  if (!lock.committed) throw new Error("Outra operação alterou esta rodada. Atualize a revisão.");
  const round = lock.snapshot.val();
  try {
    const byRound = {};
    Object.entries(reviewed.scores).forEach(([pid, score]) => { byRound[pid] = score.total; });
    const ranked = Object.entries(reviewed.scores).sort((a, b) => b[1].total - a[1].total || a[0].localeCompare(b[0]));
    const { processingToken, ...saved } = round;
    await window.marketDb.ref().update({
      [`fantasy/scores/${id}`]: reviewed.scores,
      [`fantasy/leaderboard/byRound/${id}`]: byRound,
      [`fantasy/rounds/${id}`]: { ...saved, status: "PROCESSED", processedAt: new Date().toISOString(),
        jetMatchIds: reviewed.jetMatchIds, matchSnapshot: reviewed.matchSnapshot, winnerParticipantId: ranked[0]?.[0] || null }
    });
    return { alreadyProcessed: false };
  } catch (error) {
    try { await ref.transaction(current => {
      if (current?.processingToken !== token || current.status !== "PROCESSING") return;
      const { processingToken, ...saved } = current;
      return { ...saved, status: "LOCKED" };
    }); } catch (_) { /* O token permanece visível para recuperação administrativa. */ }
    throw error;
  }
}

function fantasyOverallFromScores(scores) {
  const overall = {};
  Object.values(scores || {}).forEach(round => Object.entries(round || {}).forEach(([id, score]) => {
    const previous = overall[id] || { points: 0 };
    overall[id] = { ...previous, displayName: score.displayName || previous.displayName || id,
      teamName: score.teamName || previous.teamName || "", points: Math.round((previous.points + Number(score.total || 0)) * 10) / 10 };
  }));
  return overall;
}
