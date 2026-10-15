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
  const f = ensureFantasyState();
  if (!f.ui.listenersStarted) startFantasyListeners();
  const loaded = ["settings", "participants", "rounds", "scores", "leaderboard"].every(field => f.ui[field + "Loaded"]);
  el.dataset.fantasyLoading = String(!loaded || !!f.ui.lastError);
  if (!loaded || f.ui.lastError) {
    el.innerHTML = `<p role="status">${f.ui.lastError ? escapeHTML(f.ui.lastError) : "Carregando Fantasy…"}</p><button class="btn-gray" onclick="startFantasyListeners();renderFantasyAdmin()">Tentar novamente</button>`;
    return;
  }
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
        <label>Orçamento inicial (US$)</label>
        <input type="number" min="1000000" step="100000" id="fxBudget" value="${s.budgetInitial ?? 5000000}">
      </div>
      <div>
        <label>Escala de preço Fantasy (ex: 0.10 = 10% do valor oficial)</label>
        <input type="number" step="0.01" min="0.01" max="1" id="fxPriceScale" value="${s.priceScale ?? 0.10}">
      </div>
      <div>
        <label>Preço mínimo Fantasy (US$)</label>
        <input type="number" min="0" step="10000" id="fxMinPrice" value="${s.minFantasyPrice ?? 50000}">
      </div>
      <div>
        <label>Zebra threshold (ex: 0.20 = 20%)</label>
        <input type="number" step="0.01" min="0.05" max="0.5" id="fxZebra" value="${s.zebraThreshold ?? 0.2}">
      </div>
      <div>
        <label>Modo de pontuação</label>
        <select id="fxScoreMode">
          <option value="perSeries" ${(s.scoreMode || "perSeries") === "perSeries" ? "selected" : ""}>Por série (soma todas na rodada)</option>
          <option value="perRoundOnce" ${s.scoreMode === "perRoundOnce" ? "selected" : ""}>1× por rodada (melhor série apenas)</option>
        </select>
        <small style="display:block;margin-top:5px;color:var(--text-muted)">MVP/zebra da série escolhida entram; Destaque da rodada continua único.</small>
      </div>
      <div>
        <label>Fecha em (datetime-local)</label>
        <input type="datetime-local" id="fxClosesAt" value="${s.marketClosesAt ? toLocalInput(s.marketClosesAt) : ""}">
      </div>
      <div>
        <label>Rodada atual (nº Jet League)</label>
        <input type="number" min="1" step="1" id="fxRoundNum" value="${currentRoundNumber}">
        <small style="display:block;margin-top:5px;color:var(--text-muted)">ID interno: rN (ex.: 12 → r12).</small>
      </div>
      <div>
        <label>Temporada</label>
        <input type="text" id="fxSeason" value="${s.seasonId || window.AppState.jet.currentSeason || ""}">
      </div>
    </div>
    <div class="admin-actions" style="margin-top:10px">
      <button class="btn-primary btn-sm" onclick="fxAdminSaveConfig()">Salvar config</button>
    </div>
    <p class="admin-sub" style="margin-top:8px">
      <strong>Economia Fantasy:</strong> preço = <em>valor oficial × escala</em> (padrão 10%), com piso configurável.
      Orçamento padrão <strong>US$ 5M</strong> para caber 5+1 agentes. O valor oficial do TransferJet <strong>não é alterado</strong>.
      Patrimônio = saldo restante + preços Fantasy atuais do elenco.
    </p>

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
      <button class="btn-gray btn-sm" onclick="fxAdminReviewAnalysis()">Revisar análise narrativa</button>
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
  try {
    const settingsRef = window.marketDb.ref("fantasy/settings");
    const settings = (await settingsRef.once("value")).val() || {};
    const round = (await fantasyRoundRef(settings.currentRoundId).once("value")).val();
    if (!round || round.snapshot || round.status === "PROCESSED") throw new Error("Esta rodada já foi congelada. Crie a próxima rodada para abrir o mercado.");
    const result = await settingsRef.transaction(current => current?.currentRoundId === settings.currentRoundId ? { ...current, marketStatus: "OPEN" } : undefined);
    if (!result.committed) throw new Error("Rodada alterada. Atualize o painel.");
    alert("Mercado ABERTO"); renderFantasyAdmin();
  } catch (error) { alert(error.message); }
}
async function fxAdminCloseMarket() {
  try {
    const round = await closeFantasyRound();
    alert(`Mercado FECHADO. Escalações oficiais salvas em ${round.snapshot.capturedAt}.`);
    renderFantasyAdmin();
  } catch (error) { alert(error.message); }
}

