/* Jet Fantasy — painel Admin */
function fxAdminAuditParticipantSquad(p) {
  const budget = Number(fantasySettings().budgetInitial || 5000000);
  if (typeof auditNpcSquad === "function") return auditNpcSquad(p?.squad, budget);
  const squad = typeof normalizeFantasySquad === "function" ? normalizeFantasySquad(p?.squad) : (p?.squad || {});
  const map = fantasyPlayerMap();
  const keys = [...(squad.starters || []), squad.bench].filter(Boolean);
  const spent = keys.reduce((sum, key) => sum + Number(typeof playerPrice === "function" ? playerPrice(key) : map[key]?.marketValue || 0), 0);
  return { valid: keys.length === 6 && new Set(keys).size === 6, count: keys.length, spent, budgetRemaining: Math.max(0, budget - spent), errors: [] };
}

function fxAdminMoney(value) {
  return typeof formatUSD === "function" ? formatUSD(Number(value || 0), true) : Number(value || 0).toLocaleString("pt-BR");
}

function renderFantasyAdmin() {
  const el = document.getElementById("adminTabContent");
  if (!el) return;
  ensureFantasyState();
  const s = fantasySettings();
  const parts = window.AppState.fantasy.participants || {};
  const humans = Object.entries(parts).filter(([,p]) => p && p.type !== "npc");
  const npcs = Object.entries(parts).filter(([,p]) => p && p.type === "npc");
  const rounds = Object.values(window.AppState.fantasy.rounds || {}).sort((a,b)=>(a.rodadaNumber||0)-(b.rodadaNumber||0));
  const open = isFantasyMarketOpen();
  const currentRoundNumber = Number((window.AppState.fantasy.rounds || {})[s.currentRoundId || ""]?.rodadaNumber)
    || Number(String(s.currentRoundId || "").replace(/\D+/g, ""))
    || 1;

  el.innerHTML = `
    <h3 class="admin-section-title">Jet Fantasy · Controle</h3>
    <p class="admin-sub">Mercado: <strong>${open ? "ABERTO" : "FECHADO"}</strong> · Status settings: ${s.marketStatus} · Rodada atual: ${s.currentRoundId || "—"}</p>

    <div class="admin-actions" style="flex-wrap:wrap;gap:8px;margin-bottom:16px">
      <button class="btn-primary btn-sm" onclick="fxAdminOpenMarket()">Abrir mercado</button>
      <button class="btn-gray btn-sm" onclick="fxAdminCloseMarket()">Fechar mercado</button>
      <button class="btn-ai btn-sm" onclick="fxAdminSeed()">Seed / reset NPCs (10)</button>
      <button class="btn-primary btn-sm" onclick="fxAdminRebuildNpcs()">Remontar escalações NPC</button>
      <button class="btn-gray btn-sm" onclick="fxAdminRepairData()">Reparar dados Fantasy</button>
      <button class="btn-danger btn-sm" onclick="fxAdminResetAll()">Resetar Fantasy inteiro</button>
    </div>

    <h3 class="admin-section-title">Configuração</h3>
    <div class="admin-form-grid">
      <div>
        <label>Zebra threshold (ex: 0.20 = 20%)</label>
        <input type="number" step="0.01" min="0.05" max="0.5" id="fxZebra" value="${s.zebraThreshold ?? 0.2}">
      </div>
      <div>
        <label>Fecha em (ISO ou datetime-local)</label>
        <input type="datetime-local" id="fxClosesAt" value="${s.marketClosesAt ? toLocalInput(s.marketClosesAt) : ""}">
      </div>
      <div>
        <label>Rodada atual</label>
        <input type="number" min="1" step="1" id="fxRoundNum" value="${currentRoundNumber}">
        <small style="display:block;margin-top:5px;color:var(--text-muted)">O ID interno é gerado automaticamente (ex.: 12 → r12) e a mesma rodada é usada para buscar a Jet League.</small>
      </div>
      <div>
        <label>Temporada</label>
        <input type="text" id="fxSeason" value="${s.seasonId || window.AppState.jet.currentSeason || ""}">
      </div>
    </div>
    <div class="admin-actions" style="margin-top:10px">
      <button class="btn-primary btn-sm" onclick="fxAdminSaveConfig()">Salvar config</button>
    </div>
    <p class="admin-sub" style="margin-top:8px">Economia Fantasy: os preços usam <strong>10% do valor oficial do TransferJet</strong> (arredondado), mantendo o orçamento de US$ 5M viável para 6 agentes. O valor oficial continua intacto.</p>

    <h3 class="admin-section-title" style="margin-top:24px">Participantes humanos</h3>
    <div class="admin-form-grid">
      <div><label>Nick</label><input type="text" id="fxNewNick" placeholder="Ex: Richa"></div>
      <div><label>Nome do time Fantasy</label><input type="text" id="fxNewTeam" placeholder="Ex: Dark Side"></div>
      <div><label>Código de convite</label><input type="text" id="fxNewCode" placeholder="Ex: JET-RICHA"></div>
    </div>
    <div class="admin-actions" style="margin-top:8px">
      <button class="btn-primary btn-sm" onclick="fxAdminAddHuman()">Cadastrar jogador</button>
    </div>
    <div class="admin-table-wrap" style="margin-top:12px">
      <table class="admin-table">
        <thead><tr><th>Nick</th><th>Time</th><th>Código</th><th>Orçamento</th><th></th></tr></thead>
        <tbody>
          ${humans.map(([id,p]) => `
            <tr>
              <td>${p.displayName}</td>
              <td>${p.teamName||""}</td>
              <td><code>${p.inviteCode||"—"}</code></td>
              <td>${typeof formatUSD==="function"?formatUSD(p.budgetRemaining||0,true):p.budgetRemaining}</td>
              <td><button class="btn-gray btn-sm" onclick="fxAdminDeletePart('${id}')">Excluir</button></td>
            </tr>
          `).join("") || "<tr><td colspan='5'>Nenhum humano ainda</td></tr>"}
        </tbody>
      </table>
    </div>

    <h3 class="admin-section-title" style="margin-top:24px">NPCs (${npcs.length})</h3>
    <p class="admin-sub">Todos os NPCs ativos são obrigados a ter <strong>5 titulares + 1 reserva</strong> dentro do orçamento total de <strong>${fxAdminMoney(s.budgetInitial || 5000000)}</strong>. “Saldo” é apenas o dinheiro que sobrou depois das compras.</p>
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead><tr><th></th><th>Nome</th><th>Estratégia</th><th>Ativo</th><th>Escalação</th><th>Gasto</th><th>Saldo</th><th></th></tr></thead>
        <tbody>
          ${npcs.map(([id,p]) => {
            const audit = fxAdminAuditParticipantSquad(p);
            const statusColor = audit.valid ? "var(--green, #4ade80)" : "var(--red, #fb7185)";
            return `
            <tr>
              <td>${p.avatar||""}</td>
              <td>${p.displayName}<br><small>${p.teamName||""}</small></td>
              <td>${p.strategy}${p.superfanTeam?" · "+p.superfanTeam:""}<br><small>${p.lastSquadSource === "gemini" ? "Gemini" : p.lastSquadSource === "deterministic" ? "Fallback" : "—"}</small></td>
              <td>
                <button class="btn-sm ${p.active!==false?"btn-primary":"btn-gray"}" onclick="fxAdminToggleNpc('${id}', ${p.active===false})">
                  ${p.active===false?"Off":"On"}
                </button>
              </td>
              <td style="font-weight:800;color:${statusColor}">${audit.valid ? "✓ 6/6" : `⚠ ${audit.count}/6`}</td>
              <td>${fxAdminMoney(audit.spent)}</td>
              <td>${fxAdminMoney(audit.budgetRemaining)}</td>
              <td><button class="btn-gray btn-sm" onclick="fxAdminViewNpcSquad('${id}')">Ver escalação</button></td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>

    <h3 class="admin-section-title" style="margin-top:24px">Processar rodada</h3>
    <p class="admin-sub">Usa partidas oficiais da Jet League (fights + placar + MVP + destaque). Revise o preview antes de confirmar.</p>
    <div class="admin-actions" style="gap:8px;flex-wrap:wrap">
      <button class="btn-primary" onclick="fxAdminPreviewProcess()">Analisar e revisar pontuação</button>
      <button class="btn-gray btn-sm" onclick="fxAdminCreateRound()">Criar/atualizar rodada atual</button>
    </div>
    <div id="fxAdminProcessStatus" style="margin-top:10px;font-size:0.85rem;color:var(--text-muted)"></div>
  `;
}

function toLocalInput(iso) {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const pad = n => String(n).padStart(2,"0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch { return ""; }
}

async function fxAdminOpenMarket() {
  await saveFantasySettings({ marketStatus: "OPEN" });
  alert("Mercado ABERTO");
  renderFantasyAdmin();
}
async function fxAdminCloseMarket() {
  await saveFantasySettings({ marketStatus: "LOCKED" });
  alert("Mercado FECHADO");
  renderFantasyAdmin();
}

async function fxAdminSaveConfig() {
  const zebra = Number(document.getElementById("fxZebra")?.value) || 0.2;
  const closesRaw = document.getElementById("fxClosesAt")?.value;
  const marketClosesAt = closesRaw ? new Date(closesRaw).toISOString() : null;
  const seasonId = document.getElementById("fxSeason")?.value || window.AppState.jet.currentSeason;
  const rodadaNumber = Math.max(1, Math.floor(Number(document.getElementById("fxRoundNum")?.value) || 1));
  const currentRoundId = `r${rodadaNumber}`;

  await saveFantasySettings({ zebraThreshold: zebra, marketClosesAt, currentRoundId, seasonId });
  await window.marketDb.ref("fantasy/rounds/" + currentRoundId).update({
    id: currentRoundId,
    name: "Rodada " + rodadaNumber,
    seasonId,
    rodadaNumber,
    status: isFantasyMarketOpen() ? "OPEN" : "LOCKED"
  });
  alert("Config salva");
  renderFantasyAdmin();
}

async function fxAdminCreateRound() {
  await fxAdminSaveConfig();
}

async function fxAdminSeed() {
  if (!confirm("Isso (re)cria settings + 10 NPCs com novas escalações. Humanos não são apagados. Continuar?")) return;
  const season = window.AppState.jet.currentSeason || "Temporada 1";
  const existing = window.AppState.fantasy.participants || {};
  const humans = {};
  Object.entries(existing).forEach(([id, p]) => {
    if (p && p.type !== "npc") humans[id] = p;
  });
  const participants = { ...humans };
  (window.FANTASY.NPC_SEED || []).forEach(seed => {
    participants[seed.id] = createNpcParticipant(seed);
  });
  await window.marketDb.ref("fantasy/settings").update({
    ...window.FANTASY.DEFAULTS,
    seasonId: season,
    currentRoundId: "r1",
    marketStatus: "OPEN",
    seededAt: Date.now()
  });
  await window.marketDb.ref("fantasy/participants").set(participants);
  await window.marketDb.ref("fantasy/rounds/r1").update({
    id: "r1", name: "Rodada 1", seasonId: season, rodadaNumber: 1, status: "OPEN"
  });
  alert("Seed Fantasy aplicado (" + Object.keys(participants).length + " participantes)");
  renderFantasyAdmin();
}


async function fxAdminRepairData() {
  if (!confirm("Reparar dados do Fantasy?\n\nHumanos terão formatos antigos normalizados. NPCs incompletos ou acima do orçamento serão remontados para 5 titulares + 1 reserva dentro dos US$ 5M. Pontos e histórico não serão apagados.")) return;
  const parts = window.AppState.fantasy.participants || {};
  const budgetInitial = Number(fantasySettings().budgetInitial || 5000000);
  const updates = {};
  let normalizedCount = 0;
  let rebuiltNpcs = 0;

  for (const [id, raw] of Object.entries(parts)) {
    if (!raw) continue;
    const p = typeof normalizeFantasyParticipant === "function" ? normalizeFantasyParticipant(raw, id) : raw;

    if (p.type === "npc") {
      let audit = fxAdminAuditParticipantSquad(p);
      if (!audit.valid) {
        const built = buildNpcSquad(p.strategy, p.superfanTeam, budgetInitial);
        audit = typeof auditNpcSquad === "function" ? auditNpcSquad(built.squad, budgetInitial) : fxAdminAuditParticipantSquad({ squad: built.squad });
        if (!audit.valid) {
          throw new Error(`${p.displayName || id}: não foi possível montar 6 agentes dentro do orçamento. ${audit.errors.join(" · ")}`);
        }
        updates[id + "/squad"] = audit.squad;
        updates[id + "/budgetRemaining"] = audit.budgetRemaining;
        updates[id + "/lastSquadSource"] = "deterministic";
        updates[id + "/lastSquadGeneratedAt"] = Date.now();
        rebuiltNpcs++;
      } else {
        updates[id + "/squad"] = audit.squad;
        updates[id + "/budgetRemaining"] = audit.budgetRemaining;
      }
    } else {
      const humanSquad = p.squad || emptySquad();
      updates[id + "/squad"] = humanSquad;
      const currentCost = typeof squadCost === "function" ? Number(squadCost(humanSquad) || 0) : 0;
      updates[id + "/budgetRemaining"] = Math.max(0, budgetInitial - currentCost);
    }
    normalizedCount++;
  }

  if (Object.keys(updates).length) {
    await window.marketDb.ref("fantasy/participants").update(updates);
  }
  alert(`Dados reparados para ${normalizedCount} participante(s). NPCs remontados: ${rebuiltNpcs}.`);
  renderFantasyAdmin();
}

async function fxAdminResetAll() {
  const ok = confirm(
    "RESETAR TODO O JET FANTASY?\n\n" +
    "Isso volta todos ao início: orçamento inicial, elencos vazios dos humanos, NPCs recriados, Rodada 1, mercado aberto, scores e rankings zerados.\n\n" +
    "Os cadastros/códigos dos participantes humanos serão preservados. Esta ação não pode ser desfeita."
  );
  if (!ok) return;

  const settings = fantasySettings();
  const budget = Number(window.FANTASY.DEFAULTS.budgetInitial || 5000000);
  const season = settings.seasonId || window.AppState.jet.currentSeason || "Temporada 1";
  const existing = window.AppState.fantasy.participants || {};
  const participants = {};
  const resetAt = Date.now();

  // Preserva somente o cadastro do humano. Todo estado competitivo volta ao zero.
  Object.entries(existing).forEach(([id, p]) => {
    if (!p || p.type === "npc") return;
    participants[id] = {
      id: p.id || id,
      type: p.type || "human",
      displayName: p.displayName || id,
      teamName: p.teamName || "",
      inviteCode: p.inviteCode || "",
      avatar: p.avatar || "",
      active: p.active !== false,
      budgetRemaining: budget,
      squad: emptySquad(),
      acquisitions: {},
      totalPoints: 0,
      lastRoundPoints: 0,
      lastComment: null,
      lastSquadSource: null,
      resetAt
    };
  });

  // NPCs também recomeçam pelo construtor oficial do Fantasy.
  (window.FANTASY.NPC_SEED || []).forEach(seed => {
    const npc = createNpcParticipant(seed);
    participants[seed.id] = {
      ...npc,
      totalPoints: 0,
      lastRoundPoints: 0,
      lastComment: null,
      lastSquadSource: null,
      resetAt
    };
  });

  const freshSettings = {
    ...window.FANTASY.DEFAULTS,
    budgetInitial: budget,
    seasonId: season,
    currentRoundId: "r1",
    marketStatus: "OPEN",
    marketClosesAt: null,
    resetAt
  };

  const freshRounds = {
    r1: {
      id: "r1",
      name: "Rodada 1",
      seasonId: season,
      rodadaNumber: 1,
      status: "OPEN",
      locksAt: null,
      processedAt: null,
      jetMatchIds: [],
      analysisCache: null,
      resetAt
    }
  };

  try {
    // IMPORTANTE: não usar set("fantasy") aqui. As Database Rules concedem
    // permissões por subárvore; gravamos cada nó em seu caminho autorizado.
    await window.marketDb.ref("fantasy/settings").set(freshSettings);
    await window.marketDb.ref("fantasy/participants").set(participants);
    await window.marketDb.ref("fantasy/rounds").set(freshRounds);
    await window.marketDb.ref("fantasy/scores").remove();
    await window.marketDb.ref("fantasy/leaderboard").remove();

    // Confere o estado remoto antes de dizer ao mestre que o reset terminou.
    const [settingsSnap, participantsSnap, scoresSnap, leaderboardSnap] = await Promise.all([
      window.marketDb.ref("fantasy/settings").once("value"),
      window.marketDb.ref("fantasy/participants").once("value"),
      window.marketDb.ref("fantasy/scores").once("value"),
      window.marketDb.ref("fantasy/leaderboard").once("value")
    ]);

    const remoteSettings = settingsSnap.val() || {};
    const remoteParticipants = participantsSnap.val() || {};
    const badHuman = Object.entries(remoteParticipants).find(([, p]) => {
      if (!p || p.type === "npc") return false;
      const sq = typeof normalizeFantasySquad === "function" ? normalizeFantasySquad(p.squad) : p.squad;
      const hasSquad = sq && ([...(sq.starters || []), sq.bench].filter(Boolean).length > 0 || sq.captainKey);
      return Number(p.budgetRemaining) !== budget || Number(p.totalPoints || 0) !== 0 || Number(p.lastRoundPoints || 0) !== 0 || hasSquad;
    });

    if (remoteSettings.currentRoundId !== "r1" || scoresSnap.exists() || leaderboardSnap.exists() || badHuman) {
      throw new Error("O Firebase não confirmou que todos os dados competitivos foram zerados.");
    }

    // Atualiza a memória local imediatamente, sem esperar o próximo evento dos listeners.
    const f = ensureFantasyState();
    f.settings = freshSettings;
    f.participants = {};
    Object.entries(remoteParticipants).forEach(([id, p]) => {
      f.participants[id] = typeof normalizeFantasyParticipant === "function"
        ? normalizeFantasyParticipant(p, id)
        : p;
    });
    f.rounds = freshRounds;
    f.scores = {};
    f.leaderboard = { byRound: {}, overall: {} };

    document.dispatchEvent(new CustomEvent("fantasy:updated"));
    if (f.active && typeof renderFantasyShell === "function") renderFantasyShell();

    alert(`Fantasy resetado de verdade. Pontos, rankings, rodadas antigas e escalações humanas foram zerados. ${Object.keys(participants).length} participantes voltaram ao início.`);
    renderFantasyAdmin();
  } catch (err) {
    console.error("[Jet Fantasy] Falha no reset completo", err);
    alert(
      "Não foi possível concluir o reset completo do Fantasy.\n\n" +
      "Nada será tratado como concluído enquanto o Firebase não confirmar a limpeza.\n\n" +
      "Detalhe: " + (err?.message || err)
    );
  }
}

function fxAdminViewNpcSquad(id) {
  const p = (window.AppState.fantasy.participants || {})[id];
  if (!p) return alert("NPC não encontrado.");
  const audit = fxAdminAuditParticipantSquad(p);
  const squad = typeof normalizeFantasySquad === "function" ? normalizeFantasySquad(p.squad) : p.squad;
  const map = fantasyPlayerMap();
  const budget = Number(fantasySettings().budgetInitial || 5000000);
  const overlay = document.getElementById("aiReviewOverlay");
  const body = document.getElementById("aiReviewBody");
  const title = document.getElementById("aiReviewTitle");
  if (!overlay || !body || !title) return alert("Não foi possível abrir a visualização da escalação.");

  const row = (key, label) => {
    if (!key) return `<tr><td>${label}</td><td style="color:var(--red,#fb7185);font-weight:800">NÃO ESCALADO</td><td>—</td><td>—</td></tr>`;
    const agent = map[key];
    if (!agent) return `<tr><td>${label}</td><td>${key}</td><td colspan="2" style="color:var(--red,#fb7185)">Agente não encontrado</td></tr>`;
    const isCaptain = squad?.captainKey === key;
    return `<tr>
      <td>${label}${isCaptain ? " ⭐" : ""}</td>
      <td><strong>${agent.name || agent.nome || key}</strong><br><small>${key}</small></td>
      <td>${agent.club || "—"}</td>
      <td>${fxAdminMoney(typeof playerPrice === "function" ? playerPrice(key) : agent.marketValue || 0)}</td>
    </tr>`;
  };

  title.textContent = `Escalação NPC · ${p.displayName || id}`;
  body.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:14px">
      <div class="admin-stat-card"><small>Status</small><strong style="display:block;color:${audit.valid ? "var(--green,#4ade80)" : "var(--red,#fb7185)"}">${audit.valid ? "✓ VÁLIDA · 6/6" : `⚠ INVÁLIDA · ${audit.count}/6`}</strong></div>
      <div class="admin-stat-card"><small>Orçamento total</small><strong style="display:block">${fxAdminMoney(budget)}</strong></div>
      <div class="admin-stat-card"><small>Gasto</small><strong style="display:block">${fxAdminMoney(audit.spent)}</strong></div>
      <div class="admin-stat-card"><small>Saldo</small><strong style="display:block">${fxAdminMoney(audit.budgetRemaining)}</strong></div>
    </div>
    ${audit.errors?.length ? `<div style="padding:10px 12px;border:1px solid rgba(251,113,133,.45);border-radius:10px;margin-bottom:12px;color:var(--red,#fb7185)"><strong>Problemas:</strong> ${audit.errors.join(" · ")}</div>` : ""}
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead><tr><th>Slot</th><th>Agente</th><th>Equipe</th><th>Preço</th></tr></thead>
        <tbody>
          ${(squad?.starters || []).map((key, i) => row(key, `Titular ${i + 1}`)).join("")}
          ${row(squad?.bench, "Reserva")}
        </tbody>
      </table>
    </div>
    <p style="margin-top:12px;font-size:.82rem;color:var(--text-muted)"><strong>Origem:</strong> ${p.lastSquadSource === "gemini" ? "Gemini 3.6 Flash" : p.lastSquadSource === "deterministic" ? "fallback determinístico" : "não registrada"}${p.lastComment ? `<br><strong>Comentário:</strong> ${p.lastComment}` : ""}</p>
  `;
  window._aiReviewData = null;
  const primaryAction = overlay.querySelector(".review-actions .btn-primary");
  if (primaryAction) primaryAction.style.display = "none";
  overlay.classList.add("open");
}

