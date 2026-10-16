/* Jet Market — App principal */

/* ========== NAVIGATION ========== */
function showView(viewName, el) {
  document.querySelectorAll("[id^='view-']").forEach(v => v.classList.add("hidden"));
  const target = document.getElementById("view-" + viewName);
  if (target) target.classList.remove("hidden");

  document.querySelectorAll(".nav a").forEach(a => a.classList.remove("active"));
  if (el) el.classList.add("active");
  else {
    const navEl = document.querySelector(`.nav a[data-view="${viewName}"]`);
    if (navEl) navEl.classList.add("active");
  }

  window.AppState.ui.currentView = viewName;

  if (viewName === "home") renderHome();
  if (viewName === "players") renderPlayers();
  if (viewName === "clubs") renderClubs();
  if (viewName === "compare") renderCompare();
  if (viewName === "transfers") renderTransfers();
  if (viewName === "rumors") renderRumors();
  if (viewName === "rankings") renderRankings();
}


function escapeInlineJsSingle(value) {
  return escapeHTML(String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029"));
}

/* ========== HELPERS DE DADOS ========== */
function normalizeTitles(m) {
  const t = (m && m.titles) || {};
  const titles = {
    nacional: Number(t.nacional) || 0,
    lji: Number(t.lji) || 0,
    mundial: Number(t.mundial) || 0,
    eventoEspecial: Number(t.eventoEspecial) || 0
  };
  // Compat: se não tem titles mas tem trophy numérico, assume Nacional
  if (!m?.titles && (m?.trophy > 0)) {
    titles.nacional = Number(m.trophy) || 0;
  }
  return titles;
}

function titlesTotal(titles) {
  if (!titles) return 0;
  return (titles.nacional || 0) + (titles.lji || 0) + (titles.mundial || 0) + (titles.eventoEspecial || 0);
}

function renderTitlesBadges(titles, opts = {}) {
  if (!titles) return "";
  const items = [];
  if (titles.nacional > 0) items.push(`<span class="title-badge nacional" title="Nacional">🥇${titles.nacional > 1 ? "×" + titles.nacional : ""}</span>`);
  if (titles.lji > 0) items.push(`<span class="title-badge lji" title="L.J.I">🥈${titles.lji > 1 ? "×" + titles.lji : ""}</span>`);
  if (titles.mundial > 0) items.push(`<span class="title-badge mundial" title="Mundial">🏆${titles.mundial > 1 ? "×" + titles.mundial : ""}</span>`);
  if (titles.eventoEspecial > 0) items.push(`<span class="title-badge evento" title="Evento Especial">🏅${titles.eventoEspecial > 1 ? "×" + titles.eventoEspecial : ""}</span>`);
  if (!items.length) return opts.empty || "";
  return `<span class="titles-row">${items.join("")}</span>`;
}

function buildPlayerFromMarket(key, m, defaults = {}) {
  const st = m.stats || {};
  const titles = normalizeTitles(m);
  const status = (m.status || defaults.status || "ativo").toLowerCase();
  const fx = typeof agentStatusEffects === "function" ? agentStatusEffects(status) : {};
  const isFree = !!(m.freeAgent || fx.isFree || status === "livre");
  const club = defaults.club
    || fx.clubOverride
    || (isFree ? "Livre" : (key.split("_")[0] || "—"));
  return {
    key,
    id: m.id || "legacy:" + key,
    name: m.name || defaults.name || key.split("_").slice(1).join("_") || key,
    role: defaults.role || m.role || "titular",
    club,
    marketValue: m.marketValue ?? null,
    peakValue: m.peakValue ?? null,
    nationality: m.nationality || "—",
    age: m.age || null,
    contractUntil: m.contractUntil || "—",
    contractMode: m.contractMode || "",
    contractStart: m.contractStart || "",
    contractStartDate: m.contractStartDate || "",
    contractEndDate: m.contractEndDate || "",
    careerHistory: m.careerHistory || {},
    achievements: m.achievements || {},
    bio: m.bio || "",
    description: m.description || "",
    notes: m.notes || "",
    leagueExit: m.leagueExit || null,
    status,
    photo: m.photo || "",
    valueHistory: m.valueHistory || [],
    valueEvents: m.valueEvents || {},
    changeLog: m.changeLog || {},
    rank: m.rank || "—",
    functionRole: m.functionRole || defaults.functionRole || "",
    trophy: titlesTotal(titles),
    titles,
    salary: m.salary ?? null,
    releaseClause: m.releaseClause ?? null,
    freeAgent: isFree,
    retired: !!fx.isRetired,
    canTransfer: fx.canTransfer !== false,
    fantasyEligible: fx.fantasyEligible !== false && m.fantasyEligible !== false,
    stats: {
      P: st.P ?? 0,
      V: st.V ?? 0,
      D: st.D ?? 0,
      winRate: st.winRate ?? (st.P ? st.V / st.P : 0)
    },
    statsRound: m.statsRound || "",
    statsSeason: m.statsSeason || ""
  };
}

function getAllPlayersFlat() {
  const rosters = window.AppState.jet.rosters || {};
  const marketPlayers = window.AppState.market.players || {};
  const list = [];
  const seen = new Set();
  const bindings = new Map();
  Object.entries(marketPlayers).forEach(([key, m]) => {
    if (m?.team && m.name) bindings.set(playerKey(m.team, m.name), key);
  });

  for (const [club, agents] of Object.entries(rosters)) {
    (agents || []).forEach((p) => {
      // A chave antiga continua válida depois da transferência, inclusive no Fantasy.
      const exactKey = playerKey(club, p.n);
      const key = bindings.get(exactKey) || exactKey;
      const m = marketPlayers[key] || {};
      if (seen.has(key) || (m.team && m.team !== club)) return;
      const status = (m.status || "ativo").toLowerCase();
      const fx = typeof agentStatusEffects === "function" ? agentStatusEffects(status) : {};
      // Aposentado/livre ainda no elenco da JL: tira do clube e trata como off-roster
      if (fx.offRosterVisible) {
        return;
      }
      const row = buildPlayerFromMarket(key, m, {
        name: p.n,
        role: p.role || "titular",
        club,
        status
      });
      // freeAgent flag no market sem status livre: ainda lista no clube se estiver no elenco
      if (m.freeAgent && !fx.isFree) {
        row.freeAgent = true;
      }
      list.push(row);
      seen.add(key);
    });
  }

  // Fora do elenco: livres, aposentados e freeAgent no Market
  Object.entries(marketPlayers).forEach(([key, m]) => {
    if (!m || seen.has(key)) return;
    const status = (m.status || "").toLowerCase();
    const fx = typeof agentStatusEffects === "function" ? agentStatusEffects(status) : {};
    const include = !!m.team || !!m.freeAgent || fx.offRosterVisible || status === "livre" || status === "aposentado";
    if (!include) return;

    if (status === "aposentado" || fx.isRetired) {
      list.push(buildPlayerFromMarket(key, { ...m, status: "aposentado", freeAgent: false }, {
        club: "Aposentado",
        functionRole: m.functionRole || "Aposentado",
        status: "aposentado"
      }));
    } else if (m.team && !m.freeAgent && !fx.isFree) {
      list.push(buildPlayerFromMarket(key, m, { club: m.team }));
    } else {
      list.push(buildPlayerFromMarket(key, { ...m, status: status || "livre", freeAgent: true }, {
        club: "Livre",
        functionRole: m.functionRole || "Agente livre",
        status: "livre"
      }));
    }
    seen.add(key);
  });

  return list;
}

function isTransferWindowOpen() {
  return !!(window.AppState.market.settings && window.AppState.market.settings.transferWindowOpen);
}

function updateTransferWindowBadge() {
  const el = document.getElementById("transferWindowBadge");
  if (!el) return;
  const open = isTransferWindowOpen();
  el.textContent = open ? "JANELA ABERTA" : "JANELA FECHADA";
  el.className = "window-badge " + (open ? "open" : "closed");
}

function getJetLeagueUrl() {
  const fallback = "https://teste-jet.pages.dev";
  try {
    const url = new URL(window.AppState.market.settings?.jetLeagueUrl || fallback);
    return ["http:", "https:"].includes(url.protocol) ? url.href : fallback;
  } catch (_) { return fallback; }
}

function getClubMarketValue(clubName) {
  const players = getAllPlayersFlat().filter(isCompetitivePlayer).filter(p => p.club === clubName && !p.freeAgent);
  return players.reduce((sum, p) => sum + (p.marketValue || 0), 0);
}

function getTotalMarketValue() {
  return getAllPlayersFlat().filter(isCompetitivePlayer).reduce((sum, p) => sum + (p.marketValue || 0), 0);
}

/* ========== RENDER: HOME ========== */
function renderHome() {
  PremiumUI.renderDashboard();
}

/* ========== RENDER: PLAYERS ========== */
function renderPlayers() {
  let players = getAllPlayersFlat().filter(isCompetitivePlayer);
  const search = (document.getElementById("playerSearch")?.value || "").toLowerCase().trim();
  const club = document.getElementById("playerClubFilter")?.value || "";
  const rankF = document.getElementById("playerRankFilter")?.value || "";
  const roleF = document.getElementById("playerRoleFilter")?.value || "";
  const valueF = document.getElementById("playerValueFilter")?.value || "";
  const sort = document.getElementById("playerSort")?.value || "value-desc";

  const clubs = [...new Set(players.map(p => p.club))].sort();
  const clubFilter = document.getElementById("playerClubFilter");
  if (clubFilter) {
    const current = clubFilter.value;
    clubFilter.innerHTML = `<option value="">Todos os times</option>` +
      clubs.map(c => `<option value="${escapeHTML(c)}" ${c === current ? "selected" : ""}>${escapeHTML(c)}</option>`).join("");
  }

  players = Market.filter(players, { search, club, rank: rankF, role: roleF, status: document.getElementById("playerStatusFilter")?.value || "" });
  if (valueF) {
    players = players.filter(p => {
      const v = p.marketValue || 0;
      if (valueF === "30+") return v >= 30000000;
      if (valueF === "20-30") return v >= 20000000 && v < 30000000;
      if (valueF === "10-20") return v >= 10000000 && v < 20000000;
      if (valueF === "5-10") return v >= 5000000 && v < 10000000;
      if (valueF === "0-5") return v < 5000000;
      return true;
    });
  }

  if (sort === "value-desc") players.sort((a, b) => (b.marketValue || 0) - (a.marketValue || 0));
  else if (sort === "value-asc") players.sort((a, b) => (a.marketValue || 0) - (b.marketValue || 0));
  else if (sort === "wr-desc") players.sort((a, b) => (b.stats?.winRate || 0) - (a.stats?.winRate || 0));
  else if (sort === "change-desc" || sort === "change-asc") {
    players.sort((a, b) => {
      const av = Market.variation(a), bv = Market.variation(b);
      if (!av || !bv) return !av && !bv ? a.name.localeCompare(b.name) : !av ? 1 : -1;
      return sort === "change-desc" ? bv.diff - av.diff : av.diff - bv.diff;
    });
  } else players.sort((a, b) => a.name.localeCompare(b.name));

  const countEl = document.getElementById("playersCount");
  if (countEl) countEl.textContent = players.length;

  const listEl = document.getElementById("playersList");
  if (!listEl) return;
  if (!players.length) {
    listEl.innerHTML = `<p class="empty-state">Nenhum agente encontrado.</p>`;
    return;
  }

  listEl.innerHTML = players.map(p => {
    const wr = p.stats?.P ? Math.round(p.stats.winRate * 100) + "%" : "—";
    return `
    <div class="card" role="button" tabindex="0" onclick="openPlayerProfile('${escapeInlineJsSingle(p.key)}')">
      <div class="card-with-photo">
        ${photoHTML(p, 52)}
        <div class="card-body">
          <div class="card-title">${escapeHTML(p.name)}</div>
          <div class="card-sub">${escapeHTML(p.club)} · ${escapeHTML(p.rank || "—")}${p.stats?.P ? ` · ${p.stats.V}V-${p.stats.D}D (${wr})` : ""}</div>
          <div class="card-value">${p.marketValue ? formatUSD(p.marketValue, true) : '<span style="color:var(--text-muted);font-size:0.85rem">Sem valor</span>'}</div>
          ${MarketUI.movementMarkup(p)}
          <div class="card-meta">
            ${agentStatusEffects(p.status).isRetired || !isCompetitivePlayer(p) ? '' : `<span class="tag ${escapeHTML(p.role)}">${roleLabel(p.role)}</span>`}
            ${typeof renderAgentStatusBadge === "function" ? renderAgentStatusBadge(p.status) : ""}
            ${renderTitlesBadges(p.titles)}
            ${p.functionRole && p.functionRole.includes("Capitão") ? `<span class="tag" style="background:rgba(0,229,255,0.15);color:var(--cyan)">Capitão</span>` : ""}
          </div>
        </div>
      </div>
    </div>`;
  }).join("");
}

/* ========== RENDER: CLUBS ========== */
function renderClubs() {
  const rosters = window.AppState.jet.rosters || {};
  const clubs = Object.keys(rosters).map(name => {
    const agents = getAllPlayersFlat().filter(isCompetitivePlayer).filter(p => p.club === name);
    const totalValue = agents.reduce((s, p) => s + (p.marketValue || 0), 0);
    const avg = agents.length ? totalValue / agents.length : 0;
    const topAgent = [...agents].sort((a, b) => (b.marketValue || 0) - (a.marketValue || 0))[0];
    return {
      name,
      size: agents.length,
      totalValue,
      avg,
      topAgent: topAgent ? topAgent.name : "—",
      topValue: topAgent ? topAgent.marketValue : 0
    };
  }).sort((a, b) => b.totalValue - a.totalValue);

  document.getElementById("clubsCount").textContent = clubs.length;

  const listEl = document.getElementById("clubsList");
  if (!clubs.length) {
    listEl.innerHTML = `<p class="empty-state">Nenhuma equipe encontrada.</p>`;
    return;
  }

  listEl.innerHTML = clubs.map((c, i) => `
    <div class="card" role="button" tabindex="0" onclick="openClubProfile('${escapeInlineJsSingle(c.name)}')">
      <div class="card-title">${escapeHTML(c.name)}</div>
      <div class="card-sub">#${i + 1} em valor de mercado</div>
      <div class="card-value">${formatUSD(c.totalValue, true)}</div>
      <div class="card-meta">
        <span class="tag">${c.size} agentes</span>
        <span class="tag">Média ${formatUSD(c.avg, true)}</span>
      </div>
      <div style="margin-top:8px;font-size:0.8rem;color:var(--text-muted)">
        Mais valioso: <strong style="color:var(--text)">${escapeHTML(c.topAgent)}</strong>
      </div>
    </div>
  `).join("");
}

/* ========== RENDER: TRANSFERS ========== */
function renderTransfers() {
  let transfers = Object.entries(window.AppState.market.transfers || {}).map(([id, t]) => ({ id, ...t }));
  const seasonF = document.getElementById("transferSeasonFilter")?.value || "";
  const clubF = document.getElementById("transferClubFilter")?.value || "";

  // Preenche filtros
  const seasons = [...new Set(transfers.map(t => t.season).filter(Boolean))].sort();
  const clubs = [...new Set(transfers.flatMap(t => [t.from, t.to]).filter(Boolean))].sort();
  const seasonEl = document.getElementById("transferSeasonFilter");
  const clubEl = document.getElementById("transferClubFilter");
  const curS = seasonEl.value, curC = clubEl.value;
  seasonEl.innerHTML = `<option value="">Todas as temporadas</option>` + seasons.map(s => `<option value="${s}" ${s===curS?"selected":""}>${s}</option>`).join("");
  clubEl.innerHTML = `<option value="">Todas as equipes</option>` + clubs.map(c => `<option value="${c}" ${c===curC?"selected":""}>${c}</option>`).join("");

  if (seasonF) transfers = transfers.filter(t => t.season === seasonF);
  if (clubF) transfers = transfers.filter(t => t.from === clubF || t.to === clubF);

  transfers.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const listEl = document.getElementById("transfersList");
  if (!transfers.length) {
    listEl.innerHTML = `<p class="empty-state">Nenhuma transferência encontrada.</p>`;
    return;
  }

  listEl.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Agente</th><th>Origem</th><th>Destino</th><th>Valor</th><th>Tipo</th><th>Data</th><th>Status</th></tr></thead>
        <tbody>
          ${transfers.map(t => {
            const st = statusLabel(t.status);
            return `<tr>
              <td><span class="player-link" onclick="openPlayerProfile('${escapeInlineJsSingle(t.playerKey)}')">${escapeHTML(t.playerName)}</span></td>
              <td>${escapeHTML(t.from)}</td>
              <td><strong>${escapeHTML(t.to)}</strong></td>
              <td style="color:var(--cyan);font-weight:700">${formatUSD(t.fee)}</td>
              <td>${t.type || "—"}</td>
              <td>${t.date || "—"}</td>
              <td><span class="status-badge" style="background:${st.color}22;color:${st.color}">${st.icon} ${st.label}</span></td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

/* ========== RENDER: RUMORS ========== */
function renderRumors() {
  const rumors = Object.values(window.AppState.market.rumors || {})
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const listEl = document.getElementById("rumorsList");
  if (!rumors.length) {
    listEl.innerHTML = `<p class="empty-state">Nenhum rumor registrado.</p>`;
    return;
  }

  listEl.innerHTML = rumors.map(r => {
    const st = statusLabel(r.status);
    return `
      <div class="rumor-card">
        <div class="rumor-header">
          <div>
            <div class="rumor-title">${r.interestedClub} tem interesse em ${escapeHTML(r.playerName)}</div>
            <div style="font-size:0.8rem;color:var(--text-muted);margin-top:2px">${r.currentClub} → ${r.interestedClub}</div>
          </div>
          <span class="status-badge" style="background:${st.color}22;color:${st.color}">${st.icon} ${st.label}</span>
        </div>
        <div class="rumor-desc">${r.description}</div>
        <div class="rumor-meta">
          <span>Confiabilidade: <strong style="color:var(--cyan)">${r.reliability}%</strong></span>
          <span>${r.date}</span>
          <span>${r.season}</span>
        </div>
      </div>
    `;
  }).join("");
}

/* ========== RENDER: COMPARE ========== */
function renderCompare() {
  const players = getAllPlayersFlat().sort((a, b) => a.name.localeCompare(b.name));
  const opts = players.map(p => `<option value="${escapeHTML(p.key)}">${escapeHTML(p.name)} (${escapeHTML(p.club)})</option>`).join("");

  ["compareA", "compareB", "compareC"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const cur = el.value;
    const placeholder = id === "compareC" ? "Agente 3 (opcional)" : (id === "compareA" ? "Agente 1..." : "Agente 2...");
    el.innerHTML = `<option value="">${placeholder}</option>` + opts;
    if (cur) el.value = cur;
  });

  const keys = ["compareA", "compareB", "compareC"]
    .map(id => document.getElementById(id)?.value)
    .filter(Boolean);

  const result = document.getElementById("compareResult");
  if (!result) return;

  if (keys.length < 2 || new Set(keys).size !== keys.length) {
    result.innerHTML = `<p class="empty-state">Selecione de 2 a 3 agentes diferentes para comparar.</p>`;
    return;
  }

  const selected = keys.map(k => players.find(p => p.key === k)).filter(Boolean);
  const fields = [
    { label: "Valor de Mercado", fn: p => p.marketValue ? formatUSD(p.marketValue) : "—", metric: p => p.marketValue },
    { label: "Pico de carreira", fn: p => p.peakValue ? formatUSD(p.peakValue, true) : "—", metric: p => p.peakValue },
    { label: "Rank", fn: p => p.rank || "—" },
    { label: "Equipe", fn: p => p.club },
    { label: "Função", fn: p => p.functionRole || roleLabel(p.role) },
    { label: "Partidas (P)", fn: p => p.stats?.P ?? "—" },
    { label: "Vitórias (V)", fn: p => p.stats?.V ?? "—" },
    { label: "Derrotas (D)", fn: p => p.stats?.D ?? "—" },
    { label: "Win Rate", fn: p => p.stats?.P ? Math.round(p.stats.winRate * 100) + "%" : "—", metric: p => p.stats?.P > 0 ? p.stats.winRate : null },
    { label: "Idade", fn: p => p.age || "—" },
    { label: "Nacionalidade", fn: p => p.nationality },
    { label: "Títulos", fn: p => { const t = p.titles || {}; const parts = []; if (t.nacional) parts.push("🥇"+t.nacional); if (t.lji) parts.push("🥈"+t.lji); if (t.mundial) parts.push("🏆"+t.mundial); if (t.eventoEspecial) parts.push("🏅"+t.eventoEspecial); return parts.length ? parts.join(" ") : "—"; } },
    { label: "Contrato", fn: p => window.ProfileData ? ProfileData.contractLabel(p) : p.contractUntil },
    { label: "Status", fn: p => agentStatusMeta(p.status).label },
    { label: "Salário / temporada", fn: p => p.salary == null ? "—" : formatUSD(p.salary, true) },
    { label: "Cláusula", fn: p => p.releaseClause == null ? "—" : formatUSD(p.releaseClause, true) },
    { label: "Última alteração real", fn: p => Market.variation(p)?.text || "Sem registro" },
    { label: "Transferências oficiais", fn: p => Object.values(window.AppState.market.transfers || {}).filter(t => Market.transferMatches(t, p, players)).length },
  ];

  result.innerHTML = `
    <p class="market-note">Destaques comparam apenas métricas numéricas disponíveis. Em caso de empate, todos os maiores valores são destacados. No celular, deslize a tabela para ver os agentes lado a lado.</p>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Atributo</th>
            ${selected.map(p => `<th style="text-align:center">
              <div style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:8px 0">
                ${photoHTML(p, 48)}
                <span class="player-link" onclick="openPlayerProfile('${escapeInlineJsSingle(p.key)}')">${escapeHTML(p.name)}</span>
                <span style="font-size:0.75rem;color:var(--text-muted)">${escapeHTML(p.club)}</span>
              </div>
            </th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${fields.map(f => {
            const winners = f.metric ? Market.compareWinners(selected, f.metric) : [];
            return `<tr>
              <td style="color:var(--text-muted);font-weight:600">${f.label}</td>
              ${selected.map((p, i) => `<td style="text-align:center;font-weight:${winners.includes(p.key) ? 700 : 400};color:${winners.includes(p.key) ? "var(--cyan)" : "inherit"}">${escapeHTML(f.fn(p))}</td>`).join("")}
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

/* ========== CAREER HISTORY ========== */
function getCareerHistory(playerKey, playerName, currentClub) {
  const players = getAllPlayersFlat();
  const player = players.find(p => p.key === playerKey) || { key: playerKey, id: "legacy:" + playerKey, name: playerName };
  const transfers = Object.values(window.AppState.market.transfers || {})
    .filter(t => Market.transferMatches(t, player, players))
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  const timeline = [];
  if (transfers.length === 0) {
    timeline.push({ club: currentClub, from: "Sem início registrado", to: "Atual", fee: null });
    return timeline;
  }

  // First club = origin of first transfer
  const first = transfers[0];
  timeline.push({ club: first.from, from: "Início", to: first.season || first.date, fee: null });

  transfers.forEach((t, i) => {
    const next = transfers[i + 1];
    timeline.push({
      club: t.to,
      from: t.season || t.date,
      to: next ? (next.season || next.date) : "Atual",
      fee: t.fee,
      type: t.type
    });
  });

  if (timeline[timeline.length - 1].club !== currentClub) {
    timeline[timeline.length - 1].to = "Último vínculo de transferência registrado";
    timeline.push({ club: currentClub, from: "Início não registrado", to: "Atual", fee: null });
  }

  return timeline;
}

/* ========== RENDER: RANKINGS ========== */
function renderRankings() {
  const type = document.getElementById("rankingType")?.value || "players-value";
  const listEl = document.getElementById("rankingsList");
  if (!listEl) return;

  if (type === "players-value") {
    const players = getAllPlayersFlat().filter(isCompetitivePlayer).filter(p => p.marketValue).sort((a, b) => b.marketValue - a.marketValue);
    listEl.innerHTML = `
      <div class="table-wrap"><table>
        <thead><tr><th>#</th><th>Agente</th><th>Equipe</th><th>Rank</th><th>Valor</th><th>WR</th></tr></thead>
        <tbody>
          ${players.map((p, i) => `<tr>
            <td style="color:var(--text-muted);font-weight:700">#${i + 1}</td>
            <td><span class="player-link" onclick="openPlayerProfile('${escapeInlineJsSingle(p.key)}')">${escapeHTML(p.name)}</span></td>
            <td>${escapeHTML(p.club)}</td>
            <td>${escapeHTML(p.rank || "—")}</td>
            <td style="color:var(--cyan);font-weight:700">${formatUSD(p.marketValue)}</td>
            <td>${p.stats?.P ? Math.round(p.stats.winRate*100)+"%" : "—"}</td>
          </tr>`).join("")}
        </tbody>
      </table></div>`;
  } else if (type === "players-wr") {
    const players = getAllPlayersFlat().filter(isCompetitivePlayer).filter(p => p.stats?.P >= 3).sort((a, b) => b.stats.winRate - a.stats.winRate);
    listEl.innerHTML = `
      <div class="table-wrap"><table>
        <thead><tr><th>#</th><th>Agente</th><th>Equipe</th><th>P-V-D</th><th>Win Rate</th><th>Valor</th></tr></thead>
        <tbody>
          ${players.map((p, i) => `<tr>
            <td style="color:var(--text-muted);font-weight:700">#${i + 1}</td>
            <td><span class="player-link" onclick="openPlayerProfile('${escapeInlineJsSingle(p.key)}')">${escapeHTML(p.name)}</span></td>
            <td>${escapeHTML(p.club)}</td>
            <td>${p.stats.P}-${p.stats.V}-${p.stats.D}</td>
            <td style="color:var(--green);font-weight:700">${Math.round(p.stats.winRate*100)}%</td>
            <td>${p.marketValue ? formatUSD(p.marketValue, true) : "—"}</td>
          </tr>`).join("")}
        </tbody>
      </table></div>`;
  } else if (type === "players-gain" || type === "players-drop") {
    const rows = getAllPlayersFlat().filter(isCompetitivePlayer).map(p => ({ player: p, variation: Market.variation(p) })).filter(p => p.variation && (type === "players-gain" ? p.variation.diff > 0 : p.variation.diff < 0));
    rows.sort((a, b) => type === "players-gain" ? b.variation.diff - a.variation.diff : a.variation.diff - b.variation.diff);
    listEl.innerHTML = rows.length ? `<p class="market-note">Última alteração real por agente; estimativas e diferenças em relação ao pico não entram neste ranking.</p><div class="table-wrap"><table><thead><tr><th>Agente</th><th>Equipe</th><th>Antes</th><th>Atual</th><th>Variação</th><th>Data</th></tr></thead><tbody>${rows.map(({ player: p, variation: v }) => `<tr><td><span class="player-link" onclick="openPlayerProfile('${escapeInlineJsSingle(p.key)}')">${escapeHTML(p.name)}</span></td><td>${escapeHTML(p.club)}</td><td>${formatUSD(v.previousValue, true)}</td><td>${formatUSD(p.marketValue, true)}</td><td>${escapeHTML(v.text)}</td><td>${escapeHTML(new Date(v.at).toLocaleDateString("pt-BR"))}</td></tr>`).join("")}</tbody></table></div>` : '<p class="empty-state">Nenhuma variação real registrada para este ranking.</p>';
  } else if (type === "clubs-value") {
    const clubs = Object.keys(window.AppState.jet.rosters || {}).map(name => ({
      name,
      value: getClubMarketValue(name),
      size: getAllPlayersFlat().filter(p => isCompetitivePlayer(p) && p.club === name).length
    })).sort((a, b) => b.value - a.value);

    listEl.innerHTML = `
      <div class="table-wrap"><table>
        <thead><tr><th>#</th><th>Equipe</th><th>Valor do Plantel</th><th>Agentes</th><th>Média</th></tr></thead>
        <tbody>
          ${clubs.map((c, i) => `<tr>
            <td style="color:var(--text-muted);font-weight:700">#${i + 1}</td>
            <td><span class="player-link" onclick="openClubProfile('${escapeInlineJsSingle(c.name)}')">${escapeHTML(c.name)}</span></td>
            <td style="color:var(--cyan);font-weight:700">${formatUSD(c.value)}</td>
            <td>${c.size}</td>
            <td>${formatUSD(c.size ? c.value / c.size : 0, true)}</td>
          </tr>`).join("")}
        </tbody>
      </table></div>
    `;
  } else if (type === "biggest-transfers") {
    const transfers = Object.values(window.AppState.market.transfers || {})
      .sort((a, b) => (b.fee || 0) - (a.fee || 0));
    listEl.innerHTML = transfers.length ? `
      <div class="table-wrap"><table>
        <thead><tr><th>#</th><th>Agente</th><th>De → Para</th><th>Valor</th><th>Temporada</th></tr></thead>
        <tbody>
          ${transfers.map((t, i) => `<tr>
            <td style="color:var(--text-muted);font-weight:700">#${i + 1}</td>
            <td>${escapeHTML(t.playerName)}</td>
            <td>${escapeHTML(t.from)} → ${escapeHTML(t.to)}</td>
            <td style="color:var(--cyan);font-weight:700">${formatUSD(t.fee)}</td>
            <td>${escapeHTML(t.season)}</td>
          </tr>`).join("")}
        </tbody>
      </table></div>
    ` : `<p class="empty-state">Nenhuma transferência registrada.</p>`;
  }
}

/* ========== PERFIL DO AGENTE ========== */
function openPlayerProfile(key) {
  const players = getAllPlayersFlat();
  const p = players.find(x => x.key === key);
  if (!p) return alert("Agente não encontrado");

  window.AppState.ui.selectedPlayer = p;
  showView("player-profile");

  const content = document.getElementById("playerProfileContent");
  const variation = Market.variation(p);

  content.innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:20px">
      <button onclick="showView('players')" style="background:none;border:1px solid var(--border);color:var(--text-muted);padding:6px 12px;border-radius:8px;cursor:pointer;font-size:0.85rem">
        ← Voltar para Agentes
      </button>
      <button class="share-btn" onclick="copyPlayerLink('${escapeInlineJsSingle(p.key)}')">🔗 Copiar link</button>
      ${window.isMarketAdmin?.() ? `<button class="btn-primary btn-sm" id="editAgentProfile" onclick="ProfileEditor.openAgent('${escapeInlineJsSingle(p.key)}')">Editar agente</button>${p.leagueExit && ["fora-liga", "livre"].includes(p.status) ? `<button class="btn-gray btn-sm" onclick="ProfileEditor.syncExit('${escapeInlineJsSingle(p.key)}')">Sincronizar saída na Jet League (opcional)</button>` : ""}` : ""}
      ${!p.freeAgent ? `<a class="ext-link" href="${escapeHTML(getJetLeagueUrl())}" target="_blank" rel="noopener">Ver na Jet League ↗</a>` : ""}
      <button class="btn-ai btn-sm" onclick="requestMarketAnalysis('${escapeInlineJsSingle(p.key)}')">✨ Análise de mercado (IA)</button>
    </div>

    <div class="profile-header">
      <div class="profile-photo" style="padding:0;overflow:hidden">
        <img src="${escapeHTML(getPlayerPhoto(p))}" alt="${escapeHTML(p.name)}" style="width:100%;height:100%;object-fit:cover"
             onerror="this.parentElement.textContent='${escapeInlineJsSingle(getPlayerInitials(p.name))}'"/>
      </div>
      <div class="profile-info">
        <h1>${escapeHTML(p.name)}</h1>
        <div class="profile-meta">
          <span class="tag ${p.freeAgent ? "free-agent-tag" : ""}">${escapeHTML(p.club)}</span>
          ${typeof renderAgentStatusBadge === "function" ? renderAgentStatusBadge(p.status) : ""}
          ${agentStatusEffects(p.status).isRetired || !isCompetitivePlayer(p) ? '' : `<span class="tag ${escapeHTML(p.role)}">${roleLabel(p.role)}</span>`}
          <span class="tag">${escapeHTML(p.rank || "—")}</span>
          ${!isCompetitivePlayer(p) ? `<span class="tag">${escapeHTML(StaffData.forPlayer(p)?.role || "Comissão Técnica")}</span>` : ""}
          <span class="tag">${escapeHTML(p.nationality)}</span>
          ${p.age ? `<span class="tag">${escapeHTML(p.age)} anos</span>` : ""}
          <span class="tag">${escapeHTML(window.ProfileData ? ProfileData.contractLabel(p) : p.contractUntil)}</span>
          ${renderTitlesBadges(p.titles)}
        </div>
      </div>
    </div>

    <div class="value-panel">
      <div class="label">Valor de Mercado</div>
      <div class="big-value">${p.marketValue ? formatUSD(p.marketValue) : "Sem valor definido"}</div>
      ${variation ? `
        <div class="variation-line ${variation.positive ? "up" : "down"}" style="color:${variation.positive ? "var(--green)" : "var(--red)"}">
          ${variation.text} na última alteração registrada
        </div>
      ` : ""}
      ${p.peakValue ? `<div style="margin-top:8px;font-size:0.85rem;color:var(--text-muted)">Maior valor da carreira: <strong style="color:var(--text)">${formatUSD(p.peakValue)}</strong></div>` : ""}
      <div style="margin-top:10px;display:flex;gap:16px;flex-wrap:wrap;font-size:0.85rem;color:var(--text-muted)">
        <span>Salário: <strong style="color:var(--text)">${p.salary != null ? formatUSD(p.salary, true) + "/temp" : "—"}</strong></span>
        <span>Cláusula: <strong style="color:var(--text)">${p.releaseClause != null ? formatUSD(p.releaseClause, true) : "—"}</strong></span>
      </div>
    </div>
    <div id="marketAnalysisBox" class="section" style="display:none">
      <h2 class="section-h">Análise de Mercado</h2>
      <div id="marketAnalysisText" class="rumor-card"></div>
    </div>
    ${window.ProfileViews?.contract(p) || ""}

    <div class="section">
      <h2 class="section-h">Evolução do Valor</h2>
      ${MarketUI.historyMarkup(p)}
    </div>

    <div class="section">
      <h2 class="section-h">Hall da Glória</h2>
      <div class="titles-grid">
        <div class="title-card nacional ${(p.titles?.nacional||0) ? "has" : ""}">
          <div class="title-icon">🥇</div>
          <div class="title-name">Nacional</div>
          <div class="title-count">${p.titles?.nacional || 0}</div>
        </div>
        <div class="title-card lji ${(p.titles?.lji||0) ? "has" : ""}">
          <div class="title-icon">🥈</div>
          <div class="title-name">L.J.I</div>
          <div class="title-count">${p.titles?.lji || 0}</div>
        </div>
        <div class="title-card mundial ${(p.titles?.mundial||0) ? "has" : ""}">
          <div class="title-icon">🏆</div>
          <div class="title-name">Mundial</div>
          <div class="title-count">${p.titles?.mundial || 0}</div>
        </div>
        <div class="title-card evento ${(p.titles?.eventoEspecial||0) ? "has" : ""}">
          <div class="title-icon">🏅</div>
          <div class="title-name">Evento Especial</div>
          <div class="title-count">${p.titles?.eventoEspecial || 0}</div>
        </div>
      </div>
    </div>

    ${window.ProfileViews?.achievements(p) || ""}
    ${window.StaffViews?.agent(p) || ""}
    <div class="section">
      <h2 class="section-h">Performance ${p.statsRound ? `(${escapeHTML(p.statsRound)})` : ""}</h2>
      <div class="kpi-row">
        <div class="kpi"><div class="kpi-label">Rank</div><div class="kpi-value" style="font-size:1.1rem">${escapeHTML(p.rank || "—")}</div></div>
        <div class="kpi"><div class="kpi-label">Partidas</div><div class="kpi-value" style="font-size:1.1rem">${p.stats?.P ?? "—"}</div></div>
        <div class="kpi"><div class="kpi-label">Vitórias</div><div class="kpi-value" style="font-size:1.1rem;color:var(--green)">${p.stats?.V ?? "—"}</div></div>
        <div class="kpi"><div class="kpi-label">Derrotas</div><div class="kpi-value" style="font-size:1.1rem;color:var(--red)">${p.stats?.D ?? "—"}</div></div>
        <div class="kpi"><div class="kpi-label">Win Rate</div><div class="kpi-value cyan" style="font-size:1.1rem">${p.stats?.P ? Math.round(p.stats.winRate*100)+"%" : "—"}</div></div>
        <div class="kpi"><div class="kpi-label">Função</div><div class="kpi-value" style="font-size:1rem">${escapeHTML(!isCompetitivePlayer(p) ? StaffData.forPlayer(p)?.role || "Comissão Técnica" : p.functionRole || roleLabel(p.role))}</div></div>
      </div>
    </div>

    <div class="section">
      <h2 class="section-h">Transferências oficiais</h2>
      ${MarketUI.transferTimeline(p)}
      <h2 class="section-h">Histórico de clubes</h2>
      ${(() => {
        if (window.ProfileViews) return ProfileViews.career(p, getCareerHistory(p.key, p.name, p.club));
        const career = getCareerHistory(p.key, p.name, p.club);
        return `<div class="table-wrap"><table>
          <thead><tr><th>Clube</th><th>Período</th><th>Taxa</th></tr></thead>
          <tbody>
            ${career.map(c => `<tr>
              <td><strong>${escapeHTML(c.club)}</strong></td>
              <td>${escapeHTML(c.from)} → ${escapeHTML(c.to)}</td>
              <td>${c.fee != null ? formatUSD(c.fee, true) : "—"}</td>
            </tr>`).join("")}
          </tbody>
        </table></div>`;
      })()}
    </div>


    <div class="section">
      <h2 class="section-h">Informações</h2>
      <div class="kpi-row">
        <div class="kpi"><div class="kpi-label">Equipe Atual</div><div class="kpi-value" style="font-size:1.1rem">${escapeHTML(p.club)}</div></div>
        <div class="kpi"><div class="kpi-label">Nacionalidade</div><div class="kpi-value" style="font-size:1.1rem">${escapeHTML(p.nationality)}</div></div>
        <div class="kpi"><div class="kpi-label">Idade</div><div class="kpi-value" style="font-size:1.1rem">${p.age || "—"}</div></div>
        <div class="kpi"><div class="kpi-label">Contrato</div><div class="kpi-value" style="font-size:1.1rem">${escapeHTML(window.ProfileData ? ProfileData.contractLabel(p) : p.contractUntil)}</div></div>
        <div class="kpi"><div class="kpi-label">Salário</div><div class="kpi-value" style="font-size:1rem">${p.salary != null ? formatUSD(p.salary, true) : "—"}</div></div>
        <div class="kpi"><div class="kpi-label">Cláusula</div><div class="kpi-value" style="font-size:1rem">${p.releaseClause != null ? formatUSD(p.releaseClause, true) : "—"}</div></div>
      </div>
    </div>
  `;

  // Render chart
  requestAnimationFrame(() => MarketUI.renderHistory());
}

function copyPlayerLink(key) {
  const url = window.AppRouter.playerURL(key);
  Promise.resolve().then(() => navigator.clipboard.writeText(url)).then(() => {
    alert("Link copiado!");
  }).catch(() => {
    prompt("Copie o link:", url);
  });
}

async function requestMarketAnalysis(key) {
  const p = getAllPlayersFlat().find(x => x.key === key);
  if (!p) return;
  const box = document.getElementById("marketAnalysisBox");
  const text = document.getElementById("marketAnalysisText");
  if (box) box.style.display = "block";
  if (text) text.textContent = "Gerando análise com IA...";

  const prompt = `Você é analista de mercado da Jet League.
Escreva em português do Brasil, 1 parágrafo objetivo (4-6 frases) explicando por que o valor de mercado faz sentido.

AGENTE: ${p.name}
EQUIPE: ${p.club}
RANK: ${p.rank}
VALOR: ${p.marketValue ? formatUSD(p.marketValue) : "não definido"}
PICO: ${p.peakValue ? formatUSD(p.peakValue) : "—"}
PERFORMANCE: ${p.stats?.P || 0} partidas, ${p.stats?.V || 0}V-${p.stats?.D || 0}D, WR ${p.stats?.P ? Math.round(p.stats.winRate*100) : 0}%
FUNÇÃO: ${p.functionRole || p.role}
SALÁRIO: ${p.salary != null ? formatUSD(p.salary) : "não informado"}
CLÁUSULA: ${p.releaseClause != null ? formatUSD(p.releaseClause) : "não informada"}

Não invente estatísticas. Tom profissional de mercado esportivo.`;

  try {
    const raw = await window.marketGenerateWithAI(prompt);
    // Modal de revisão
    window._aiReviewData = {
      action: "market-analysis",
      data: { key, text: raw.trim(), playerName: p.name }
    };
    const overlay = document.getElementById("aiReviewOverlay");
    document.getElementById("aiReviewTitle").textContent = "Revisar análise de mercado · " + p.name;
    document.getElementById("aiReviewBody").innerHTML = `
      <div class="review-field full">
        <label>Texto da análise</label>
        <textarea id="revAnalysisText" rows="6">${raw.trim().replace(/</g, "&lt;")}</textarea>
      </div>
      <p style="font-size:0.8rem;color:var(--text-muted)">Ao confirmar, a análise aparece no perfil (somente nesta sessão, ou salva se preferir depois).</p>
    `;
    // Fix textarea content properly
    document.getElementById("revAnalysisText").value = raw.trim();
    overlay.classList.add("open");
    if (text) text.textContent = "Revise no modal antes de publicar no perfil.";
  } catch (err) {
    console.error("[AI análise]", err);
    if (text) text.textContent = "IA indisponível: " + (err?.message || "tente novamente");
  }
}

function renderValueChart(history) {
  const canvas = document.getElementById("valueChart");
  if (!canvas) return;
  if (window._valueChartInstance) {
    window._valueChartInstance.destroy();
    window._valueChartInstance = null;
  }
  if (typeof Chart === "undefined" || !history.length) {
    const fallback = document.createElement("div");
    fallback.className = "chart-state";
    fallback.setAttribute("role", "status");
    const message = document.createElement("strong");
    message.textContent = !history.length ? "Histórico ainda indisponível" : "O gráfico não carregou";
    const detail = document.createElement("span");
    detail.textContent = !history.length ? "As alterações de valor aparecerão aqui." : "Confira a conexão e tente abrir o perfil novamente. Os valores do agente continuam disponíveis acima.";
    fallback.append(message, detail);
    canvas.replaceWith(fallback);
    return;
  }

  const styles = getComputedStyle(document.documentElement);
  const color = styles.getPropertyValue("--cyan").trim();
  const muted = styles.getPropertyValue("--text-muted").trim();
  const border = styles.getPropertyValue("--border").trim();

  window._valueChartInstance = new Chart(canvas, {
    type: "line",
    data: {
      labels: history.map(h => h.label || h.season),
      datasets: [{
        label: "Valor de Mercado",
        data: history.map(h => h.value),
        borderColor: color,
        backgroundColor: styles.getPropertyValue("--cyan-glow").trim(),
        fill: true,
        tension: 0.3,
        pointBackgroundColor: color,
        pointRadius: 3,
        pointHoverRadius: 6,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? false : { duration: 180 },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => formatUSD(ctx.raw, true)
          }
        }
      },
      scales: {
        x: {
          ticks: { color: muted, font: { size: 10 }, maxRotation: 0 },
          grid: { color: border }
        },
        y: {
          ticks: {
            color: muted,
            font: { size: 10 },
            callback: (v) => formatUSD(v, true)
          },
          grid: { color: border }
        }
      }
    }
  });
}

/* ========== PERFIL DA EQUIPE ========== */
function openClubProfile(clubName) {
  const agents = getAllPlayersFlat().filter(isCompetitivePlayer).filter(p => p.club === clubName)
    .sort((a, b) => (b.marketValue || 0) - (a.marketValue || 0));
  const totalValue = agents.reduce((s, p) => s + (p.marketValue || 0), 0);
  const avg = agents.length ? totalValue / agents.length : 0;

  window.AppState.ui.selectedClub = clubName;
  showView("club-profile");

  const content = document.getElementById("clubProfileContent");
  content.innerHTML = `
    <button onclick="showView('clubs')" style="background:none;border:1px solid var(--border);color:var(--text-muted);padding:6px 12px;border-radius:8px;cursor:pointer;margin-bottom:20px;font-size:0.85rem">
      ← Voltar para Equipes
    </button>

    ${ClubLegacy.header(clubName,agents.length)}
      ${window.StaffViews?.team(clubName) || ""}
      ${window.ProfileViews?.club(clubName) || ""}
      ${window.ProfileViews?.clubAchievements(clubName) || ""}
    <div class="section club-roster-section">
      <h2 class="section-h">Elenco atual · Jet League</h2>
      <div class="club-roster-metrics">
        <div><span>Valor total do elenco</span><strong>${formatUSD(totalValue)}</strong></div>
        <div><span>Valor médio</span><strong>${formatUSD(avg,true)}</strong></div>
        <div><span>Agente mais valioso</span><strong>${escapeHTML(agents[0]?.name || "—")}</strong></div>
        <div><span>Valor do mais valioso</span><strong>${agents[0] ? formatUSD(agents[0].marketValue,true) : "—"}</strong></div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th></th><th>Agente</th><th>Função</th><th>Valor</th><th>Nacionalidade</th><th>Idade</th></tr></thead>
          <tbody>
            ${agents.map(p => `
              <tr>
                <td style="width:44px">${photoHTML(p, 36)}</td>
                <td><span class="player-link" onclick="openPlayerProfile('${escapeInlineJsSingle(p.key)}')">${escapeHTML(p.name)}</span></td>
                <td>${agentStatusEffects(p.status).isRetired ? renderAgentStatusBadge(p.status) : `<span class="tag ${escapeHTML(p.role)}">${roleLabel(p.role)}</span>`}</td>
                <td style="color:var(--cyan);font-weight:700">${p.marketValue ? formatUSD(p.marketValue, true) : "—"}</td>
                <td>${escapeHTML(p.nationality)}</td>
                <td>${p.age || "—"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/* ========== INIT ========== */
document.addEventListener("DOMContentLoaded", () => {
  console.log("[Jet Market] Iniciando...");

  if (typeof initTheme === "function") initTheme();
  if (typeof initAuth === "function") initAuth();
  document.addEventListener("jet:updated", () => window.AppRouter.requestRefresh("jet"));
  document.addEventListener("market:updated", () => {
    updateTransferWindowBadge();
    window.AppRouter.requestRefresh("market");
  });
  document.addEventListener("fantasy:updated", () => window.AppRouter.requestRefresh("fantasy"));
  window.AppRouter.start();
  startJetListeners();
  startMarketListeners();
  updateTransferWindowBadge();
});

document.addEventListener("theme:changed", () => {
  const player = window.AppState.ui.selectedPlayer;
  if (window.AppState.ui.currentView === "player-profile" && player) {
    MarketUI.renderHistory();
  }
});

window.renderCompare = renderCompare;
window.openPlayerProfile = openPlayerProfile;
window.openClubProfile = openClubProfile;
window.showView = showView;
window.copyPlayerLink = copyPlayerLink;
window.requestMarketAnalysis = requestMarketAnalysis;
window.isTransferWindowOpen = isTransferWindowOpen;