async function fxAdminSaveConfig() {
  try {
  const zebraInput = Number(document.getElementById("fxZebra")?.value);
  const zebra = Number.isFinite(zebraInput) ? Math.min(1, Math.max(0, zebraInput)) : 0.2;
  const budgetInitial = Math.max(1000000, Number(document.getElementById("fxBudget")?.value) || 5000000);
  const priceScale = Math.min(1, Math.max(0.01, Number(document.getElementById("fxPriceScale")?.value) || 0.10));
  const minFantasyPrice = Math.max(0, Number(document.getElementById("fxMinPrice")?.value) || 50000);
  const scoreMode = document.getElementById("fxScoreMode")?.value === "perRoundOnce" ? "perRoundOnce" : "perSeries";
  const closesRaw = document.getElementById("fxClosesAt")?.value;
  const marketClosesAt = closesRaw ? new Date(closesRaw).toISOString() : null;
  const seasonId = document.getElementById("fxSeason")?.value || window.AppState.jet.currentSeason;
  const rodadaNumber = Math.max(1, Math.floor(Number(document.getElementById("fxRoundNum")?.value) || 1));
  let currentRoundId = `r${rodadaNumber}`;
  const previous = (await fantasyRoundRef(currentRoundId).once("value")).val();
  if (previous?.seasonId && previous.seasonId !== seasonId) currentRoundId = `s${Array.from(seasonId).map(c => c.codePointAt(0).toString(16)).join("-")}_r${rodadaNumber}`;
  const savedRound = await fantasyRoundRef(currentRoundId).transaction(current => {
    if (current?.snapshot || current?.status === "PROCESSED" || current?.status === "PROCESSING") return;
    return { ...(current || {}), id: currentRoundId, name: "Rodada " + rodadaNumber, seasonId, rodadaNumber, status: "OPEN" };
  });
  if (!savedRound.committed) throw new Error("Rodada congelada. Selecione outra rodada; o histórico foi preservado.");

  await saveFantasySettings({
    zebraThreshold: zebra,
    budgetInitial,
    priceScale,
    minFantasyPrice,
    scoreMode,
    marketClosesAt,
    marketClosesAtMs: marketClosesAt ? new Date(marketClosesAt).getTime() : null,
    currentRoundId,
    seasonId
  });
  alert("Config salva");
  renderFantasyAdmin();
  } catch (error) { alert(error.message); }
}

async function fxAdminCreateRound() {
  await fxAdminSaveConfig();
}