async function fxAdminRebuildNpcs() {
  const parts = window.AppState.fantasy.participants || {};
  const updates = {};
  const activeNpcs = Object.entries(parts).filter(([, p]) => p && p.type === "npc" && p.active !== false);
  const budget = fantasySettings().budgetInitial || 5000000;
  const context = typeof buildNpcAIContext === "function" ? buildNpcAIContext() : null;
  let aiCount = 0;
  let fallbackCount = 0;

  for (const [id, p] of activeNpcs) {
    const seed = {
      id,
      displayName: p.displayName,
      teamName: p.teamName,
      strategy: p.strategy,
      superfanTeam: p.superfanTeam || null,
      avatar: p.avatar
    };

    let built = typeof buildNpcSquadSmart === "function"
      ? await buildNpcSquadSmart(seed, budget, context)
      : { ...buildNpcSquad(p.strategy, p.superfanTeam, budget), source: "deterministic", comment: null };

    let audit = typeof auditNpcSquad === "function" ? auditNpcSquad(built.squad, budget) : fxAdminAuditParticipantSquad({ squad: built.squad });
    if (!audit.valid) {
      const strict = buildNpcSquad(p.strategy, p.superfanTeam, budget);
      built = { ...strict, source: "deterministic", comment: null };
      audit = typeof auditNpcSquad === "function" ? auditNpcSquad(built.squad, budget) : fxAdminAuditParticipantSquad({ squad: built.squad });
    }

    if (!audit.valid) {
      throw new Error(`${p.displayName || id}: não existe escalação válida de 6 agentes dentro de ${fxAdminMoney(budget)}. ${audit.errors.join(" · ")}`);
    }

    if (built.source === "gemini") aiCount++;
    else fallbackCount++;

    updates[id] = {
      ...p,
      squad: audit.squad,
      budgetRemaining: audit.budgetRemaining,
      lastComment: built.comment || p.lastComment || null,
      lastSquadSource: built.source,
      lastSquadGeneratedAt: Date.now()
    };
  }

  if (Object.keys(updates).length) {
    await window.marketDb.ref("fantasy/participants").update(updates);
  }
  alert(`NPCs remontados e validados: ${activeNpcs.length}/${activeNpcs.length} com 6 agentes. ${aiCount} via Gemini · ${fallbackCount} via fallback determinístico.`);
  renderFantasyAdmin();
}

