/* Jet Fantasy — 10 NPCs + escalação determinística (+ Gemini opcional) */
window.FANTASY = window.FANTASY || {};

window.FANTASY.NPC_SEED = [
  { id: "npc_orion", displayName: "Orion Stats", teamName: "Data FC", strategy: "analyst", avatar: "📊" },
  { id: "npc_zebra", displayName: "Luna Underdog", teamName: "Upset United", strategy: "underdog", avatar: "🦓" },
  { id: "npc_safe", displayName: "Victor Steady", teamName: "Safe Harbor", strategy: "conservative", avatar: "🛡️" },
  { id: "npc_bargain", displayName: "Nina Value", teamName: "Bargain FC", strategy: "value", avatar: "💎" },
  { id: "npc_asgard", displayName: "Kai Asgardian", teamName: "Asgard Faithful", strategy: "superfan", superfanTeam: "Asgard", avatar: "⚔️" },
  { id: "npc_max", displayName: "Rex Ceiling", teamName: "All-In XI", strategy: "aggressive", avatar: "🔥" },
  { id: "npc_stars", displayName: "Stella Prime", teamName: "Galácticos", strategy: "stars", avatar: "⭐" },
  { id: "npc_balance", displayName: "Leo Balance", teamName: "Midfield Masters", strategy: "balanced", avatar: "⚖️" },
  { id: "npc_form", displayName: "Faye Hotstreak", teamName: "Form Factory", strategy: "form", avatar: "📈" },
  { id: "npc_chaos", displayName: "Jax Wild", teamName: "Chaos Theory", strategy: "chaos", avatar: "🎲" }
];

function rankPlayersForStrategy(strategy, superfanTeam) {
  let list = (typeof getAllPlayersFlat === "function" ? getAllPlayersFlat() : [])
    .filter(p => p.marketValue > 0 && p.club && p.club !== "Livre");

  const wr = p => p.stats?.winRate || 0;
  const vol = p => p.stats?.P || 0;
  const val = p => p.marketValue || 0;

  switch (strategy) {
    case "analyst":
      list.sort((a, b) => (wr(b) * Math.log10(vol(b) + 2)) - (wr(a) * Math.log10(vol(a) + 2)) || val(b) - val(a));
      break;
    case "underdog":
      list.sort((a, b) => val(a) - val(b) || wr(b) - wr(a));
      break;
    case "conservative":
      list.sort((a, b) => (vol(b) >= 3 ? wr(b) : 0) - (vol(a) >= 3 ? wr(a) : 0) || val(b) - val(a));
      break;
    case "value":
      list.sort((a, b) => {
        const sa = wr(a) / Math.max(val(a), 1);
        const sb = wr(b) / Math.max(val(b), 1);
        return sb - sa;
      });
      break;
    case "superfan":
      list.sort((a, b) => {
        const pa = a.club === superfanTeam ? 1 : 0;
        const pb = b.club === superfanTeam ? 1 : 0;
        return pb - pa || val(b) - val(a);
      });
      break;
    case "aggressive":
    case "stars":
      list.sort((a, b) => val(b) - val(a));
      break;
    case "form":
      list.sort((a, b) => wr(b) - wr(a) || vol(b) - vol(a));
      break;
    case "chaos":
      list = list.filter(p => val(p) < 2000000).sort(() => Math.random() - 0.5);
      break;
    case "balanced":
    default:
      list.sort((a, b) => (val(b) * 0.5 + wr(b) * 1000000) - (val(a) * 0.5 + wr(a) * 1000000));
  }
  return list;
}

/** Retorna os agentes elegíveis do Fantasy. */
function fantasyEligiblePlayers() {
  return (typeof getAllPlayersFlat === "function" ? getAllPlayersFlat() : [])
    .filter(p => p && p.key && Number(p.marketValue || 0) > 0 && p.club && p.club !== "Livre");
}

/**
 * Completa uma seleção com os agentes mais baratos possíveis, respeitando máx/time.
 * Como os custos são positivos e há apenas um limite por equipe, esse preenchimento
 * também serve como teste de viabilidade para reservar orçamento aos slots restantes.
 */
