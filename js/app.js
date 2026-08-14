/* Jet Transfer — App principal */

function showView(viewName, el) {
  // Esconde todas as views
  document.querySelectorAll("[id^='view-']").forEach(v => v.classList.add("hidden"));

  // Mostra a view pedida
  const target = document.getElementById("view-" + viewName);
  if (target) target.classList.remove("hidden");

  // Atualiza nav
  document.querySelectorAll(".nav a").forEach(a => a.classList.remove("active"));
  if (el) el.classList.add("active");

  window.AppState.ui.currentView = viewName;

  // Render específico
  if (viewName === "players") renderPlayers();
  if (viewName === "clubs") renderClubs();
  if (viewName === "home") renderHome();
  if (viewName === "transfers") renderTransfers();
}

/* =========================
   RENDER: HOME
   ========================= */
function renderHome() {
  const { rosters, teams, currentSeason } = window.AppState.jet;
  const transfers = window.AppState.transfer.transfers || {};

  const totalPlayers = Object.values(rosters).reduce((acc, list) => acc + (list?.length || 0), 0);
  const totalClubs = Object.keys(rosters).length || teams.length;
  const totalTransfers = Object.keys(transfers).length;

  // Atualiza badges e stats do hero
  document.getElementById("seasonBadge").textContent = currentSeason || "—";
  document.getElementById("statPlayers").textContent = totalPlayers || "—";
  document.getElementById("statClubs").textContent = totalClubs || "—";
  document.getElementById("statTransfers").textContent = totalTransfers;

  const container = document.getElementById("homeContent");
  if (!totalPlayers) {
    container.innerHTML = `<p class="empty-state">Aguardando dados da Jet League...</p>`;
    return;
  }

  // Ranking simples por tamanho de elenco (depois vira ranking de valor)
  const clubRanking = Object.entries(rosters)
    .map(([club, list]) => ({
      club,
      size: list?.length || 0,
      titulares: (list || []).filter(p => p.role === "titular").length
    }))
    .sort((a, b) => b.size - a.size);

  container.innerHTML = `
    <div class="cards-grid">
      ${clubRanking.map(c => `
        <div class="card club-card">
          <div class="card-title">${c.club}</div>
          <div class="club-squad">${c.size} agentes · ${c.titulares} titulares</div>
          <div class="card-meta">
            <span class="tag">Plantel</span>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

/* =========================
   RENDER: PLAYERS
   ========================= */
function renderPlayers() {
  const rosters = window.AppState.jet.rosters || {};
  const playersData = window.AppState.transfer.players || {};
  const listEl = document.getElementById("playersList");
  const clubFilter = document.getElementById("playerClubFilter");

  // Preenche filtro de times
  const clubs = Object.keys(rosters).sort();
  const currentFilter = clubFilter.value;
  clubFilter.innerHTML = `<option value="">Todos os times</option>` +
    clubs.map(c => `<option value="${c}" ${c === currentFilter ? "selected" : ""}>${c}</option>`).join("");

  // Monta lista plana de agentes
  let allPlayers = [];
  for (const [club, list] of Object.entries(rosters)) {
    (list || []).forEach((p, idx) => {
      allPlayers.push({
        name: p.n,
        role: p.role || "titular",
        club,
        // dados extras do Transfermarkt (se existirem)
        marketValue: playersData[`${club}_${p.n}`]?.marketValue ?? null,
        id: `${club}_${idx}`
      });
    });
  }

  // Ordena por nome
  allPlayers.sort((a, b) => a.name.localeCompare(b.name));

  window._allPlayersCache = allPlayers; // cache para filtro
  filterPlayers();
}

function filterPlayers() {
  const search = (document.getElementById("playerSearch")?.value || "").toLowerCase().trim();
  const club = document.getElementById("playerClubFilter")?.value || "";
  const listEl = document.getElementById("playersList");
  const players = window._allPlayersCache || [];

  const filtered = players.filter(p => {
    const matchName = !search || p.name.toLowerCase().includes(search);
    const matchClub = !club || p.club === club;
    return matchName && matchClub;
  });

  if (!filtered.length) {
    listEl.innerHTML = `<p class="empty-state">Nenhum agente encontrado.</p>`;
    return;
  }

  listEl.innerHTML = filtered.map(p => {
    const valueText = p.marketValue
      ? formatValue(p.marketValue)
      : `<span style="color:var(--text-muted);font-size:0.85rem">Sem valor</span>`;

    return `
      <div class="card">
        <div class="card-title">${p.name}</div>
        <div class="card-sub">${p.club}</div>
        <div class="card-value">${valueText}</div>
        <div class="card-meta">
          <span class="tag ${p.role}">${roleLabel(p.role)}</span>
        </div>
      </div>
    `;
  }).join("");
}

/* =========================
   RENDER: CLUBS
   ========================= */
function renderClubs() {
  const rosters = window.AppState.jet.rosters || {};
  const listEl = document.getElementById("clubsList");

  const clubs = Object.entries(rosters)
    .map(([name, list]) => ({
      name,
      size: list?.length || 0,
      titulares: (list || []).filter(p => p.role === "titular").length,
      reservas: (list || []).filter(p => p.role === "reserva").length,
      emergencia: (list || []).filter(p => p.role === "emergencia").length
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (!clubs.length) {
    listEl.innerHTML = `<p class="empty-state">Nenhum time encontrado.</p>`;
    return;
  }

  listEl.innerHTML = clubs.map(c => `
    <div class="card club-card">
      <div class="card-title">${c.name}</div>
      <div class="club-value">${c.size} agentes</div>
      <div class="club-squad">
        ${c.titulares} titulares · ${c.reservas} reservas · ${c.emergencia} emergência
      </div>
    </div>
  `).join("");
}

/* =========================
   RENDER: TRANSFERS
   ========================= */
function renderTransfers() {
  const transfers = window.AppState.transfer.transfers || {};
  const listEl = document.getElementById("transfersList");
  const entries = Object.entries(transfers);

  if (!entries.length) {
    listEl.innerHTML = `<p class="empty-state">Nenhuma transferência registrada ainda.<br>Quando você registrar a primeira, ela aparecerá aqui.</p>`;
    return;
  }

  // TODO: render lista cronológica
  listEl.innerHTML = `<p class="empty-state">${entries.length} transferência(s) no banco (render em breve).</p>`;
}

/* =========================
   HELPERS
   ========================= */
function roleLabel(role) {
  if (role === "titular") return "Titular";
  if (role === "reserva") return "Reserva";
  return "Emergência";
}

function formatValue(value) {
  if (value == null) return "—";
  const symbol = window.AppState.transfer.settings.currencySymbol || "JC";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M ${symbol}`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K ${symbol}`;
  return `${value} ${symbol}`;
}

/* =========================
   INICIALIZAÇÃO
   ========================= */
document.addEventListener("DOMContentLoaded", () => {
  console.log("[Jet Transfer] Iniciando...");

  // Inicia listeners
  startJetListeners();
  startTransferListeners();

  // Reage a atualizações do Jet League
  document.addEventListener("jet:rosters-updated", () => {
    if (window.AppState.ui.currentView === "home") renderHome();
    if (window.AppState.ui.currentView === "players") renderPlayers();
    if (window.AppState.ui.currentView === "clubs") renderClubs();
  });

  document.addEventListener("jet:season-updated", (e) => {
    document.getElementById("seasonBadge").textContent = e.detail || "—";
  });

  document.addEventListener("transfer:players-updated", () => {
    if (window.AppState.ui.currentView === "players") renderPlayers();
  });

  // Render inicial
  renderHome();
});