async function fxAdminSeed() {
  const rounds = (await window.marketDb.ref("fantasy/rounds").once("value")).val() || {};
  if (Object.values(rounds).some(round => round.snapshot || round.status === "PROCESSED" || round.status === "PROCESSING")) {
    alert("Já existe histórico oficial. Crie a próxima rodada; o seed não pode reabrir ou sobrescrever rodadas antigas.");
    return;
  }
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
  if (!isFantasyMarketOpen()) { alert("Abra uma nova rodada antes de reparar escalações."); return; }
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
  if (!isFantasyMarketOpen()) { alert("Abra uma nova rodada antes de remontar NPCs."); return; }
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
  const team = document.getElementById("fxNewTeam")?.value?.trim() || (nick ? nick + " FC" : "");
  let code = document.getElementById("fxNewCode")?.value?.trim();
  if (!nick) return alert("Informe o nick");
  if (!code) code = "JET-" + nick.toUpperCase().replace(/\s+/g, "").slice(0, 10);

  const parts = window.AppState.fantasy?.participants || {};
  const dup = Object.values(parts).find(p => p && (p.inviteCode || "").toUpperCase() === code.toUpperCase());
  if (dup) return alert("Código já existe: " + code + " (nick: " + (dup.displayName || "?") + ")");

  const id = "human_" + Date.now();
  const budget = fantasySettings().budgetInitial || 5000000;
  const payload = {
    type: "human",
    displayName: nick,
    teamName: team,
    inviteCode: code,
    active: true,
    budgetRemaining: budget,
    squad: typeof emptySquad === "function" ? emptySquad() : { starters: [null, null, null, null, null], bench: null },
    acquisitions: {},
    strategy: null,
    createdAt: new Date().toISOString()
  };
  try {
    await saveFantasyParticipant(id, payload);
    if (!window.AppState.fantasy.participants) window.AppState.fantasy.participants = {};
    window.AppState.fantasy.participants[id] = payload;
    alert("Cadastrado! Nick: " + nick + " · Código: " + code);
    renderFantasyAdmin();
  } catch (err) {
    console.error("fxAdminAddHuman", err);
    alert("Erro ao cadastrar: " + (err?.message || err) + "\n\nConfira se você está logado como admin (auth com e-mail).");
  }
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

async function fxAdminPreviewProcess() {
  try {
  const roundId = fantasySettings().currentRoundId;
  const prepared = await prepareFantasyRound(roundId);
  if (prepared.alreadyProcessed) { alert("Rodada já processada. Pontos e histórico preservados."); return; }
  const { round, result } = prepared;
  const participants = round.snapshot.participants;
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
      Temporada <strong>${escapeHTML(result.season)}</strong> · Rodada Jet <strong>${result.roundNumber}</strong> ·
      Matches: <strong>${result.matchesCount}</strong> · modo: <strong>${escapeHTML(round.snapshot.settings.scoreMode)}</strong>. Confirme para gravar scores e leaderboard.

    </p>
    <div class="admin-table-wrap" style="max-height:400px;overflow:auto">
      <table class="admin-table">
        <thead><tr><th>#</th><th>Participante</th><th>Pts</th><th>Detalhe (top)</th></tr></thead>
        <tbody>
          ${rows.map((r,i) => `
            <tr>
              <td>${i+1}</td>
              <td>${escapeHTML(r.name)}</td>
              <td style="font-weight:700;color:var(--cyan)">${r.total}</td>
              <td style="font-size:0.75rem;color:var(--text-muted)">${(r.breakdown||[]).filter(b=>b.role!=="bench").map(b=>`${escapeHTML(b.name || b.playerKey)}:${b.points}`).join(" · ")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
  overlay.classList.add("open");
  } catch (error) { alert(error.message); }
}

async function confirmFantasyProcessRound() {
  const payload = window._aiReviewData?.data;
  if (!payload || window._fxProcessing) return;
  window._fxProcessing = true;
  try {
    const outcome = await publishFantasyRound(payload.roundId, payload.result);
    alert(outcome.alreadyProcessed ? "Rodada já processada. Histórico preservado." : "Rodada processada com as escalações oficiais.");
    if (typeof closeAIReviewModal === "function") closeAIReviewModal();
    renderFantasyAdmin();
  } catch (error) { alert(error.message); }
  finally { window._fxProcessing = false; }
}

async function fxAdminReviewAnalysis() {
  try {
    const roundId = fantasySettings().currentRoundId;
    const round = (await fantasyRoundRef(roundId).once("value")).val();
    if (round?.status !== "PROCESSED") throw new Error("Processe a rodada antes de gerar a análise.");
    const scores = (await window.marketDb.ref("fantasy/scores/" + roundId).once("value")).val() || {};
    const rows = Object.entries(scores).map(([id, sc]) => ({ id, name: sc.displayName || id, total: sc.total })).sort((a,b) => b.total-a.total);
    const draft = await fxGenerateRoundAnalysis(roundId, rows, { matchesCount: round.jetMatchIds?.length || 0 });
    window._aiReviewData = { action: "fantasy-analysis", data: { roundId } };
    document.getElementById("aiReviewTitle").textContent = "Revisar análise narrativa · " + roundId;
    document.getElementById("aiReviewBody").innerHTML = `<p>Edite e confirme para publicar. Este texto não altera pontos.</p><textarea id="fxAnalysisDraft" class="fx-input" rows="8" style="width:100%">${escapeHTML(draft)}</textarea>`;
    const overlay = document.getElementById("aiReviewOverlay");
    overlay.querySelector(".review-actions .btn-primary").style.display = "";
    overlay.classList.add("open");
  } catch (error) { alert(error.message); }
}

async function confirmFantasyAnalysis() {
  const roundId = window._aiReviewData?.data?.roundId;
  const text = document.getElementById("fxAnalysisDraft")?.value.trim();
  if (!text || !roundId) return;
  try {
    const result = await fantasyRoundRef(roundId).transaction(round => round?.status === "PROCESSED"
      ? { ...round, analysisCache: { text: text.slice(0, 6000), at: new Date().toISOString(), source: "reviewed" } } : undefined);
    if (!result.committed) throw new Error("Rodada indisponível.");
    closeAIReviewModal(); renderFantasyAdmin();
  } catch (error) { alert(error.message); }
}

/** Gera texto de análise a partir dos resultados já calculados (nunca inventa placar). */
async function fxGenerateRoundAnalysis(roundId, rows, result) {
  const top = rows.slice(0, 5).map((r, i) => `${i + 1}. ${r.name}: ${r.total} pts`).join("\n");
  const winner = rows[0];
  const fallback = `[auto] ${winner ? winner.name + " liderou a rodada com " + winner.total + " pts." : "Rodada processada."} ${result.matchesCount} série(s) oficiais consideradas.`;

  const gen = window.generateWithAI || window.marketGenerateWithAI;
  if (!fantasySettings().geminiEnabled || typeof gen !== "function") return fallback;

  const prompt = `Você é o narrador do Jet Fantasy (e-sports). Com base APENAS nos dados abaixo, escreva 2 a 4 frases em português sobre a rodada.
Não invente placares, nomes ou pontos. Não use markdown.
Rodada: ${roundId}
Séries oficiais usadas: ${result.matchesCount}
Ranking da rodada:
${top}
Texto objetivo, tom de transmissão esportiva premium.`;

  try {
    const text = await gen(prompt, undefined, { timeoutMs: 12000 });
    const clean = String(text || "").trim();
    return clean || fallback;
  } catch (e) {
    return fallback;
  }
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
window.fxGenerateRoundAnalysis = fxGenerateRoundAnalysis;

window.fxAdminRepairData = fxAdminRepairData;

// Só preenche o painel após a carga inicial; atualizações não apagam formulários em edição.
document.addEventListener("fantasy:updated", () => {
  const box = document.getElementById("adminBox");
  const content = document.getElementById("adminTabContent");
  if (box?.dataset.tab === "fantasy" && content?.dataset.fantasyLoading === "true") renderFantasyAdmin();
});
