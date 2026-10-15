/* Jet Fantasy — shell, navegação e views */

function fxEscapeInlineKey(value) {
  return fxEscapeHTML(String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029"));
}

function fxEscapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function fxRoundLabel(settings = fantasySettings()) {
  const rid = settings.currentRoundId || "";
  const round = (window.AppState.fantasy?.rounds || {})[rid];
  const n = Number(round?.rodadaNumber) || Number(String(rid).replace(/\D+/g, ""));
  return n ? `Rodada ${n}` : "Rodada não definida";
}

function fxToast(message, type = "info") {
  let host = document.getElementById("fxToastHost");
  if (!host) {
    host = document.createElement("div");
    host.id = "fxToastHost";
    host.className = "fx-toast-host";
    document.body.appendChild(host);
  }
  const el = document.createElement("div");
  el.className = `fx-toast ${type}`;
  el.textContent = message;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 220);
  }, 2600);
}

function fxRenderFailure(container, error, view) {
  console.error(`[Jet Fantasy] Falha ao renderizar ${view}`, error);
  if (!container) return;
  container.innerHTML = `
    <div class="fx-state-card danger">
      <div class="fx-state-icon">⚠</div>
      <h2>Essa área não carregou corretamente</h2>
      <p>O Fantasy encontrou dados antigos ou incompletos. Seus dados não foram apagados.</p>
      <div class="fx-state-actions">
        <button class="fx-btn primary" onclick="renderFantasyShell()">Tentar novamente</button>
        <button class="fx-btn ghost" onclick="showFantasyView('hub')">Ir para o início</button>
      </div>
      <details><summary>Detalhes técnicos</summary><code>${fxEscapeHTML(error?.message || String(error || "Erro desconhecido"))}</code></details>
    </div>`;
}

function fxOpenPlayerProfile(key) {
  if (!key) return;
  if (typeof openPlayerProfile === "function") {
    openPlayerProfile(key);
  }
}
window.FANTASY = window.FANTASY || {};

function enterFantasyMode() {
  const f = ensureFantasyState();
  const entering = !f.active;
  f.active = true;
  if (entering && !f.ui.listenersStarted) startFantasyListeners();
  document.body.classList.add("fantasy-mode");
  applyFantasyAtmosphere();
  const shell = document.getElementById("fantasyShell");
  if (shell) shell.classList.remove("hidden");
  document.querySelector("header")?.classList.add("fx-hide");
  document.querySelector(".hero")?.classList.add("fx-hide");
  document.querySelector("footer")?.classList.add("fx-hide");
  document.querySelector("main")?.classList.add("fx-hide-official");
  renderFantasyShell();
}

function exitFantasyMode() {
  clearTimeout(window._fxCountdownTimer);
  ensureFantasyState();
  window.AppState.fantasy.active = false;
  document.body.classList.remove("fantasy-mode", "market-open", "market-locked", "round-processed");
  document.getElementById("fantasyShell")?.classList.add("hidden");
  document.querySelector("header")?.classList.remove("fx-hide");
  document.querySelector(".hero")?.classList.remove("fx-hide");
  document.querySelector("footer")?.classList.remove("fx-hide");
  document.querySelector("main")?.classList.remove("fx-hide-official");
  if (typeof showView === "function") showView("home");
}

function applyFantasyAtmosphere() {
  document.body.classList.remove("market-open", "market-locked", "round-processed");
  const s = fantasySettings();
  const open = isFantasyMarketOpen();
  if (s.currentRoundId) {
    const round = (window.AppState.fantasy.rounds || {})[s.currentRoundId];
    if (round?.status === "PROCESSED") {
      document.body.classList.add("round-processed");
      return;
    }
  }
  document.body.classList.add(open ? "market-open" : "market-locked");
}

function showFantasyView(view) {
  ensureFantasyState().ui.view = view;
  renderFantasyShell();
}

