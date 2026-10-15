/* Jet Fantasy — elenco, orçamento, validações */
window.FANTASY = window.FANTASY || {};

function countTeamInSquad(squad, playerMap) {
  const counts = {};
  const keys = [...(squad.starters || []), squad.bench].filter(Boolean);
  keys.forEach(k => {
    const club = playerMap[k]?.club;
    if (!club) return;
    counts[club] = (counts[club] || 0) + 1;
  });
  return counts;
}

function squadPlayerKeys(squad) {
  const safe = typeof normalizeFantasySquad === "function" ? normalizeFantasySquad(squad) : (squad || emptySquad());
  return [...safe.starters, safe.bench].filter(Boolean);
}

function validateSquad(squad, budgetRemaining, opts = {}) {
  const settings = opts.settings || fantasySettings();
  const maxPerTeam = opts.maxPerTeam ?? settings.maxPerTeam ?? 2;
  const needStarters = settings.starters ?? 5;
  const map = opts.playerMap || fantasyPlayerMap();
  const errors = [];

  squad = typeof normalizeFantasySquad === "function" ? normalizeFantasySquad(squad) : squad;
  const starters = (squad.starters || []).filter(Boolean);
  if (starters.length !== needStarters) {
    errors.push(`Precisa de ${needStarters} titulares (tem ${starters.length})`);
  }
  if (!squad.bench) errors.push("Escolha 1 reserva");
  if (!squad.captainKey) errors.push("Escolha o Capitão");
  if (squad.captainKey && !starters.includes(squad.captainKey)) {
    errors.push("Capitão deve ser um dos titulares");
  }

  const all = squadPlayerKeys(squad);
  if (new Set(all).size !== all.length) errors.push("Agente duplicado no elenco");
  all.forEach(key => { if (!map[key]) errors.push(`Agente indisponível: ${key}`); });
  if (!Number.isFinite(Number(budgetRemaining)) || Number(budgetRemaining) < 0) errors.push("Saldo inválido");

  const counts = countTeamInSquad(squad, map);
  Object.entries(counts).forEach(([team, n]) => {
    if (n > maxPerTeam) errors.push(`Máximo ${maxPerTeam} agentes de ${team} (tem ${n})`);
  });

  // Custo: soma marketValue dos no elenco não deve exceder budgetInitial
  // Modelo: budgetRemaining + valor dos no elenco = patrimônio; ao escalar gasta budget
  // Validação de compra feita em tryAddPlayer

  return { ok: errors.length === 0, errors };
}

function squadCost(squad) {
  return squadPlayerKeys(squad).reduce((s, k) => s + playerPrice(k), 0);
}

/**
 * Preço Fantasy deriva do valor oficial do TransferJet, mas usa uma escala própria
 * para a economia de US$ 5M continuar jogável. Por padrão: 10% do marketValue,
 * arredondado em blocos de US$ 10 mil, com piso configurável.
 */
function fantasyPriceFromMarketValue(marketValue) {
  const settings = fantasySettings();
  const scale = Number(settings.priceScale ?? 0.10);
  const min = Number(settings.minFantasyPrice ?? 50000);
  const raw = Math.max(0, Number(marketValue || 0)) * scale;
  if (raw <= 0) return 0;
  return Math.max(min, Math.round(raw / 10000) * 10000);
}

function playerPrice(playerKey) {
  const player = (typeof getAllPlayersFlat === "function" ? getAllPlayersFlat() : []).find(p => p.key === playerKey);
  return fantasyPriceFromMarketValue(player?.marketValue || 0);
}

function fantasyRefund(participant, key) {
  const current = playerPrice(key);
  const paid = Number(participant.acquisitions?.[key]?.boughtFor || 0);
  return current > 0 ? current : (Number.isFinite(paid) && paid > 0 ? paid : 0);
}

function fantasyTargetSlot(participant) {
  const explicit = window._fxTargetSlot;
  if (explicit === "bench" || Number.isInteger(explicit)) return explicit;
  const squad = normalizeFantasySquad(participant.squad);
  const empty = firstEmptyStarterSlot(squad);
  return empty >= 0 ? empty : (squad.bench ? null : "bench");
}

function canAfford(participant, playerKey) {
  const price = playerPrice(playerKey);
  return (participant.budgetRemaining || 0) >= price;
}