async function fxAdminAddHuman() {
  const nick = document.getElementById("fxNewNick")?.value?.trim();
  const team = document.getElementById("fxNewTeam")?.value?.trim() || nick + " FC";
  let code = document.getElementById("fxNewCode")?.value?.trim();
  if (!nick) return alert("Informe o nick");
  if (!code) code = "JET-" + nick.toUpperCase().replace(/\s+/g, "").slice(0, 10);
  const id = "human_" + Date.now();
  const budget = fantasySettings().budgetInitial || 5000000;
  await saveFantasyParticipant(id, {
    type: "human",
    displayName: nick,
    teamName: team,
    inviteCode: code,
    active: true,
    budgetRemaining: budget,
    squad: emptySquad(),
    acquisitions: {},
    strategy: null
  });
  alert("Cadastrado! Código: " + code);
  renderFantasyAdmin();
}

async function fxAdminDeletePart(id) {
  if (!confirm("Excluir participante?")) return;
  await window.marketDb.ref("fantasy/participants/" + id).remove();
  renderFantasyAdmin();
}

async function fxAdminToggleNpc(id, turnOn) {
  await updateFantasyParticipant(id, { active: !!turnOn });
  renderFantasyAdmin();
}

function fxAdminPreviewProcess() {
  const s = fantasySettings();
  const roundId = s.currentRoundId || "r1";
  const round = (window.AppState.fantasy.rounds || {})[roundId] || {
    id: roundId,
    seasonId: s.seasonId || window.AppState.jet.currentSeason,
    rodadaNumber: Number(document.getElementById("fxRoundNum")?.value) || 1
  };
  const participants = window.AppState.fantasy.participants || {};
  const result = processFantasyRound(round, participants, { zebraThreshold: s.zebraThreshold });

  const status = document.getElementById("fxAdminProcessStatus");
  if (status) {
    status.textContent = `${result.matchesCount} partida(s) · ${Object.keys(result.scores).length} participantes pontuados`;
  }

  const rows = Object.entries(result.scores)
    .map(([id, sc]) => ({
      id,
      name: participants[id]?.displayName || id,
      total: sc.total,
      breakdown: sc.breakdown
    }))
    .sort((a, b) => b.total - a.total);

  const overlay = document.getElementById("aiReviewOverlay");
  const body = document.getElementById("aiReviewBody");
  const title = document.getElementById("aiReviewTitle");
  const primaryAction = overlay?.querySelector(".review-actions .btn-primary");
  if (primaryAction) primaryAction.style.display = "";
  window._aiReviewData = {
    action: "fantasy-process-round",
    data: { result, round, roundId, rows }
  };
  title.textContent = `Revisar pontuação Fantasy · ${roundId}`;
  body.innerHTML = `
    <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:10px">
      Temporada <strong>${result.season}</strong> · Rodada Jet <strong>${result.roundNumber}</strong> ·
      Matches: <strong>${result.matchesCount}</strong>. Confirme para gravar scores e leaderboard.
      ${((window.AppState.fantasy.rounds||{})[roundId]?.status)==="PROCESSED" ? "<br><span style='color:var(--orange)'>⚠ Rodada já processada — confirmar sobrescreve.</span>" : ""}
    </p>
    <div class="admin-table-wrap" style="max-height:400px;overflow:auto">
      <table class="admin-table">
        <thead><tr><th>#</th><th>Participante</th><th>Pts</th><th>Detalhe (top)</th></tr></thead>
        <tbody>
          ${rows.map((r,i) => `
            <tr>
              <td>${i+1}</td>
              <td>${r.name}</td>
              <td style="font-weight:700;color:var(--cyan)">${r.total}</td>
              <td style="font-size:0.75rem;color:var(--text-muted)">${(r.breakdown||[]).filter(b=>b.role!=="bench").map(b=>`${b.playerKey.split("_").slice(1).join("_")}:${b.points}`).join(" · ")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
  overlay.classList.add("open");
}

async function confirmFantasyProcessRound() {
  const payload = window._aiReviewData?.data;
  if (!payload) return;
  const { result, round, roundId, rows } = payload;
  const scoresUpdate = {};
  Object.entries(result.scores).forEach(([id, sc]) => {
    scoresUpdate[id] = sc;
  });

  // overall leaderboard: soma todas as rodadas (recalc simplificado: previous overall - old round + new)
  const overall = { ...(window.AppState.fantasy.leaderboard?.overall || {}) };
  const oldRoundScores = (window.AppState.fantasy.scores || {})[roundId] || {};
  Object.keys({ ...oldRoundScores, ...result.scores }).forEach(id => {
    const prevTotal = (overall[id]?.points || 0) - (oldRoundScores[id]?.total || 0) + (result.scores[id]?.total || 0);
    overall[id] = {
      points: Math.round(prevTotal * 10) / 10,
      lastRoundPoints: result.scores[id]?.total || 0,
      equity: fantasyEquity(window.AppState.fantasy.participants[id])
    };
  });

  const byRound = {};
  Object.entries(result.scores).forEach(([id, sc]) => { byRound[id] = sc.total; });

  const updates = {};
  updates["fantasy/scores/" + roundId] = result.scores;
  updates["fantasy/leaderboard/byRound/" + roundId] = byRound;
  updates["fantasy/leaderboard/overall"] = overall;
  updates["fantasy/rounds/" + roundId] = {
    ...(window.AppState.fantasy.rounds || {})[roundId],
    ...round,
    id: roundId,
    status: "PROCESSED",
    processedAt: new Date().toISOString(),
    jetMatchIds: result.jetMatchIds,
    winnerParticipantId: rows[0]?.id || null
  };
  updates["fantasy/settings/marketStatus"] = "LOCKED";

  await window.marketDb.ref().update(updates);
  alert("Rodada processada! " + rows.length + " participantes.");
  if (typeof closeAIReviewModal === "function") closeAIReviewModal();
  renderFantasyAdmin();
}

window.fxAdminResetAll = fxAdminResetAll;
window.fxAdminViewNpcSquad = fxAdminViewNpcSquad;
window.renderFantasyAdmin = renderFantasyAdmin;
window.fxAdminOpenMarket = fxAdminOpenMarket;
window.fxAdminCloseMarket = fxAdminCloseMarket;
window.fxAdminSaveConfig = fxAdminSaveConfig;
window.fxAdminCreateRound = fxAdminCreateRound;
window.fxAdminSeed = fxAdminSeed;
window.fxAdminRebuildNpcs = fxAdminRebuildNpcs;
window.fxAdminAddHuman = fxAdminAddHuman;
window.fxAdminDeletePart = fxAdminDeletePart;
window.fxAdminToggleNpc = fxAdminToggleNpc;
window.fxAdminPreviewProcess = fxAdminPreviewProcess;
window.confirmFantasyProcessRound = confirmFantasyProcessRound;

window.fxAdminRepairData = fxAdminRepairData;