function cheapestNpcCompletion(selectedKeys, teamCountInput, slotsNeeded, budgetRemaining) {
  if (slotsNeeded <= 0) return [];
  const maxPerTeam = Number(fantasySettings().maxPerTeam || 2);
  const selected = new Set(selectedKeys || []);
  const teamCount = { ...(teamCountInput || {}) };
  const candidates = fantasyEligiblePlayers()
    .filter(p => !selected.has(p.key))
    .sort((a, b) => playerPrice(a.key) - playerPrice(b.key));

  const picked = [];
  let spent = 0;
  for (const p of candidates) {
    if (picked.length >= slotsNeeded) break;
    if ((teamCount[p.club] || 0) >= maxPerTeam) continue;
    const price = Number(playerPrice(p.key) || 0);
    if (spent + price > Number(budgetRemaining || 0)) continue;
    picked.push(p);
    spent += price;
    teamCount[p.club] = (teamCount[p.club] || 0) + 1;
  }
  return picked.length === slotsNeeded ? picked : null;
}

function auditNpcSquad(squad, budgetCap) {
  const normalized = typeof normalizeFantasySquad === "function" ? normalizeFantasySquad(squad) : squad;
  const starters = normalized?.starters || [];
  const bench = normalized?.bench || null;
  const captainKey = normalized?.captainKey || null;
  const all = [...starters, bench].filter(Boolean);
  const map = fantasyPlayerMap();
  const maxPerTeam = Number(fantasySettings().maxPerTeam || 2);
  const cap = Number(budgetCap ?? fantasySettings().budgetInitial ?? 5000000);
  const errors = [];

  if (starters.filter(Boolean).length !== 5) errors.push("precisa de 5 titulares");
  if (!bench) errors.push("precisa de 1 reserva");
  if (all.length !== 6 || new Set(all).size !== 6) errors.push("os 6 agentes devem ser únicos");
  if (!captainKey || !starters.includes(captainKey)) errors.push("capitão precisa ser titular");

  const teams = {};
  let spent = 0;
  for (const key of all) {
    const p = map[key];
    if (!p) { errors.push(`agente inexistente: ${key}`); continue; }
    const price = Number(playerPrice(p.key) || 0);
    if (price <= 0 || !p.club || p.club === "Livre") errors.push(`agente inelegível: ${key}`);
    spent += price;
    teams[p.club] = (teams[p.club] || 0) + 1;
    if (teams[p.club] > maxPerTeam) errors.push(`mais de ${maxPerTeam} agentes de ${p.club}`);
  }
  if (spent > cap) errors.push(`ultrapassa orçamento em ${spent - cap}`);

  return {
    valid: errors.length === 0,
    errors: [...new Set(errors)],
    spent,
    budgetRemaining: Math.max(0, cap - spent),
    count: all.length,
    squad: normalized
  };
}

/** Monta SEMPRE 5 titulares + 1 reserva quando existir combinação possível dentro do orçamento. */
function buildNpcSquad(strategy, superfanTeam, budget) {
  const settings = fantasySettings();
  const maxPerTeam = Number(settings.maxPerTeam || 2);
  const ranked = rankPlayersForStrategy(strategy, superfanTeam);
  const budgetCap = Number(budget ?? settings.budgetInitial ?? 5000000);
  const selected = [];
  const teamCount = {};
  let spent = 0;

  // Só aceita uma escolha estratégica se ainda houver dinheiro suficiente para
  // completar TODOS os slots restantes com uma combinação válida.
  for (const p of ranked) {
    if (selected.length >= 6) break;
    if (!p?.key || selected.some(x => x.key === p.key)) continue;
    if ((teamCount[p.club] || 0) >= maxPerTeam) continue;
    const price = Number(playerPrice(p.key) || 0);
    if (spent + price > budgetCap) continue;

    const tentativeTeams = { ...teamCount, [p.club]: (teamCount[p.club] || 0) + 1 };
    const tentativeKeys = [...selected.map(x => x.key), p.key];
    const remainingSlots = 6 - tentativeKeys.length;
    const canFinish = remainingSlots === 0 || cheapestNpcCompletion(
      tentativeKeys,
      tentativeTeams,
      remainingSlots,
      budgetCap - spent - price
    );
    if (!canFinish) continue;

    selected.push(p);
    spent += price;
    teamCount[p.club] = (teamCount[p.club] || 0) + 1;
  }

  // Se a personalidade não preencheu tudo, completa com os mais baratos válidos.
  if (selected.length < 6) {
    const fill = cheapestNpcCompletion(
      selected.map(x => x.key),
      teamCount,
      6 - selected.length,
      budgetCap - spent
    );
    if (fill) {
      for (const p of fill) {
        selected.push(p);
        spent += Number(playerPrice(p.key) || 0);
        teamCount[p.club] = (teamCount[p.club] || 0) + 1;
      }
    }
  }

  // Último fallback: ignora a preferência estratégica e encontra o sexteto
  // mais barato possível. Se nem isso couber, o orçamento é matematicamente inviável.
  if (selected.length !== 6) {
    selected.length = 0;
    spent = 0;
    Object.keys(teamCount).forEach(k => delete teamCount[k]);
    const cheapest = cheapestNpcCompletion([], {}, 6, budgetCap);
    if (cheapest) {
      for (const p of cheapest) {
        selected.push(p);
        spent += Number(playerPrice(p.key) || 0);
        teamCount[p.club] = (teamCount[p.club] || 0) + 1;
      }
    }
  }

  const starters = selected.slice(0, 5).map(p => p.key);
  const bench = selected[5]?.key || null;
  while (starters.length < 5) starters.push(null);

  // Capitão segue a preferência do NPC entre os 5 titulares; em empate, maior valor.
  const rankIndex = new Map(ranked.map((p, i) => [p.key, i]));
  const captainKey = starters.filter(Boolean).sort((a, b) => {
    const ra = rankIndex.has(a) ? rankIndex.get(a) : 999999;
    const rb = rankIndex.has(b) ? rankIndex.get(b) : 999999;
    if (ra !== rb) return ra - rb;
    const map = fantasyPlayerMap();
    return Number(map[b]?.marketValue || 0) - Number(map[a]?.marketValue || 0);
  })[0] || null;

  const squad = { starters, bench, captainKey };
  const audit = auditNpcSquad(squad, budgetCap);
  return {
    squad,
    spent: audit.spent,
    budgetRemaining: audit.budgetRemaining,
    valid: audit.valid,
    errors: audit.errors
  };
}