function renderFantasyShell() {
  clearTimeout(window._fxCountdownTimer);
  const shell = document.getElementById("fantasyShell");
  if (!shell || !window.AppState.fantasy?.active) return;
  applyFantasyAtmosphere();
  const view = window.AppState.fantasy.ui.view || "hub";
  const open = isFantasyMarketOpen();
  const s = fantasySettings();

  shell.innerHTML = `
    <div class="fx-app">
      <header class="fx-header">
        <div class="fx-brand">
          <div class="fx-logo">JET FANTASY</div>
          <div class="fx-powered">Powered by TransferJet</div>
        </div>
        <div class="fx-header-status">
          ${open
            ? `<span class="fx-pill open">MERCADO ABERTO</span>${s.marketClosesAt ? `<span class="fx-countdown" id="fxCountdown"></span>` : ""}`
            : `<span class="fx-pill locked">🔒 MERCADO FECHADO</span>`}
        </div>
        <button class="fx-btn ghost" onclick="exitFantasyMode()">← Voltar ao TransferJet</button>
      </header>
      <nav class="fx-nav">
        ${["hub","squad","market","ranking","rounds"].map(v => {
          const labels = { hub: "Início", squad: "Meu Time", market: "Mercado", ranking: "Ranking", rounds: "Rodadas" };
          return `<button class="fx-nav-btn ${view===v?"active":""}" onclick="showFantasyView('${v}')">${labels[v]}</button>`;
        }).join("")}
      </nav>
      <div class="fx-content" id="fxContent"></div>
    </div>
  `;
  const content = document.getElementById("fxContent");
  const f = ensureFantasyState();
  if (f.ui.lastError) {
    content.innerHTML = `<div class="fx-state-card" role="status"><p>${fxEscapeHTML(f.ui.lastError)}</p><button class="fx-btn" onclick="startFantasyListeners()">Tentar novamente</button></div>`;
    return;
  }
  if (!f.ui.participantsLoaded) {
    content.innerHTML = `<p role="status">Carregando participantes do Fantasy…</p>`;
    return;
  }
  try {
    if (view === "hub") renderFantasyHub(content);
    else if (view === "squad") renderFantasySquad(content);
    else if (view === "market") renderFantasyMarketView(content);
    else if (view === "ranking") renderFantasyRanking(content);
    else if (view === "rounds") renderFantasyRounds(content);
    else renderFantasyHub(content);
  } catch (error) {
    fxRenderFailure(content, error, view);
  }

  if (open && s.marketClosesAt) startFxCountdown(s.marketClosesAt);
}

