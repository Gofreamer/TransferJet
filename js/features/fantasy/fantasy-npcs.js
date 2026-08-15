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

/** Monta elenco válido respeitando orçamento e máx 2/time */
function buildNpcSquad(strategy, superfanTeam, budget) {
  const settings = fantasySettings();
  const maxPerTeam = settings.maxPerTeam || 2;
  const ranked = rankPlayersForStrategy(strategy, superfanTeam);
  const starters = [];
  const teamCount = {};
  let spent = 0;
  const budgetCap = budget ?? settings.budgetInitial ?? 5000000;

  for (const p of ranked) {
    if (starters.length >= 5) break;
    const price = p.marketValue || 0;
    if (spent + price > budgetCap) continue;
    if ((teamCount[p.club] || 0) >= maxPerTeam) continue;
    starters.push(p.key);
    teamCount[p.club] = (teamCount[p.club] || 0) + 1;
    spent += price;
  }

  // bench: próximo barato válido
  let bench = null;
  for (const p of ranked) {
    if (starters.includes(p.key)) continue;
    const price = p.marketValue || 0;
    if (spent + price > budgetCap) continue;
    if ((teamCount[p.club] || 0) >= maxPerTeam) continue;
    bench = p.key;
    spent += price;
    break;
  }

  while (starters.length < 5) starters.push(null);

  const captainKey = starters.filter(Boolean).sort((a, b) => {
    const map = fantasyPlayerMap();
    return (map[b]?.marketValue || 0) - (map[a]?.marketValue || 0);
  })[0] || null;

  const squad = { starters, bench, captainKey };
  const budgetRemaining = budgetCap - spent;
  return { squad, budgetRemaining, spent };
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
      value: Number(p.marketValue || 0),
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
    spent += Number(p.marketValue || 0);
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
      `${a.key} | ${a.name} | equipe=${a.team} | valor=${a.value} | WR=${a.winRate} | P=${a.matches} | V=${a.wins} | D=${a.losses} | rank=${a.rank || "-"}`
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