function createNpcParticipant(seed) {
  const budget = fantasySettings().budgetInitial || 5000000;
  const built = buildNpcSquad(seed.strategy, seed.superfanTeam, budget);
  return {
    type: "npc",
    displayName: seed.displayName,
    teamName: seed.teamName,
    avatar: seed.avatar || "🤖",
    active: true,
    strategy: seed.strategy,
    superfanTeam: seed.superfanTeam || null,
    budgetRemaining: built.budgetRemaining,
    squad: built.squad,
    acquisitions: {},
    inviteCode: null,
    lastComment: null
  };
}

function buildNpcAIContext() {
  const settings = fantasySettings();
  const roundId = settings.currentRoundId;
  const round = (window.AppState.fantasy?.rounds || {})[roundId] || {};
  const season = round.seasonId || settings.seasonId || window.AppState.jet?.currentSeason || null;
  const roundNumber = Number(round.rodadaNumber || 0);
  const matches = (typeof getMatchesForRound === "function" && roundNumber)
    ? getMatchesForRound(season, roundNumber)
    : [];

  const agents = (typeof getAllPlayersFlat === "function" ? getAllPlayersFlat() : [])
    .filter(p => p && p.key && p.marketValue > 0 && p.club && p.club !== "Livre")
    .map(p => ({
      key: p.key,
      name: p.name || p.nome || p.key,
      team: p.club,
      officialValue: Number(p.marketValue || 0),
      fantasyPrice: Number(playerPrice(p.key) || 0),
      winRate: Number(p.stats?.winRate || 0),
      matches: Number(p.stats?.P || 0),
      wins: Number(p.stats?.V || 0),
      losses: Number(p.stats?.D || 0),
      rank: p.rank || null
    }));

  const fixtures = matches.map(m => ({
    home: m.timeA || m.teamA || m.mandante || m.homeTeam || null,
    away: m.timeB || m.teamB || m.visitante || m.awayTeam || null,
    status: m.status || null
  })).filter(m => m.home || m.away);

  return { roundId, season, roundNumber, fixtures, agents };
}

function validateNpcAISquad(parsed, budget) {
  if (!parsed || typeof parsed !== "object") return null;

  const settings = fantasySettings();
  const maxPerTeam = Number(settings.maxPerTeam || 2);
  const budgetCap = Number(budget ?? settings.budgetInitial ?? 5000000);
  const map = fantasyPlayerMap();

  const starters = Array.isArray(parsed.starters) ? parsed.starters.map(String) : [];
  const bench = parsed.bench != null ? String(parsed.bench) : null;
  const captainKey = parsed.captainKey != null ? String(parsed.captainKey) : null;

  if (starters.length !== 5 || starters.some(k => !k)) return null;
  if (!bench || !captainKey) return null;

  const all = [...starters, bench];
  if (new Set(all).size !== 6) return null;
  if (!starters.includes(captainKey)) return null;
  if (all.some(k => !map[k] || !map[k].club || map[k].club === "Livre" || Number(map[k].marketValue || 0) <= 0)) return null;

  const teamCount = {};
  let spent = 0;
  for (const key of all) {
    const p = map[key];
    teamCount[p.club] = (teamCount[p.club] || 0) + 1;
    if (teamCount[p.club] > maxPerTeam) return null;
    spent += Number(playerPrice(p.key) || 0);
  }
  if (spent > budgetCap) return null;

  return {
    squad: { starters, bench, captainKey },
    spent,
    budgetRemaining: budgetCap - spent,
    comment: typeof parsed.comment === "string" ? parsed.comment.trim().slice(0, 240) : null
  };
}