function tryAddToSquad(participant, playerKey, slot) {
  // slot: 0-4 starter index, or "bench"
  if (!isFantasyMarketOpen()) return { ok: false, error: "Mercado fechado" };
  const map = fantasyPlayerMap();
  if (!map[playerKey]) return { ok: false, error: "Agente indisponível" };
  if (slot !== "bench" && (!Number.isInteger(slot) || slot < 0 || slot > 4)) return { ok: false, error: slot === null ? "Elenco cheio. Escolha um slot para trocar." : "Slot inválido" };
  if (!Number.isFinite(participant.budgetRemaining) || participant.budgetRemaining < 0) return { ok: false, error: "Saldo inválido" };

  const squad = typeof normalizeFantasySquad === "function" ? normalizeFantasySquad(participant.squad) : JSON.parse(JSON.stringify(participant.squad || emptySquad()));
  const currentKeys = squadPlayerKeys(squad);

  if (currentKeys.includes(playerKey)) return { ok: false, error: "Já está no seu elenco" };

  const price = playerPrice(playerKey);
  // Liberar slot: se substituir alguém, devolve o valor ao budget
  let budget = participant.budgetRemaining || 0;
  let replaced = null;

  if (slot === "bench") {
    if (squad.bench) {
      replaced = squad.bench;
      budget += fantasyRefund(participant, squad.bench);
    }
    if (budget < price) return { ok: false, error: "Orçamento insuficiente" };
    squad.bench = playerKey;
  } else {
    const idx = Number(slot);
    if (idx < 0 || idx > 4) return { ok: false, error: "Slot inválido" };
    if (squad.starters[idx]) {
      replaced = squad.starters[idx];
      budget += fantasyRefund(participant, squad.starters[idx]);
      if (squad.captainKey === replaced) squad.captainKey = null;
    }
    if (budget < price) return { ok: false, error: "Orçamento insuficiente" };
    if (!squad.starters) squad.starters = [null, null, null, null, null];
    squad.starters[idx] = playerKey;
  }

  budget -= price;

  // validar limite por time
  const counts = countTeamInSquad(squad, map);
  const maxPerTeam = fantasySettings().maxPerTeam || 2;
  for (const [team, n] of Object.entries(counts)) {
    if (n > maxPerTeam) return { ok: false, error: `Máximo ${maxPerTeam} de ${team}` };
  }

  const acquisitions = { ...(participant.acquisitions || {}) };
  if (replaced) delete acquisitions[replaced];
  return {
    ok: true,
    squad,
    budgetRemaining: budget,
    replaced,
    acquisitions: {
      ...acquisitions,
      [playerKey]: { boughtFor: price, at: new Date().toISOString() }
    }
  };
}

function tryRemoveFromSquad(participant, playerKey) {
  if (!isFantasyMarketOpen()) return { ok: false, error: "Mercado fechado" };
  if (!Number.isFinite(participant.budgetRemaining) || participant.budgetRemaining < 0) return { ok: false, error: "Saldo inválido" };
  const squad = typeof normalizeFantasySquad === "function" ? normalizeFantasySquad(participant.squad) : JSON.parse(JSON.stringify(participant.squad || emptySquad()));
  let budget = participant.budgetRemaining || 0;
  let found = false;

  squad.starters = (squad.starters || []).map(k => {
    if (k === playerKey) {
      found = true;
      return null;
    }
    return k;
  });
  if (squad.bench === playerKey) {
    found = true;
    squad.bench = null;
  }
  if (squad.captainKey === playerKey) squad.captainKey = null;
  if (!found) return { ok: false, error: "Não está no elenco" };

  budget += fantasyRefund(participant, playerKey);
  const acquisitions = { ...(participant.acquisitions || {}) };
  delete acquisitions[playerKey];
  return { ok: true, squad, budgetRemaining: budget, acquisitions };
}

function trySetCaptain(participant, playerKey) {
  if (!isFantasyMarketOpen()) return { ok: false, error: "Mercado fechado" };
  const safeSquad = typeof normalizeFantasySquad === "function" ? normalizeFantasySquad(participant.squad) : (participant.squad || emptySquad());
  const starters = safeSquad.starters.filter(Boolean);
  if (!starters.includes(playerKey)) return { ok: false, error: "Capitão deve ser titular" };
  const squad = { ...safeSquad, captainKey: playerKey };
  return { ok: true, squad };
}

function firstEmptyStarterSlot(squad) {
  const safe = typeof normalizeFantasySquad === "function" ? normalizeFantasySquad(squad) : (squad || emptySquad());
  const s = safe.starters || [];
  for (let i = 0; i < 5; i++) if (!s[i]) return i;
  return -1;
}

window.validateSquad = validateSquad;
window.squadCost = squadCost;
window.playerPrice = playerPrice;
window.fantasyPriceFromMarketValue = fantasyPriceFromMarketValue;
window.tryAddToSquad = tryAddToSquad;
window.tryRemoveFromSquad = tryRemoveFromSquad;
window.trySetCaptain = trySetCaptain;
window.squadPlayerKeys = squadPlayerKeys;
window.firstEmptyStarterSlot = firstEmptyStarterSlot;
