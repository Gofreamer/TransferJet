/* Jet Fantasy — shell, navegação e views */

function fxEscapeInlineKey(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
window.FANTASY = window.FANTASY || {};

function enterFantasyMode() {
  ensureFantasyState();
  window.AppState.fantasy.active = true;
  document.body.classList.add("fantasy-mode");
  applyFantasyAtmosphere();
  const shell = document.getElementById("fantasyShell");
  if (shell) shell.classList.remove("hidden");
  document.querySelector("header")?.classList.add("fx-hide");
  document.querySelector(".hero")?.classList.add("fx-hide");
  document.querySelector("footer")?.classList.add("fx-hide");
  document.querySelector("main")?.classList.add("fx-hide-official");
  ensureFantasySeeded().catch(() => {});
  renderFantasyShell();
}

function exitFantasyMode() {
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
  if (view === "hub") renderFantasyHub(content);
  else if (view === "squad") renderFantasySquad(content);
  else if (view === "market") renderFantasyMarketView(content);
  else if (view === "ranking") renderFantasyRanking(content);
  else if (view === "rounds") renderFantasyRounds(content);

  if (open && s.marketClosesAt) startFxCountdown(s.marketClosesAt);
}

function startFxCountdown(iso) {
  const el = document.getElementById("fxCountdown");
  if (!el) return;
  function tick() {
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
    requestAnimationFrame(() => setTimeout(tick, 1000));
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

/* ========== HUB ========== */
function renderFantasyHub(container) {
  const me = getMyFantasyParticipant();
  if (!me) return renderFantasyLogin(container);

  const f = window.AppState.fantasy;
  const s = fantasySettings();
  const roundId = s.currentRoundId;
  const overall = (f.leaderboard?.overall || {})[me.id === undefined ? f.session.participantId : f.session.participantId];
  // find my id
  const myId = f.session.participantId;
  const myOverall = (f.leaderboard?.overall || {})[myId] || {};
  const myRound = roundId ? ((f.scores || {})[roundId] || {})[myId] : null;
  const equity = fantasyEquity(me);
  const open = isFantasyMarketOpen();

  // position
  const ranked = Object.entries(f.leaderboard?.overall || {})
    .map(([id, v]) => ({ id, points: v.points || 0 }))
    .sort((a, b) => b.points - a.points);
  const pos = ranked.findIndex(r => r.id === myId) + 1;

  const map = fantasyPlayerMap();
  const squad = me.squad || emptySquad();
  const analysis = roundId && f.rounds?.[roundId]?.analysisCache?.text;

  container.innerHTML = `
    <div class="fx-hub">
      <div class="fx-hub-top">
        <div>
          <div class="fx-kicker">${s.seasonId || ""} · ${s.currentRoundId || "—"}</div>
          <h1 class="fx-title">Olá, ${me.displayName}</h1>
          <p class="fx-sub">${me.teamName || "Meu esquadrão"}</p>
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
          <p>${analysis}</p>
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
  const map = fantasyPlayerMap();
  const squad = me.squad || emptySquad();
  const val = validateSquad(squad, me.budgetRemaining);

  container.innerHTML = `
    <div class="fx-section">
      <div class="fx-section-head">
        <h2>Montar time</h2>
        <div class="fx-budget">Orçamento: <strong>${typeof formatUSD==="function"?formatUSD(me.budgetRemaining||0,true):me.budgetRemaining}</strong></div>
      </div>
      ${!open ? `<p class="fx-warn">🔒 Mercado fechado — escalação bloqueada.</p>` : ""}
      ${!val.ok ? `<div class="fx-errors">${val.errors.map(e=>`<div>• ${e}</div>`).join("")}</div>` : `<div class="fx-ok">✓ Elenco válido</div>`}
      <div class="fx-squad-edit">
        ${(squad.starters||[null,null,null,null,null]).map((k,i) => `
          <div class="fx-slot">
            <div class="fx-slot-label">Titular ${i+1}</div>
            ${fantasyCardHTML(map[k], { captain: k&&k===squad.captainKey })}
            ${open ? `<div class="fx-slot-actions">
              <button class="fx-btn sm" onclick="showFantasyView('market')">Trocar</button>
              ${k?`<button class="fx-btn sm ghost" onclick="fxRemove('${fxEscapeInlineKey(k)}')">Remover</button>`:""}
              ${k&&k!==squad.captainKey?`<button class="fx-btn sm gold" onclick="fxCaptain('${fxEscapeInlineKey(k)}')">⭐ Capitão</button>`:""}
            </div>`:""}
          </div>
        `).join("")}
      </div>
      <div class="fx-slot" style="max-width:220px;margin-top:16px">
        <div class="fx-slot-label">Reserva</div>
        ${fantasyCardHTML(map[squad.bench], { bench: true, emptyLabel: "Vazio" })}
        ${open && squad.bench ? `<button class="fx-btn sm ghost" onclick="fxRemove('${fxEscapeInlineKey(squad.bench)}')">Remover</button>`:""}
      </div>
    </div>
  `;
}

async function fxRemove(key) {
  const me = getMyFantasyParticipant();
  const id = window.AppState.fantasy.session.participantId;
  if (!me || !id) return;
  const r = tryRemoveFromSquad(me, key);
  if (!r.ok) return alert(r.error);
  await updateFantasyParticipant(id, { squad: r.squad, budgetRemaining: r.budgetRemaining });
}

async function fxCaptain(key) {
  const me = getMyFantasyParticipant();
  const id = window.AppState.fantasy.session.participantId;
  if (!me || !id) return;
  const r = trySetCaptain(me, key);
  if (!r.ok) return alert(r.error);
  await updateFantasyParticipant(id, { squad: r.squad });
}

/* ========== MARKET ========== */
function renderFantasyMarketView(container) {
  const me = getMyFantasyParticipant();
  if (!me) return renderFantasyLogin(container);
  const open = isFantasyMarketOpen();
  const players = (typeof getAllPlayersFlat === "function" ? getAllPlayersFlat() : [])
    .filter(p => p.marketValue > 0 && p.club !== "Livre")
    .sort((a, b) => (b.marketValue || 0) - (a.marketValue || 0));
  const clubs = [...new Set(players.map(p => p.club))].sort();
  const mine = new Set(squadPlayerKeys(me.squad || emptySquad()));

  container.innerHTML = `
    <div class="fx-section">
      <div class="fx-section-head">
        <h2>Mercado</h2>
        <div class="fx-budget">Disponível: <strong>${typeof formatUSD==="function"?formatUSD(me.budgetRemaining||0,true):me.budgetRemaining}</strong>
          · Máx. 2 por equipe</div>
      </div>
      ${!open ? `<p class="fx-warn">🔒 Mercado fechado</p>` : ""}
      <div class="fx-filters">
        <select id="fxFilterClub" onchange="fxFilterMarket()">
          <option value="">Todas equipes</option>
          ${clubs.map(c => `<option value="${c}">${c}</option>`).join("")}
        </select>
        <select id="fxFilterSort" onchange="fxFilterMarket()">
          <option value="value">Maior valor</option>
          <option value="value-asc">Menor valor</option>
          <option value="wr">Melhor WR</option>
          <option value="name">Nome</option>
        </select>
        <input type="search" id="fxFilterQ" class="fx-input" placeholder="Buscar..." oninput="fxFilterMarket()"/>
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

  const mine = window._fxMarketMine || new Set();
  const open = window._fxMarketOpen;
  grid.innerHTML = list.slice(0, 80).map(p => {
    const sel = mine.has(p.key);
    const actions = open
      ? (sel
        ? `<button class="fx-btn sm ghost" onclick="event.stopPropagation();fxRemove('${fxEscapeInlineKey(p.key)}')">Remover</button>`
        : `<button class="fx-btn sm primary" onclick="event.stopPropagation();fxAdd('${fxEscapeInlineKey(p.key)}')">Escalar</button>`)
      : "";
    return fantasyCardHTML(p, { selected: sel, actions: actions ? `<div class="fx-card-actions">${actions}</div>` : "" });
  }).join("");
}

async function fxAdd(key) {
  const me = getMyFantasyParticipant();
  const id = window.AppState.fantasy.session.participantId;
  if (!me || !id) return;
  const slot = firstEmptyStarterSlot(me.squad);
  const target = slot >= 0 ? slot : (me.squad?.bench ? null : "bench");
  if (target === null) return alert("Elenco cheio. Remova alguém antes.");
  const r = tryAddToSquad(me, key, target);
  if (!r.ok) return alert(r.error);
  await updateFantasyParticipant(id, {
    squad: r.squad,
    budgetRemaining: r.budgetRemaining,
    acquisitions: r.acquisitions
  });
}

/* ========== RANKING ========== */
function renderFantasyRanking(container) {
  const f = window.AppState.fantasy;
  const tab = window._fxRankTab || "overall";
  const myId = f.session?.participantId;

  let rows = [];
  if (tab === "round") {
    const rid = fantasySettings().currentRoundId;
    const scores = (f.scores || {})[rid] || {};
    rows = Object.entries(scores).map(([id, sc]) => ({
      id,
      points: sc.total || 0,
      name: f.participants[id]?.displayName || id,
      team: f.participants[id]?.teamName || "",
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
    rows = Object.entries(f.leaderboard?.overall || {}).map(([id, v]) => ({
      id,
      points: v.points || 0,
      name: f.participants[id]?.displayName || id,
      team: f.participants[id]?.teamName || "",
      extra: ""
    }));
    // include participants with 0
    Object.keys(f.participants || {}).forEach(id => {
      if (!rows.find(r => r.id === id)) {
        rows.push({ id, points: 0, name: f.participants[id].displayName, team: f.participants[id].teamName || "", extra: "" });
      }
    });
  }
  rows.sort((a, b) => b.points - a.points);
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
      <div class="fx-podium">
        ${rows.slice(0,3).map((r,i) => `
          <div class="fx-podium-card place-${i+1}">
            <div class="fx-podium-medal">${medals[i]}</div>
            <div class="fx-podium-name">${r.name}</div>
            <div class="fx-podium-pts">${tab==="equity"?(typeof formatUSD==="function"?formatUSD(r.points,true):r.points):r.points+" pts"}</div>
          </div>
        `).join("")}
      </div>
      <div class="fx-rank-list">
        ${rows.map((r,i) => `
          <div class="fx-rank-row ${r.id===myId?"me":""}">
            <span class="fx-rank-pos">${i+1}º</span>
            <span class="fx-rank-name">${r.name} <small>${r.team}</small></span>
            <span class="fx-rank-pts">${tab==="equity"?(typeof formatUSD==="function"?formatUSD(r.points,true):r.points):r.points}</span>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

/* ========== ROUNDS ========== */
function renderFantasyRounds(container) {
  const rounds = Object.values(window.AppState.fantasy.rounds || {}).sort((a,b) => (b.rodadaNumber||0)-(a.rodadaNumber||0));
  const myId = window.AppState.fantasy.session?.participantId;
  container.innerHTML = `
    <div class="fx-section">
      <h2>Rodadas</h2>
      <div class="fx-rounds">
        ${rounds.map(r => {
          const sc = myId && (window.AppState.fantasy.scores||{})[r.id]?.[myId];
          return `
            <div class="fx-round-card status-${(r.status||"").toLowerCase()}">
              <div class="fx-round-title">${r.name || "Rodada "+r.rodadaNumber}</div>
              <div class="fx-round-meta">${r.seasonId || ""} · ${r.status}</div>
              <div class="fx-round-pts">${sc ? sc.total+" pts" : "—"}</div>
            </div>
          `;
        }).join("") || "<p class='fx-hint'>Nenhuma rodada ainda.</p>"}
      </div>
    </div>
  `;
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
