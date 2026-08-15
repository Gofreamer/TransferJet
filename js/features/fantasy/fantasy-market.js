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
  const settings = fantasySettings();
  const maxPerTeam = opts.maxPerTeam ?? settings.maxPerTeam ?? 2;
  const needStarters = settings.starters ?? 5;
  const map = fantasyPlayerMap();
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
  const map = fantasyPlayerMap();
  return squadPlayerKeys(squad).reduce((s, k) => s + (map[k]?.marketValue || 0), 0);
}

/** Preço de referência = marketValue oficial atual */
function playerPrice(playerKey) {
  const map = fantasyPlayerMap();
  return map[playerKey]?.marketValue || 0;
}

function canAfford(participant, playerKey) {
  const price = playerPrice(playerKey);
  return (participant.budgetRemaining || 0) >= price;
}

function tryAddToSquad(participant, playerKey, slot) {
  // slot: 0-4 starter index, or "bench"
  if (!isFantasyMarketOpen()) return { ok: false, error: "Mercado fechado" };
  const map = fantasyPlayerMap();
  if (!map[playerKey]) return { ok: false, error: "Agente não encontrado" };

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
      budget += playerPrice(squad.bench);
    }
    if (budget < price) return { ok: false, error: "Orçamento insuficiente" };
    squad.bench = playerKey;
  } else {
    const idx = Number(slot);
    if (idx < 0 || idx > 4) return { ok: false, error: "Slot inválido" };
    if (squad.starters[idx]) {
      replaced = squad.starters[idx];
      budget += playerPrice(squad.starters[idx]);
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

  return {
    ok: true,
    squad,
    budgetRemaining: budget,
    replaced,
    acquisitions: {
      ...(participant.acquisitions || {}),
      [playerKey]: { boughtFor: price, at: new Date().toISOString() }
    }
  };
}

function tryRemoveFromSquad(participant, playerKey) {
  if (!isFantasyMarketOpen()) return { ok: false, error: "Mercado fechado" };
  const squad = typeof normalizeFantasySquad === "function" ? normalizeFantasySquad(participant.squad) : JSON.parse(JSON.stringify(participant.squad || emptySquad()));
  let budget = participant.budgetRemaining || 0;
  let found = false;

  squad.starters = (squad.starters || []).map(k => {
    if (k === playerKey) {
      found = true;
      budget += playerPrice(playerKey);
      return null;
    }
    return k;
  });
  if (squad.bench === playerKey) {
    found = true;
    budget += playerPrice(playerKey);
    squad.bench = null;
  }
  if (squad.captainKey === playerKey) squad.captainKey = null;
  if (!found) return { ok: false, error: "Não está no elenco" };

  return { ok: true, squad, budgetRemaining: budget };
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
window.tryAddToSquad = tryAddToSquad;
window.tryRemoveFromSquad = tryRemoveFromSquad;
window.trySetCaptain = trySetCaptain;
window.squadPlayerKeys = squadPlayerKeys;
window.firstEmptyStarterSlot = firstEmptyStarterSlot;
