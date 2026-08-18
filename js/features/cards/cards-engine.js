/* Jet Cards 2.0 — catálogo, sorteio, inventário, descobertas */
window.CARDS = window.CARDS || {};

function getCatalogMap() {
  return ensureCardsState().catalog || {};
}

function getSpecialsMap() {
  return ensureCardsState().specials || {};
}

/** Resolve definição estável (número JL, edição, arte) */
function resolveCardDef(partial) {
  const playerKey = partial.playerKey;
  const edition = (partial.edition || partial.editionType || "BASE").toUpperCase();
  const defId = partial.defId || catalogDefId(playerKey, edition);
  const catalog = getCatalogMap();
  const specials = getSpecialsMap();
  const fromCat = catalog[defId] || null;
  const fromSp = specials[defId] || (partial.specialId && specials[partial.specialId]) || null;
  const map = typeof fantasyPlayerMap === "function" ? fantasyPlayerMap() : {};
  let player = map[playerKey];
  if (!player && typeof getAllPlayersFlat === "function") {
    player = getAllPlayersFlat().find(p => p.key === playerKey);
  }

  const number = partial.number != null
    ? Number(partial.number)
    : (fromSp?.number ?? fromCat?.number ?? null);

  const frozenName = partial.playerName || fromSp?.playerName || fromCat?.playerName || player?.name || playerKey;
  const frozenTeam = partial.team || fromSp?.team || fromCat?.team || player?.club || "—";
  const frozenRank = partial.rank || fromSp?.rank || fromCat?.rank || player?.rank || "—";
  const cycle = partial.cycle || fromSp?.cycle || fromCat?.cycle || cardsCycleLabel();
  const season = partial.season || fromSp?.season || fromCat?.season || cardsSettings().seasonId || "";

  return {
    defId,
    playerKey,
    edition,
    editionLabel: (window.CARDS.EDITIONS[edition] || {}).label || edition,
    number,
    cardNumber: number != null ? formatCardNumber(number) : (partial.cardNumber || "JL-???"),
    playerName: frozenName,
    team: frozenTeam,
    rank: frozenRank,
    cycle,
    season,
    specialImageUrl: partial.specialImageUrl || fromSp?.specialImageUrl || null,
    description: partial.description || fromSp?.description || "",
    achievements: partial.achievements || fromSp?.achievements || [],
    customName: partial.customName || fromSp?.customName || null,
    inPackPool: fromSp ? fromSp.inPackPool !== false && fromSp.inPackPool !== undefined ? fromSp.inPackPool : false : true
  };
}