function startFxCountdown(iso) {
  const el = document.getElementById("fxCountdown");
  if (!el) return;
  function tick() {
    if (!el.isConnected) return;
    const diff = new Date(iso).getTime() - Date.now();
    if (diff <= 0) {
      el.textContent = "Fechado";
      applyFantasyAtmosphere();
      return;
    }
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const sec = Math.floor((diff % 60000) / 1000);
    el.textContent = `Fecha em ${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
    window._fxCountdownTimer = setTimeout(tick, 1000);
  }
  tick();
}

/* ========== LOGIN ========== */
function renderFantasyLogin(container) {
  container.innerHTML = `
    <div class="fx-login">
      <h2>Entrar no Jet Fantasy</h2>
      <p>Use o <strong>código de convite</strong> ou o <strong>nick</strong> cadastrado pelo Admin.</p>
      <input type="text" id="fxLoginInput" class="fx-input" placeholder="Código ou nick" />
      <button class="fx-btn primary" onclick="fantasyDoLogin()">Entrar</button>
      <p class="fx-hint">Ainda não tem acesso? Peça ao mestre da liga para cadastrar seu nick.</p>
    </div>
  `;
}

function fantasyDoLogin() {
  const raw = document.getElementById("fxLoginInput")?.value || "";
  const found = findParticipantByInvite(raw);
  if (!found) {
    alert("Participante não encontrado. Verifique o código/nick.");
    return;
  }
  setFantasySession(found.id, found.displayName);
  renderFantasyShell();
}

function fantasyLogout() {
  setFantasySession(null, null);
  renderFantasyShell();
}

function fantasySquadDisplay(me) {
  const f = ensureFantasyState();
  const snapshot = f.rounds?.[fantasySettings().currentRoundId]?.snapshot;
  const official = snapshot?.participants?.[f.session.participantId];
  return { participant: official ? { ...me, ...official } : me, official,
    players: official ? snapshot.players : Object.fromEntries(getAllPlayersFlat().map(p => [p.key, p])) };
}

/* ========== HUB ========== */
function renderFantasyHub(container) {
  const me = getMyFantasyParticipant();
  if (!me) return renderFantasyLogin(container);

  const f = window.AppState.fantasy;
  const s = fantasySettings();
  const roundId = s.currentRoundId;
  const myId = f.session.participantId;
  const totals = Object.keys(f.scores || {}).length ? fantasyOverallFromScores(f.scores) : (f.leaderboard?.overall || {});
  const myOverall = totals[myId] || {};
  const myRound = roundId ? ((f.scores || {})[roundId] || {})[myId] : null;
  const equity = fantasyEquity(me);
  const open = isFantasyMarketOpen();

  // position
  const ranked = Object.entries(totals)
    .map(([id, v]) => ({ id, points: v.points || 0 }))
    .sort((a, b) => b.points - a.points);
  const pos = ranked.findIndex(r => r.id === myId) + 1;

  const display = fantasySquadDisplay(me);
  const map = display.players;
  const squad = normalizeFantasySquad(display.participant.squad);
  const analysis = roundId && f.rounds?.[roundId]?.analysisCache?.text;

  container.innerHTML = `
    <div class="fx-hub">
      <div class="fx-hub-top">
        <div>
          <div class="fx-kicker">${fxEscapeHTML(s.seasonId || "")} · ${fxRoundLabel(s)}</div>
          <h1 class="fx-title">Olá, ${fxEscapeHTML(me.displayName || "Jogador")}</h1>
          <p class="fx-sub">${fxEscapeHTML(me.teamName || "Meu esquadrão")}</p>
        </div>
        <button class="fx-btn ghost sm" onclick="fantasyLogout()">Trocar conta</button>
      </div>

      <div class="fx-kpi-grid">
        <div class="fx-kpi"><div class="fx-kpi-label">Posição</div><div class="fx-kpi-value">${pos || "—"}º</div></div>
        <div class="fx-kpi"><div class="fx-kpi-label">Pts gerais</div><div class="fx-kpi-value">${myOverall.points != null ? myOverall.points : "0"}</div></div>
        <div class="fx-kpi"><div class="fx-kpi-label">Patrimônio</div><div class="fx-kpi-value">${typeof formatUSD==="function"?formatUSD(equity,true):equity}</div></div>
        <div class="fx-kpi"><div class="fx-kpi-label">Última rodada</div><div class="fx-kpi-value ${myRound && myRound.total>=0?"up":"down"}">${myRound ? ((myRound.total>=0?"+":"")+myRound.total) : "—"}</div></div>
        <div class="fx-kpi"><div class="fx-kpi-label">Mercado</div><div class="fx-kpi-value" style="font-size:1.1rem">${open?"ABERTO":"FECHADO"}</div></div>
        <div class="fx-kpi"><div class="fx-kpi-label">Orçamento</div><div class="fx-kpi-value" style="font-size:1.1rem">${typeof formatUSD==="function"?formatUSD(me.budgetRemaining||0,true):me.budgetRemaining}</div></div>
      </div>

      <div class="fx-section">
        <div class="fx-section-head">
          <h2>Meu esquadrão</h2>
          ${open
            ? `<button class="fx-btn primary sm" onclick="showFantasyView('squad')">Editar escalação</button>`
            : `<span class="fx-pill locked">ESCALAÇÃO BLOQUEADA</span>`}
        </div>
        <div class="fx-squad-row">
          ${(squad.starters||[]).map(k => fantasyCardHTML(map[k], { captain: k && k===squad.captainKey })).join("")}
        </div>
        <div class="fx-bench-row">
          <span class="fx-label">Reserva</span>
          ${fantasyCardHTML(map[squad.bench], { bench: true, emptyLabel: "Sem reserva" })}
        </div>
      </div>

      ${analysis ? `
        <div class="fx-section fx-ai-box">
          <h2>🤖 Análise Fantasy</h2>
          <p>${fxEscapeHTML(analysis)}</p>
        </div>
      ` : ""}
    </div>
  `;
}

/* ========== SQUAD ========== */
function renderFantasySquad(container) {
  const me = getMyFantasyParticipant();
  if (!me) return renderFantasyLogin(container);
  const open = isFantasyMarketOpen();
  const display = fantasySquadDisplay(me);
  const map = display.players;
  const squad = normalizeFantasySquad(display.participant.squad);
  const val = display.official ? { ok: display.official.valid, errors: display.official.errors || [] } : validateSquad(squad, me.budgetRemaining);
  const filled = squad.starters.filter(Boolean).length + (squad.bench ? 1 : 0);

  container.innerHTML = `
    <div class="fx-section">
      <div class="fx-section-head">
        <h2>Montar time</h2>
        <div class="fx-budget">
          <span>${filled}/6 agentes</span> · Orçamento: <strong>${typeof formatUSD==="function"?formatUSD(me.budgetRemaining||0,true):me.budgetRemaining}</strong>
        </div>
      </div>
      ${!open ? `<div class="fx-notice locked">🔒 Mercado fechado — ${display.official ? "exibindo sua escalação oficial salva." : "aguardando o administrador salvar a cópia oficial."}</div>` : ""}
      ${open && filled === 0 ? `<div class="fx-notice info">Seu time está vazio. Abra o Mercado e escolha 5 titulares + 1 reserva. <button class="fx-link-btn" onclick="showFantasyView('market')">Ir ao Mercado →</button></div>` : ""}
      ${!val.ok ? `<div class="fx-errors">${val.errors.map(e=>`<div>• ${fxEscapeHTML(e)}</div>`).join("")}</div>` : `<div class="fx-ok">✓ Elenco válido e pronto para a rodada</div>`}
      <div class="fx-squad-edit">
        ${(squad.starters||[null,null,null,null,null]).map((k,i) => `
          <div class="fx-slot">
            <div class="fx-slot-label">Titular ${i+1}</div>
            ${fantasyCardHTML(map[k], { captain: k&&k===squad.captainKey })}
            <div class="fx-slot-actions">
              ${k ? `<button class="fx-btn sm ghost" onclick="fxOpenPlayerProfile('${fxEscapeInlineKey(k)}')">Perfil</button>` : ""}
              ${open ? `<button class="fx-btn sm" onclick="fxOpenMarketForSlot(${i})">${k ? "Trocar" : "Escolher"}</button>` : ""}
              ${open && k?`<button class="fx-btn sm ghost" onclick="fxRemove('${fxEscapeInlineKey(k)}')">Remover</button>`:""}
              ${open && k&&k!==squad.captainKey?`<button class="fx-btn sm gold" onclick="fxCaptain('${fxEscapeInlineKey(k)}')">⭐ Capitão</button>`:""}
            </div>
          </div>
        `).join("")}
      </div>
      <div class="fx-slot" style="max-width:220px;margin-top:16px">
        <div class="fx-slot-label">Reserva</div>
        ${fantasyCardHTML(map[squad.bench], { bench: true, emptyLabel: "Vazio" })}
        <div class="fx-slot-actions">
          ${squad.bench ? `<button class="fx-btn sm ghost" onclick="fxOpenPlayerProfile('${fxEscapeInlineKey(squad.bench)}')">Perfil</button>` : ""}
          ${open ? `<button class="fx-btn sm" onclick="fxOpenMarketForSlot('bench')">${squad.bench ? "Trocar" : "Escolher reserva"}</button>` : ""}
          ${open && squad.bench ? `<button class="fx-btn sm ghost" onclick="fxRemove('${fxEscapeInlineKey(squad.bench)}')">Remover</button>` : ""}
        </div>
      </div>
    </div>
  `;
}

async function fxRunSquadAction(operation, message) {
  const id = ensureFantasyState().session.participantId;
  if (!id || window._fxSquadBusy) return;
  const targetSlot = window._fxTargetSlot;
  window._fxSquadBusy = true;
  try {
    await mutateFantasySquad(id, operation);
    fxToast(message, "success");
    if (window._fxTargetSlot === targetSlot) window._fxTargetSlot = null;
    renderFantasyShell();
  } catch (error) {
    fxToast(error.message || "Não foi possível salvar. Tente novamente.", "warn");
  } finally { window._fxSquadBusy = false; }
}

async function fxRemove(key) {
  return fxRunSquadAction(me => tryRemoveFromSquad(me, key), "Agente removido.");
}

async function fxCaptain(key) {
  return fxRunSquadAction(me => trySetCaptain(me, key), "Capitão definido.");
}

function fxOpenMarketForSlot(slot) {
  window._fxTargetSlot = slot;
  const f = ensureFantasyState();
  if (f.active && f.ui.view === "market") renderFantasyShell();
  else showFantasyView("market");
}

function fxClearTargetSlot() {
  window._fxTargetSlot = null;
}

/* ========== MARKET ========== */
function renderFantasyMarketView(container) {
  const me = getMyFantasyParticipant();
  if (!me) return renderFantasyLogin(container);
  const open = isFantasyMarketOpen();
  const players = Object.values(fantasyPlayerMap())
    .sort((a, b) => (b.marketValue || 0) - (a.marketValue || 0));
  const clubs = [...new Set(players.map(p => p.club))].sort();
  const targetSlot = window._fxTargetSlot;
  const targetLabel = targetSlot === "bench" ? "Reserva" : (Number.isInteger(targetSlot) ? `Titular ${targetSlot + 1}` : null);
  me.squad = normalizeFantasySquad(me.squad);
  const mine = new Set(squadPlayerKeys(me.squad));

  container.innerHTML = `
    <div class="fx-section">
      <div class="fx-section-head">
        <div>
          <h2>Mercado</h2>
          ${targetLabel ? `<div class="fx-target-slot">Substituindo: <strong>${targetLabel}</strong> <button class="fx-link-btn" onclick="fxClearTargetSlot();renderFantasyShell()">cancelar</button></div>` : ""}
        </div>
        <div class="fx-budget">Disponível: <strong>${typeof formatUSD==="function"?formatUSD(me.budgetRemaining||0,true):me.budgetRemaining}</strong>
          · Máx. ${Number(fantasySettings().maxPerTeam)} por equipe</div>
      </div>
      ${!open ? `<p class="fx-warn">🔒 Mercado fechado</p>` : ""}
      <div class="fx-filters">
        <select id="fxFilterClub" onchange="fxFilterMarket()">
          <option value="">Todas equipes</option>
          ${clubs.map(c => `<option value="${fxEscapeHTML(c)}">${fxEscapeHTML(c)}</option>`).join("")}
        </select>
        <select id="fxFilterSort" onchange="fxFilterMarket()">
          <option value="value">Maior valor</option>
          <option value="value-asc">Menor valor</option>
          <option value="wr">Melhor WR</option>
          <option value="name">Nome</option>
        </select>
        <select id="fxFilterRank" aria-label="Rank" onchange="fxFilterMarket()"><option value="">Todos os ranks</option>${[...new Set(players.map(p => p.rank).filter(Boolean))].sort().map(rank => `<option value="${fxEscapeHTML(rank)}">${fxEscapeHTML(rank)}</option>`).join("")}</select>
        <input id="fxFilterMax" type="number" min="0" step="10000" placeholder="Preço Fantasy máximo" aria-label="Preço Fantasy máximo" oninput="fxFilterMarket()" class="fx-input"/>
        <select id="fxFilterAvailability" aria-label="Disponibilidade" onchange="fxFilterMarket()"><option value="">Todos</option><option value="available">Posso escalar</option><option value="selected">No meu elenco</option></select>
        <input type="search" aria-label="Buscar agente" id="fxFilterQ" class="fx-input" placeholder="Buscar..." oninput="fxFilterMarket()"/>
      </div>
      <div class="fx-market-grid" id="fxMarketGrid"></div>
    </div>
  `;
  window._fxMarketPlayers = players;
  window._fxMarketMine = mine;
  window._fxMarketOpen = open;
  fxFilterMarket();
}

function fxFilterMarket() {
  const grid = document.getElementById("fxMarketGrid");
  if (!grid) return;
  let list = window._fxMarketPlayers || [];
  const club = document.getElementById("fxFilterClub")?.value || "";
  const sort = document.getElementById("fxFilterSort")?.value || "value";
  const q = (document.getElementById("fxFilterQ")?.value || "").toLowerCase();
  if (club) list = list.filter(p => p.club === club);
  if (q) list = list.filter(p => p.name.toLowerCase().includes(q));
  if (sort === "value") list = [...list].sort((a,b)=>(b.marketValue||0)-(a.marketValue||0));
  if (sort === "value-asc") list = [...list].sort((a,b)=>(a.marketValue||0)-(b.marketValue||0));
  if (sort === "wr") list = [...list].sort((a,b)=>(b.stats?.winRate||0)-(a.stats?.winRate||0));
  if (sort === "name") list = [...list].sort((a,b)=>a.name.localeCompare(b.name));

  const me = getMyFantasyParticipant();
  if (!me) return;
  const mine = new Set(squadPlayerKeys(me.squad));
  const open = isFantasyMarketOpen();
  const rank = document.getElementById("fxFilterRank")?.value;
  const maxRaw = document.getElementById("fxFilterMax")?.value;
  const availability = document.getElementById("fxFilterAvailability")?.value;
  if (rank) list = list.filter(p => p.rank === rank);
  if (maxRaw !== undefined && maxRaw !== "") list = list.filter(p => playerPrice(p.key) <= Number(maxRaw));
  const target = fantasyTargetSlot(me);
  if (availability === "selected") list = list.filter(p => mine.has(p.key));
  if (availability === "available") list = list.filter(p => tryAddToSquad(me, p.key, target).ok);
  if (!list.length) {
    grid.innerHTML = `<div class="fx-state-card"><div class="fx-state-icon">⌕</div><h3>Nenhum agente encontrado</h3><p>Ajuste os filtros ou aguarde os dados oficiais do TransferJet carregarem.</p></div>`;
    return;
  }
  grid.innerHTML = list.map(p => {
    const sel = mine.has(p.key);
    const offer = tryAddToSquad(me, p.key, target);
    const reason = sel ? "No seu elenco" : (offer.ok ? `Saldo após ${offer.replaced ? "troca" : "compra"}: ${formatUSD(offer.budgetRemaining, true)}` : offer.error);
    const cost = offer.ok && offer.replaced ? ` · Custo líquido: ${formatUSD(me.budgetRemaining - offer.budgetRemaining, true)}` : "";
    const mainAction = open
      ? (sel
        ? `<button class="fx-btn sm ghost" onclick="event.stopPropagation();fxRemove('${fxEscapeInlineKey(p.key)}')">Remover</button>`
        : `<button class="fx-btn sm primary" ${offer.ok ? "" : "disabled"} onclick="event.stopPropagation();fxAdd('${fxEscapeInlineKey(p.key)}')">Escalar</button>`)
      : "";
    const actions = `<button class="fx-btn sm ghost" onclick="event.stopPropagation();fxOpenPlayerProfile('${fxEscapeInlineKey(p.key)}')">Perfil</button>${mainAction}`;
    return fantasyCardHTML(p, { selected: sel, actions: `<p class="fx-hint">${fxEscapeHTML(reason + cost)}</p><div class="fx-card-actions">${actions}</div>` });
  }).join("");
}

async function fxAdd(key) {
  return fxRunSquadAction(me => {
    const result = tryAddToSquad(me, key, fantasyTargetSlot(me));
    return result;
  }, "Escalação salva.");
}

/* ========== RANKING ========== */
function renderFantasyRanking(container) {
  const f = window.AppState.fantasy;
  const tab = window._fxRankTab || "overall";
  const myId = f.session?.participantId;
  const rounds = Object.entries(f.rounds || {}).map(([id, round]) => ({ ...round, id })).sort((a,b) => (b.rodadaNumber || 0) - (a.rodadaNumber || 0));
  const selectedRound = window._fxRankingRound || fantasySettings().currentRoundId || rounds[0]?.id;

  let rows = [];
  if (tab === "round") {
    const rid = selectedRound;
    const scores = (f.scores || {})[rid] || {};
    rows = Object.entries(scores).map(([id, sc]) => ({
      id,
      points: sc.total || 0,
      name: sc.displayName || f.participants[id]?.displayName || id,
      team: sc.teamName || f.participants[id]?.teamName || "",
      extra: ""
    }));
  } else if (tab === "equity") {
    rows = Object.entries(f.participants || {}).map(([id, p]) => ({
      id,
      points: fantasyEquity(p),
      name: p.displayName || id,
      team: p.teamName || "",
      extra: "patrimônio"
    }));
  } else {
    const totals = Object.keys(f.scores || {}).length ? fantasyOverallFromScores(f.scores) : (f.leaderboard?.overall || {});
    rows = Object.entries(totals).map(([id, v]) => ({
      id,
      points: v.points || 0,
      name: v.displayName || f.participants[id]?.displayName || id,
      team: v.teamName || f.participants[id]?.teamName || "",
      extra: ""
    }));
    // include participants with 0
    Object.keys(f.participants || {}).forEach(id => {
      if (!rows.find(r => r.id === id)) {
        rows.push({ id, points: 0, name: f.participants[id].displayName, team: f.participants[id].teamName || "", extra: "" });
      }
    });
  }
  rows.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const medals = ["🥇", "🥈", "🥉"];

  container.innerHTML = `
    <div class="fx-section">
      <div class="fx-section-head">
        <h2>Ranking</h2>
        <div class="fx-tabs">
          <button class="fx-nav-btn ${tab==="overall"?"active":""}" onclick="window._fxRankTab='overall';renderFantasyShell()">Geral</button>
          <button class="fx-nav-btn ${tab==="round"?"active":""}" onclick="window._fxRankTab='round';renderFantasyShell()">Rodada</button>
          <button class="fx-nav-btn ${tab==="equity"?"active":""}" onclick="window._fxRankTab='equity';renderFantasyShell()">Patrimônio</button>
        </div>
      </div>
      ${tab === "round" ? `<label class="fx-round-picker">Rodada <select aria-label="Rodada do ranking" onchange="window._fxRankingRound=this.value;renderFantasyShell()">${rounds.map(r => `<option value="${fxEscapeHTML(r.id)}" ${r.id === selectedRound ? "selected" : ""}>${fxEscapeHTML(r.seasonId || "")} · ${fxEscapeHTML(r.name || r.id)}</option>`).join("")}</select></label>` : ""}
      ${myId ? renderFantasyEvolution(myId) : ""}
      <div class="fx-podium">
        ${rows.slice(0,3).map((r,i) => `
          <div class="fx-podium-card place-${i+1}">
            <div class="fx-podium-medal">${medals[i]}</div>
            <div class="fx-podium-name">${fxEscapeHTML(r.name)}</div>
            <div class="fx-podium-pts">${tab==="equity"?(typeof formatUSD==="function"?formatUSD(r.points,true):r.points):r.points+" pts"}</div>
          </div>
        `).join("")}
      </div>
      <div class="fx-rank-list">
        ${rows.map((r,i) => `
          <div class="fx-rank-row ${r.id===myId?"me":""}">
            <span class="fx-rank-pos">${i+1}º</span>
            <span class="fx-rank-name">${fxEscapeHTML(r.name)} <small>${fxEscapeHTML(r.team)}</small></span>
            <span class="fx-rank-pts">${tab==="equity"?(typeof formatUSD==="function"?formatUSD(r.points,true):r.points):r.points}</span>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function renderFantasyEvolution(id) {
  const f = ensureFantasyState();
  const entries = Object.entries(f.scores || {}).filter(([, scores]) => scores?.[id]).map(([rid, scores]) => ({
    rid, points: Number(scores[id].total || 0), round: f.rounds[rid] || { id: rid }
  })).sort((a,b) => String(a.round.snapshot?.capturedAt || a.round.processedAt || a.round.seasonId || "").localeCompare(String(b.round.snapshot?.capturedAt || b.round.processedAt || b.round.seasonId || "")) || (a.round.rodadaNumber || 0) - (b.round.rodadaNumber || 0));
  if (!entries.length) return `<p class="fx-hint">Sua evolução aparece após a primeira rodada processada.</p>`;
  let total = 0;
  entries.forEach(e => { total = Math.round((total + e.points) * 10) / 10; e.total = total; });
  const min = Math.min(0, ...entries.map(e => e.total));
  const max = Math.max(1, ...entries.map(e => e.total));
  const coords = entries.map((e,i) => `${20 + (entries.length === 1 ? 260 : i * 520 / (entries.length - 1))},${110 - (e.total-min)/(max-min)*90}`).join(" ");
  const description = entries.map(e => `${e.round.name || e.rid}: ${e.points} pontos; acumulado ${e.total}`).join(". ");
  return `<figure class="fx-evolution"><figcaption>Sua evolução · ${total} pts acumulados</figcaption>
    <svg viewBox="0 0 560 130" role="img" aria-label="${fxEscapeHTML(description)}"><title>${fxEscapeHTML(description)}</title>
      <line x1="20" y1="${110-(0-min)/(max-min)*90}" x2="540" y2="${110-(0-min)/(max-min)*90}" stroke="currentColor" opacity=".2"/>
      <polyline points="${coords}" fill="none" stroke="currentColor" stroke-width="3"/>
      ${coords.split(" ").map(point => { const [x,y] = point.split(","); return `<circle cx="${x}" cy="${y}" r="4" fill="currentColor"/>`; }).join("")}</svg>
    <details><summary>Pontos por rodada</summary><ul>${entries.map(e => `<li>${fxEscapeHTML(e.round.seasonId || "")} · ${fxEscapeHTML(e.round.name || e.rid)}: ${e.points} pts · acumulado ${e.total}</li>`).join("")}</ul></details></figure>`;
}

/* ========== ROUNDS ========== */
function renderFantasyRounds(container) {
  const f = ensureFantasyState();
  const rounds = Object.entries(f.rounds || {}).map(([id, round]) => ({ ...round, id })).sort((a,b) => (b.rodadaNumber||0)-(a.rodadaNumber||0));
  const myId = f.session?.participantId;
  container.innerHTML = `<div class="fx-section"><h2>Rodadas</h2><div class="fx-rounds">${rounds.map(r => {
    const sc = myId && f.scores?.[r.id]?.[myId];
    const official = myId && r.snapshot?.participants?.[myId];
    return `<article class="fx-round-card">
      <div class="fx-round-title">${fxEscapeHTML(r.name || "Rodada " + r.rodadaNumber)}</div>
      <div class="fx-round-meta">${fxEscapeHTML(r.seasonId || "")} · ${fxEscapeHTML(r.status || "")}</div>
      ${r.snapshot ? `<p class="fx-hint">Escalações oficiais salvas: ${fxEscapeHTML(r.snapshot.capturedAt)}</p>` : `<p class="fx-hint">${r.status === "PROCESSED" ? "Histórico legado preservado, sem cópia oficial." : "Aguardando fechamento e cópia oficial."}</p>`}
      <div class="fx-round-pts">${sc ? Number(sc.total) + " pts" : "—"}</div>
      ${official?.valid === false || sc?.valid === false ? `<div class="fx-errors">Escalação inválida: ${(sc?.errors || official?.errors || []).map(fxEscapeHTML).join(" · ")}</div>` : ""}
      ${sc?.breakdown?.length ? `<details><summary>Ver pontuação por agente</summary><ul class="fx-score-details">${sc.breakdown.map(b => `<li><strong>${fxEscapeHTML(b.name || b.playerKey)}</strong> · ${fxEscapeHTML(b.club || "")} · ${fxEscapeHTML(b.role)} · <strong>${Number(b.points)} pts</strong><ul>${(b.events || []).map(event => `<li>${fxEscapeHTML(event)}</li>`).join("")}</ul></li>`).join("")}</ul></details>` : ""}
      ${r.analysisCache?.text ? `<section class="fx-analysis"><h3>Análise da rodada</h3><p>${fxEscapeHTML(r.analysisCache.text)}</p><small>${r.analysisCache.source === "reviewed" ? "Revisada pelo administrador" : "Análise legada"}</small></section>` : ""}
    </article>`;
  }).join("") || "<p class='fx-hint'>Nenhuma rodada ainda.</p>"}</div></div>`;
}

window.enterFantasyMode = enterFantasyMode;
window.exitFantasyMode = exitFantasyMode;
window.showFantasyView = showFantasyView;
window.renderFantasyShell = renderFantasyShell;
window.fantasyDoLogin = fantasyDoLogin;
window.fantasyLogout = fantasyLogout;
window.fxRemove = fxRemove;
window.fxCaptain = fxCaptain;
window.fxAdd = fxAdd;
window.fxFilterMarket = fxFilterMarket;
window.fxOpenPlayerProfile = fxOpenPlayerProfile;
window.fxOpenMarketForSlot = fxOpenMarketForSlot;
window.fxClearTargetSlot = fxClearTargetSlot;
window.fxToast = fxToast;