async function generateNpcSquadWithAI(seed, context, budget) {
  const gen = window.generateWithAI || window.marketGenerateWithAI || window.jetMarketGenerateAI;
  if (typeof gen !== "function") return null;
  if (fantasySettings().geminiEnabled === false) return null;

  const budgetCap = Number(budget ?? fantasySettings().budgetInitial ?? 5000000);
  const maxPerTeam = Number(fantasySettings().maxPerTeam || 2);
  const ctx = context || buildNpcAIContext();

  try {
    const strategy = window.FANTASY.STRATEGIES?.[seed.strategy];
    const agentsText = (ctx.agents || []).map(a =>
      `${a.key} | ${a.name} | equipe=${a.team} | precoFantasy=${a.fantasyPrice} | valorOficial=${a.officialValue} | WR=${a.winRate} | P=${a.matches} | V=${a.wins} | D=${a.losses} | rank=${a.rank || "-"}`
    ).join("\n");
    const fixturesText = (ctx.fixtures || []).length
      ? ctx.fixtures.map(f => `${f.home || "?"} vs ${f.away || "?"}`).join("\n")
      : "Confrontos não disponíveis; use os dados oficiais dos agentes e a personalidade do NPC.";

    const prompt = `Você administra uma equipe no Jet Fantasy da Jet League.
NPC: ${seed.displayName}
Equipe Fantasy: ${seed.teamName}
Estratégia: ${strategy?.label || seed.strategy} — ${strategy?.desc || ""}
${seed.superfanTeam ? `Equipe favorita: ${seed.superfanTeam}` : ""}
Temporada: ${ctx.season || "-"}
Rodada: ${ctx.roundNumber || "-"}
Orçamento TOTAL para os 6 agentes: ${budgetCap}
Regras obrigatórias: exatamente 5 titulares + 1 reserva; 6 agentes diferentes; máximo ${maxPerTeam} agentes da mesma equipe; capitão deve ser um dos 5 titulares; não ultrapassar o orçamento.
Escolha de acordo com a personalidade do NPC. Você pode assumir riscos, mas nunca quebrar as regras.
Use SOMENTE os valores exatos do campo key fornecidos abaixo. Não use nomes no lugar das keys.

Confrontos da rodada:
${fixturesText}

Agentes disponíveis (key | nome | dados):
${agentsText}

Responda APENAS JSON válido, sem markdown e sem texto fora do JSON, neste formato:
{"starters":["key1","key2","key3","key4","key5"],"bench":"key6","captainKey":"key1","comment":"comentário curto em português explicando a aposta"}`;

    const timeoutMs = 18000;
    const text = await Promise.race([
      gen(prompt, "gemini-3.6-flash"),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout Gemini NPC")), timeoutMs))
    ]);

    const raw = String(text || "").trim();
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const parsed = JSON.parse(m[0]);
    return validateNpcAISquad(parsed, budgetCap);
  } catch (e) {
    console.warn("[Fantasy NPC AI]", seed?.id || seed?.displayName, e);
    return null;
  }
}

async function buildNpcSquadSmart(seed, budget, context) {
  const budgetCap = Number(budget ?? fantasySettings().budgetInitial ?? 5000000);
  const aiBuilt = await generateNpcSquadWithAI(seed, context || buildNpcAIContext(), budgetCap);
  if (aiBuilt) return { ...aiBuilt, source: "gemini" };
  const fallback = buildNpcSquad(seed.strategy, seed.superfanTeam, budgetCap);
  return { ...fallback, comment: null, source: "deterministic" };
}

window.buildNpcSquad = buildNpcSquad;
window.createNpcParticipant = createNpcParticipant;
window.generateNpcSquadWithAI = generateNpcSquadWithAI;
window.buildNpcSquadSmart = buildNpcSquadSmart;
window.buildNpcAIContext = buildNpcAIContext;
window.validateNpcAISquad = validateNpcAISquad;
window.rankPlayersForStrategy = rankPlayersForStrategy;
window.auditNpcSquad = auditNpcSquad;
window.cheapestNpcCompletion = cheapestNpcCompletion;
window.fantasyEligiblePlayers = fantasyEligiblePlayers;