function pickRandomPlayer(pool) {
  if (!pool || !pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Sorteia resultados de pack a partir do catálogo BASE (+ especiais com inPackPool).
 * Campos históricos ficam congelados no record.
 */
function openPackResults(count, rates) {
  const catalog = getCatalogMap();
  const specials = getSpecialsMap();
  const basePool = Object.values(catalog).filter(c => (c.edition || "BASE") === "BASE");
  const specialPool = Object.values(specials).filter(s => s.active !== false && s.inPackPool === true);
  const pool = basePool.length ? basePool : null;
  const players = cardsPlayerPool();
  const n = count || cardsSettings().packSize || 3;
  const results = [];

  for (let i = 0; i < n; i++) {
    let def = null;
    let fromSpecial = false;
    // ~8% chance de especial se houver no pool
    if (specialPool.length && Math.random() < 0.08) {
      def = specialPool[Math.floor(Math.random() * specialPool.length)];
      fromSpecial = true;
    } else if (pool && pool.length) {
      def = pool[Math.floor(Math.random() * pool.length)];
    } else {
      const p = pickRandomPlayer(players);
      if (!p) continue;
      def = {
        defId: catalogDefId(p.key, "BASE"),
        playerKey: p.key,
        playerName: p.name,
        team: p.club,
        rank: p.rank,
        edition: "BASE",
        number: null
      };
    }

    // Especial no pool: raridade e foil fixos do cadastro (defaultRarity / defaultFoil)
    // BASE: continua sorteando pelas rates globais
    let rarity;
    let foil;
    if (fromSpecial) {
      const allowed = { common: 1, rare: 1, epic: 1, legend: 1 };
      const dr = String(def.defaultRarity || def.rarity || "epic").toLowerCase();
      rarity = allowed[dr] ? dr : "epic";
      const df = String(def.defaultFoil || def.foil || "normal").toLowerCase();
      foil = df === "holo" ? "holo" : "normal";
    } else {
      rarity = rollRarity(rates);
      foil = rollHolo(rarity) ? "holo" : "normal";
    }

    const resolved = resolveCardDef(def);
    results.push({
      cardId: newCardId(),
      defId: resolved.defId,
      playerKey: resolved.playerKey,
      playerName: resolved.playerName,
      team: resolved.team,
      rank: resolved.rank,
      rarity,
      foil,
      edition: resolved.edition,
      number: resolved.number,
      cardNumber: resolved.cardNumber,
      cycle: resolved.cycle,
      season: resolved.season,
      specialImageUrl: resolved.specialImageUrl || null,
      description: resolved.description || "",
      obtainedAt: new Date().toISOString(),
      source: "pack"
    });
  }
  return results;
}

function buildCardRecord(partial, packId) {
  const resolved = resolveCardDef(partial);
  return {
    defId: resolved.defId,
    playerKey: resolved.playerKey,
    playerName: resolved.playerName,
    team: resolved.team,
    rank: resolved.rank,
    rarity: partial.rarity || "common",
    foil: partial.foil || "normal",
    edition: resolved.edition,
    number: resolved.number,
    cardNumber: resolved.cardNumber,
    cycle: resolved.cycle,
    season: resolved.season,
    specialImageUrl: resolved.specialImageUrl || null,
    description: resolved.description || "",
    achievements: resolved.achievements || [],
    customName: resolved.customName || null,
    obtainedAt: partial.obtainedAt || new Date().toISOString(),
    packId: packId || partial.packId || null,
    source: partial.source || "pack"
  };
}

/** Chave estável de pilha: mesma def + raridade + foil = mesma stack no Firebase */
function cardStackKey(partial) {
  const defId = partial.defId || catalogDefId(partial.playerKey, partial.edition || "BASE");
  const rarity = (partial.rarity || "common").toLowerCase();
  const foil = (partial.foil === "holo" ? "holo" : "normal");
  return defId + "|" + rarity + "|" + foil;
}

/** ID de armazenamento da pilha (estável, sem card_ aleatório) */
function cardStackId(partial) {
  const key = cardStackKey(partial);
  // slug seguro para path Firebase
  return "stack_" + key.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 120);
}

/**
 * Soma cartas no inventário empilhando no banco.
 * Escreve em `updates` paths Firebase: cards/inventory/{ownerId}/{stackId}
 * Não apaga cartas — só cria/atualiza pilhas.
 */
function applyStackedCardGains(ownerId, cardPartials, updates, packId) {
  if (!ownerId || !cardPartials || !cardPartials.length) return;
  const inv = { ...((window.AppState.cards?.inventory || {})[ownerId] || {}) };
  // também considera o que já está neste mesmo batch de updates
  Object.keys(updates || {}).forEach(path => {
    const prefix = "cards/inventory/" + ownerId + "/";
    if (path.startsWith(prefix) && updates[path]) {
      inv[path.slice(prefix.length)] = updates[path];
    }
  });

  cardPartials.forEach(partial => {
    const record = buildCardRecord(partial, packId || partial.packId);
    const sid = cardStackId(record);
    const prev = inv[sid];
    const add = Math.max(1, Number(partial._addCount) || 1);
    if (prev && (prev.stacked || prev.count != null || prev.defId === record.defId)) {
      const next = {
        ...prev,
        ...record,
        count: (Number(prev.count) || 1) + add,
        stacked: true,
        obtainedAt: record.obtainedAt || prev.obtainedAt
      };
      inv[sid] = next;
      updates["cards/inventory/" + ownerId + "/" + sid] = next;
    } else {
      const next = { ...record, count: add, stacked: true };
      inv[sid] = next;
      updates["cards/inventory/" + ownerId + "/" + sid] = next;
    }
  });
}

/**
 * Consolida inventário solto (card_xxx) em pilhas stack_*.
 * Seguro: não reduz quantidade total; só junta iguais.
 * Atualiza slots de vitrine que apontavam para cardIds antigos.
 */
async function consolidateOwnerInventory(ownerId) {
  if (!ownerId || !window.marketDb) return { stacks: 0, removed: 0 };
  const snap = await window.marketDb.ref("cards/inventory/" + ownerId).once("value");
  const inv = snap.val() || {};
  const groups = {};
  Object.entries(inv).forEach(([id, c]) => {
    if (!c || typeof c !== "object") return;
    const key = cardStackKey(c);
    if (!groups[key]) groups[key] = { ids: [], sample: c, count: 0 };
    groups[key].ids.push(id);
    groups[key].count += Math.max(1, Number(c.count) || 1);
    // preferir sample que já é stack / tem mais dados
    if (c.stacked || (c.specialImageUrl && !groups[key].sample.specialImageUrl)) {
      groups[key].sample = c;
    }
  });

  const updates = {};
  let removed = 0;
  const idMap = {}; // oldCardId -> stackId

  Object.entries(groups).forEach(([key, g]) => {
    const sid = cardStackId(g.sample);
    const record = {
      ...buildCardRecord(g.sample),
      count: g.count,
      stacked: true,
      obtainedAt: g.sample.obtainedAt || new Date().toISOString()
    };
    updates["cards/inventory/" + ownerId + "/" + sid] = record;
    g.ids.forEach(oldId => {
      idMap[oldId] = sid;
      if (oldId !== sid) {
        updates["cards/inventory/" + ownerId + "/" + oldId] = null;
        removed++;
      }
    });
  });

  // Vitrine humana: trocar cardIds antigos pelo stackId
  const scSnap = await window.marketDb.ref("cards/showcases/" + ownerId).once("value");
  const sc = scSnap.val();
  if (sc && Array.isArray(sc.slots)) {
    const newSlots = sc.slots.map(slot => {
      if (!slot) return null;
      if (typeof slot === "string" && idMap[slot]) return idMap[slot];
      return slot;
    });
    updates["cards/showcases/" + ownerId + "/slots"] = newSlots;
  }

  await window.marketDb.ref().update(updates);
  return { stacks: Object.keys(groups).length, removed };
}

function inventoryList(ownerId) {
  const inv = (window.AppState.cards?.inventory || {})[ownerId] || {};
  return Object.entries(inv).map(([id, c]) => ({
    cardId: id,
    ...c,
    count: Math.max(1, Number(c.count) || 1)
  }));
}

/** Agrupa cópias por defId + rarity + foil (exibição inventário) — respeita count das pilhas */
function inventoryGrouped(ownerId) {
  const list = inventoryList(ownerId);
  const map = {};
  list.forEach(c => {
    const defId = c.defId || catalogDefId(c.playerKey, c.edition || "BASE");
    const key = defId + "|" + (c.rarity || "common") + "|" + (c.foil || "normal");
    const n = Math.max(1, Number(c.count) || 1);
    if (!map[key]) {
      map[key] = { ...c, defId, count: 0, copies: [] };
    }
    map[key].count += n;
    map[key].copies.push(c.cardId);
  });
  return Object.values(map).sort((a, b) => {
    const ra = window.CARDS.RARITY[b.rarity]?.order || 0;
    const rb = window.CARDS.RARITY[a.rarity]?.order || 0;
    return ra - rb || (a.number || 999) - (b.number || 999);
  });
}

function countByRarity(cards) {
  const out = { common: 0, rare: 0, epic: 0, legend: 0 };
  (cards || []).forEach(c => {
    const n = Math.max(1, Number(c.count) || 1);
    if (out[c.rarity] != null) out[c.rarity] += n;
  });
  return out;
}

/** defs descobertos = set de defId no inventário (qualquer raridade) */
function discoveredDefIds(ownerId) {
  const set = new Set();
  inventoryList(ownerId).forEach(c => {
    set.add(c.defId || catalogDefId(c.playerKey, c.edition || "BASE"));
  });
  return set;
}

function carddexEntries(ownerId) {
  const catalog = getCatalogMap();
  const specials = getSpecialsMap();
  const discovered = discoveredDefIds(ownerId);
  const entries = [];

  Object.values(catalog).forEach(c => {
    const defId = c.defId || catalogDefId(c.playerKey, c.edition || "BASE");
    entries.push({
      ...resolveCardDef(c),
      defId,
      discovered: discovered.has(defId),
      kind: "base"
    });
  });
  Object.entries(specials).forEach(([id, s]) => {
    if (s.active === false) return;
    const defId = s.defId || id;
    entries.push({
      ...resolveCardDef({ ...s, defId }),
      defId,
      discovered: discovered.has(defId),
      kind: "special"
    });
  });

  entries.sort((a, b) => (a.number || 9999) - (b.number || 9999));
  return entries;
}

function validateCodePayload(code) {
  if (!code || code.used) return { ok: false, error: "Código inválido ou já usado" };
  if (code.expiresAt && new Date(code.expiresAt).getTime() < Date.now()) {
    return { ok: false, error: "Código expirado" };
  }
  return { ok: true };
}

/**
 * Garante catálogo BASE com números estáveis JL-xxx.
 * Só cria entradas novas; não renumerar existentes.
 */
function buildBaseCatalogEntries(existingCatalog) {
  const existing = existingCatalog || {};
  const usedNumbers = new Set(
    Object.values(existing).map(c => Number(c.number)).filter(n => !isNaN(n) && n > 0)
  );
  let next = 1;
  while (usedNumbers.has(next)) next++;

  const players = cardsPlayerPool().slice().sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const updates = {};
  const cycle = cardsCycleLabel();
  const season = cardsSettings().seasonId || window.AppState?.jet?.currentSeason || "";

  players.forEach(p => {
    const defId = catalogDefId(p.key, "BASE");
    if (existing[defId]) return;
    while (usedNumbers.has(next)) next++;
    updates[defId] = {
      defId,
      playerKey: p.key,
      playerName: p.name,
      team: p.club,
      rank: p.rank || "—",
      edition: "BASE",
      number: next,
      cycle,
      season,
      createdAt: new Date().toISOString()
    };
    usedNumbers.add(next);
    next++;
  });
  return updates;
}

window.getCatalogMap = getCatalogMap;
window.getSpecialsMap = getSpecialsMap;
window.resolveCardDef = resolveCardDef;
window.openPackResults = openPackResults;
window.buildCardRecord = buildCardRecord;
window.cardStackKey = cardStackKey;
window.cardStackId = cardStackId;
window.applyStackedCardGains = applyStackedCardGains;
window.consolidateOwnerInventory = consolidateOwnerInventory;
window.inventoryList = inventoryList;
window.inventoryGrouped = inventoryGrouped;
window.countByRarity = countByRarity;
window.discoveredDefIds = discoveredDefIds;
window.carddexEntries = carddexEntries;
window.validateCodePayload = validateCodePayload;
window.buildBaseCatalogEntries = buildBaseCatalogEntries;
window.pickRandomPlayer = pickRandomPlayer;
