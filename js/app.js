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
    status,
    photo: m.photo || "",
    valueHistory: m.valueHistory || [],
    rank: m.rank || "—",
    functionRole: m.functionRole || defaults.functionRole || "",
    trophy: titlesTotal(titles),
    titles,
    salary: m.salary ?? null,
    releaseClause: m.releaseClause ?? null,
    freeAgent: isFree,
    retired: !!fx.isRetired,
    canTransfer: fx.canTransfer !== false,
    fantasyEligible: fx.fantasyEligible !== false,
    stats: {
      P: st.P ?? 0,
      V: st.V ?? 0,
      D: st.D ?? 0,
      winRate: st.winRate ?? (st.P ? st.V / st.P : 0)
    },
    statsRound: m.statsRound || ""
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
  const players = getAllPlayersFlat().filter(p => p.club === clubName && !p.freeAgent);
  return players.reduce((sum, p) => sum + (p.marketValue || 0), 0);
}

function getTotalMarketValue() {
  return getAllPlayersFlat().reduce((sum, p) => sum + (p.marketValue || 0), 0);
}

/* ========== RENDER: HOME ========== */
function renderHome() {
  const players = getAllPlayersFlat();
  const transfers = Object.values(window.AppState.market.transfers || {});
  const rumors = Object.values(window.AppState.market.rumors || {});
  const clubs = Object.keys(window.AppState.jet.rosters || {});
  const season = window.AppState.jet.currentSeason || "Temporada 1";

  document.getElementById("seasonBadge").textContent = season;
  document.getElementById("statPlayers").textContent = players.length || "—";
  document.getElementById("statClubs").textContent = clubs.length || "—";
  document.getElementById("statMarketValue").textContent = formatUSD(getTotalMarketValue(), true);
  document.getElementById("statTransfers").textContent = transfers.length;

  // KPIs
  const avgValue = players.length ? getTotalMarketValue() / players.length : 0;
  const freeAgents = players.filter(p => p.freeAgent).length;
  document.getElementById("kpiRow").innerHTML = `
    <div class="kpi"><div class="kpi-label">Valor Médio</div><div class="kpi-value cyan">${formatUSD(avgValue, true)}</div></div>
    <div class="kpi"><div class="kpi-label">Agentes livres</div><div class="kpi-value">${freeAgents}</div></div>
    <div class="kpi"><div class="kpi-label">Transferências</div><div class="kpi-value">${transfers.length}</div></div>
    <div class="kpi"><div class="kpi-label">Rumores Ativos</div><div class="kpi-value">${rumors.filter(r => r.status !== "encerrada").length}</div></div>
  `;

  // Feed do mercado (timeline misturada)
  const feedEl = document.getElementById("marketFeed");
  if (feedEl) {
    const feedItems = [];
    transfers.forEach(t => {
      feedItems.push({
        type: "transfer",
        date: t.date || "",
        html: `<strong>${escapeHTML(t.playerName)}</strong> transferido: ${escapeHTML(t.from)} → <strong>${escapeHTML(t.to)}</strong> por ${formatUSD(t.fee, true)}`
      });
    });
    rumors.filter(r => r.status !== "encerrada").forEach(r => {
      const st = statusLabel(r.status);
      feedItems.push({
        type: "rumor",
        date: r.date || "",
        html: `${st.icon} <strong>${r.interestedClub}</strong> interessado em <strong>${escapeHTML(r.playerName)}</strong> (${r.reliability}%)`
      });
    });
    // Top valued as "destaque"
    const top3 = [...players].filter(p => p.marketValue).sort((a,b)=>b.marketValue-a.marketValue).slice(0,3);
    top3.forEach(p => {
      feedItems.push({
        type: "value",
        date: "9999",
        html: `<strong>${escapeHTML(p.name)}</strong> (${escapeHTML(p.club)}) avaliado em ${formatUSD(p.marketValue, true)}`
      });
    });
    feedItems.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    const shown = feedItems.slice(0, 8);
    feedEl.innerHTML = shown.length ? `
      <ul class="feed-list">
        ${shown.map(item => `<li class="feed-item ${item.type}"><span class="feed-icon" aria-hidden="true">${item.type === "transfer" ? "⇄" : item.type === "rumor" ? "↗" : "◇"}</span><div class="feed-text">${item.html}</div><time class="feed-date">${item.date !== "9999" ? escapeHTML(item.date) : "Em destaque"}</time></li>`).join("")}
      </ul>
    ` : `<p class="empty-state">Nenhuma movimentação por enquanto. Novos registros aparecerão aqui.</p>`;
  }

  // Movimentações recentes
  const recent = [...transfers].sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 5);
  const recentEl = document.getElementById("recentTransfers");
  if (!recent.length) {
    recentEl.innerHTML = `<p class="empty-state">Nenhuma transferência registrada ainda.</p>`;
  } else {
    recentEl.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead><tr><th>Agente</th><th>Origem → Destino</th><th>Valor</th><th>Data</th><th>Status</th></tr></thead>
          <tbody>
            ${recent.map(t => {
              const st = statusLabel(t.status);
              return `<tr>
                <td><span class="player-link" onclick="openPlayerProfile('${escapeInlineJsSingle(t.playerKey)}')">${escapeHTML(t.playerName)}</span></td>
                <td>${escapeHTML(t.from)} → <strong>${escapeHTML(t.to)}</strong></td>
                <td style="color:var(--cyan);font-weight:700">${formatUSD(t.fee, true)}</td>
                <td>${t.date || "—"}</td>
                <td><span class="status-badge" style="background:${st.color}22;color:${st.color}">${st.icon} ${st.label}</span></td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  // Top values
  const byValue = [...players].filter(p => p.marketValue).sort((a, b) => b.marketValue - a.marketValue).slice(0, 8);
  document.getElementById("topValues").innerHTML = byValue.length ? `
    <div class="table-wrap">
      <table>
        <thead><tr><th>#</th><th>Agente</th><th>Equipe</th><th>Valor</th></tr></thead>
        <tbody>
          ${byValue.map((p, i) => `
            <tr>
              <td style="color:var(--text-muted)">#${i + 1}</td>
              <td><span class="player-link" onclick="openPlayerProfile('${escapeInlineJsSingle(p.key)}')">${escapeHTML(p.name)}</span></td>
              <td>${escapeHTML(p.club)}</td>
              <td style="color:var(--cyan);font-weight:700">${formatUSD(p.marketValue, true)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  ` : `<p class="empty-state">Sem dados de valor ainda.</p>`;

  // Os blocos exibem valores atuais; não representam variação entre rodadas.
  const topGainersEl = document.getElementById("topGainers");
  const topLosersEl = document.getElementById("topLosers");

  const top5 = byValue.slice(0, 5);
  topGainersEl.innerHTML = top5.length ? `
    <div class="table-wrap"><table>
      <thead><tr><th>Agente</th><th>Equipe</th><th>Valor</th></tr></thead>
      <tbody>
        ${top5.map(p => `<tr>
          <td><span class="player-link" onclick="openPlayerProfile('${escapeInlineJsSingle(p.key)}')">${escapeHTML(p.name)}</span></td>
          <td>${escapeHTML(p.club)}</td>
          <td class="market-amount">${formatUSD(p.marketValue, true)}</td>
        </tr>`).join("")}
      </tbody>
    </table></div>
  ` : `<p class="empty-state">—</p>`;

  const bottom5 = [...players].filter(p => p.marketValue).sort((a, b) => a.marketValue - b.marketValue).slice(0, 5);
  topLosersEl.innerHTML = bottom5.length ? `
    <div class="table-wrap"><table>
      <thead><tr><th>Agente</th><th>Equipe</th><th>Valor</th></tr></thead>
      <tbody>
        ${bottom5.map(p => `<tr>
          <td><span class="player-link" onclick="openPlayerProfile('${escapeInlineJsSingle(p.key)}')">${escapeHTML(p.name)}</span></td>
          <td>${escapeHTML(p.club)}</td>
          <td class="market-amount">${formatUSD(p.marketValue, true)}</td>
        </tr>`).join("")}
      </tbody>
    </table></div>
  ` : `<p class="empty-state">—</p>`;

  // Rumores home
  const homeRumorsEl = document.getElementById("homeRumors");
  const activeRumors = rumors.filter(r => r.status !== "encerrada").slice(0, 4);
  if (!activeRumors.length) {
    homeRumorsEl.innerHTML = `<p class="empty-state">Nenhum rumor no momento.</p>`;
  } else {
    homeRumorsEl.innerHTML = activeRumors.map(r => {
      const st = statusLabel(r.status);
      return `
        <div class="rumor-card">
          <div class="rumor-header">
            <div class="rumor-title">${r.interestedClub} → ${escapeHTML(r.playerName)}</div>
            <span class="status-badge" style="background:${st.color}22;color:${st.color}">${st.icon} ${st.label}</span>
          </div>
          <div class="rumor-desc">${r.description}</div>
          <div class="rumor-meta">
            <span>Confiabilidade: <strong>${r.reliability}%</strong></span>
            <span>${r.currentClub}</span>
            <span>${r.date}</span>
          </div>
        </div>
      `;
    }).join("");
  }
}

/* ========== RENDER: PLAYERS ========== */
function renderPlayers() {
  let players = getAllPlayersFlat();
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
      clubs.map(c => `<option value="${c}" ${c === current ? "selected" : ""}>${c}</option>`).join("");
  }

  if (search) players = players.filter(p => p.name.toLowerCase().includes(search));
  if (club) players = players.filter(p => p.club === club);
  if (rankF) {
    players = players.filter(p => {
      const r = (p.rank || "").toLowerCase();
      if (rankF === "Clandestino") return r.includes("clandestin");
      if (rankF === "Especial") return r.includes("especial");
      return r === rankF.toLowerCase() || r.includes(rankF.replace("Rank ", "").toLowerCase());
    });
  }
  if (roleF === "livre") players = players.filter(p => p.freeAgent);
  else if (roleF) players = players.filter(p => p.role === roleF && !p.freeAgent);
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
  else players.sort((a, b) => a.name.localeCompare(b.name));

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
          <div class="card-meta">
            <span class="tag ${escapeHTML(p.role)}">${roleLabel(p.role)}</span>
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
    const agents = getAllPlayersFlat().filter(p => p.club === name);
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

  if (keys.length < 2) {
    result.innerHTML = `<p class="empty-state">Selecione pelo menos 2 agentes para comparar.</p>`;
    return;
  }

  const selected = keys.map(k => players.find(p => p.key === k)).filter(Boolean);
  const fields = [
    { label: "Valor de Mercado", fn: p => p.marketValue ? formatUSD(p.marketValue) : "—", best: (a,b) => (a.marketValue||0) >= (b.marketValue||0) },
    { label: "Pico de carreira", fn: p => p.peakValue ? formatUSD(p.peakValue, true) : "—", best: (a,b) => (a.peakValue||0) >= (b.peakValue||0) },
    { label: "Rank", fn: p => p.rank || "—" },
    { label: "Equipe", fn: p => p.club },
    { label: "Função", fn: p => p.functionRole || roleLabel(p.role) },
    { label: "Partidas (P)", fn: p => p.stats?.P ?? "—" },
    { label: "Vitórias (V)", fn: p => p.stats?.V ?? "—" },
    { label: "Derrotas (D)", fn: p => p.stats?.D ?? "—" },
    { label: "Win Rate", fn: p => p.stats?.P ? Math.round(p.stats.winRate * 100) + "%" : "—", best: (a,b) => (a.stats?.winRate||0) >= (b.stats?.winRate||0) },
    { label: "Idade", fn: p => p.age || "—" },
    { label: "Nacionalidade", fn: p => p.nationality },
    { label: "Títulos", fn: p => { const t = p.titles || {}; const parts = []; if (t.nacional) parts.push("🥇"+t.nacional); if (t.lji) parts.push("🥈"+t.lji); if (t.mundial) parts.push("🏆"+t.mundial); if (t.eventoEspecial) parts.push("🏅"+t.eventoEspecial); return parts.length ? parts.join(" ") : "—"; } },
    { label: "Contrato até", fn: p => p.contractUntil },
  ];

  result.innerHTML = `
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
            let bestIdx = 0;
            if (f.best) {
              selected.forEach((p, i) => { if (f.best(p, selected[bestIdx])) bestIdx = i; });
            }
            return `<tr>
              <td style="color:var(--text-muted);font-weight:600">${f.label}</td>
              ${selected.map((p, i) => `<td style="text-align:center;font-weight:${f.best && i===bestIdx ? 700 : 400};color:${f.best && i===bestIdx ? "var(--cyan)" : "inherit"}">${f.fn(p)}</td>`).join("")}
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

/* ========== CAREER HISTORY ========== */
function getCareerHistory(playerKey, playerName, currentClub) {
  const transfers = Object.values(window.AppState.market.transfers || {})
    .filter(t => t.playerKey === playerKey || t.playerName === playerName)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  const timeline = [];
  if (transfers.length === 0) {
    timeline.push({ club: currentClub, from: "Temporada 1", to: "Atual", fee: null });
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

  return timeline;
}

/* ========== RENDER: RANKINGS ========== */
function renderRankings() {
  const type = document.getElementById("rankingType")?.value || "players-value";
  const listEl = document.getElementById("rankingsList");
  if (!listEl) return;

  if (type === "players-value") {
    const players = getAllPlayersFlat().filter(p => p.marketValue).sort((a, b) => b.marketValue - a.marketValue);
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
    const players = getAllPlayersFlat().filter(p => p.stats?.P >= 3).sort((a, b) => b.stats.winRate - a.stats.winRate);
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
    const players = getAllPlayersFlat()
      .filter(p => p.marketValue && p.peakValue && p.peakValue > 0)
      .map(p => ({ ...p, diff: p.marketValue - p.peakValue, pct: ((p.marketValue - p.peakValue) / p.peakValue) * 100 }));
    const sorted = type === "players-gain"
      ? players.filter(p => p.diff >= 0).sort((a, b) => b.pct - a.pct)
      : players.filter(p => p.diff < 0).sort((a, b) => a.pct - b.pct);
    listEl.innerHTML = `
      <div class="table-wrap"><table>
        <thead><tr><th>#</th><th>Agente</th><th>Equipe</th><th>Valor</th><th>Pico</th><th>Variação</th></tr></thead>
        <tbody>
          ${sorted.map((p, i) => `<tr>
            <td style="color:var(--text-muted);font-weight:700">#${i + 1}</td>
            <td><span class="player-link" onclick="openPlayerProfile('${escapeInlineJsSingle(p.key)}')">${escapeHTML(p.name)}</span></td>
            <td>${escapeHTML(p.club)}</td>
            <td style="color:var(--cyan);font-weight:700">${formatUSD(p.marketValue, true)}</td>
            <td>${formatUSD(p.peakValue, true)}</td>
            <td class="variation ${p.diff >= 0 ? "up" : "down"}">${p.diff >= 0 ? "▲" : "▼"} ${Math.abs(p.pct).toFixed(1)}%</td>
          </tr>`).join("")}
        </tbody>
      </table></div>`;
  } else if (type === "clubs-value") {
    const clubs = Object.keys(window.AppState.jet.rosters || {}).map(name => ({
      name,
      value: getClubMarketValue(name),
      size: (window.AppState.jet.rosters[name] || []).length
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
  const variation = p.peakValue ? formatVariation(p.marketValue, p.peakValue) : null;

  // Monta histórico de valor para o gráfico (seed gera histórico sintético se não existir)
  let history = p.valueHistory && p.valueHistory.length ? [...p.valueHistory] : buildSyntheticHistory(p);

  content.innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:20px">
      <button onclick="showView('players')" style="background:none;border:1px solid var(--border);color:var(--text-muted);padding:6px 12px;border-radius:8px;cursor:pointer;font-size:0.85rem">
        ← Voltar para Agentes
      </button>
      <button class="share-btn" onclick="copyPlayerLink('${escapeInlineJsSingle(p.key)}')">🔗 Copiar link</button>
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
          <span class="tag ${escapeHTML(p.role)}">${roleLabel(p.role)}</span>
          <span class="tag">${escapeHTML(p.rank || "—")}</span>
          <span class="tag">${escapeHTML(p.nationality)}</span>
          ${p.age ? `<span class="tag">${escapeHTML(p.age)} anos</span>` : ""}
          <span class="tag">Contrato até ${escapeHTML(p.contractUntil)}</span>
          ${renderTitlesBadges(p.titles)}
        </div>
      </div>
    </div>

    <div class="value-panel">
      <div class="label">Valor de Mercado</div>
      <div class="big-value">${p.marketValue ? formatUSD(p.marketValue) : "Sem valor definido"}</div>
      ${variation ? `
        <div class="variation-line ${variation.positive ? "up" : "down"}" style="color:${variation.positive ? "var(--green)" : "var(--red)"}">
          ${variation.text} em relação ao pico
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

    <div class="section">
      <h2 class="section-h">Evolução do Valor</h2>
      <div class="chart-container">
        <canvas id="valueChart"></canvas>
      </div>
    </div>

    <div class="section">
      <h2 class="section-h">Títulos</h2>
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

    <div class="section">
      <h2 class="section-h">Performance ${p.statsRound ? `(${escapeHTML(p.statsRound)})` : ""}</h2>
      <div class="kpi-row">
        <div class="kpi"><div class="kpi-label">Rank</div><div class="kpi-value" style="font-size:1.1rem">${escapeHTML(p.rank || "—")}</div></div>
        <div class="kpi"><div class="kpi-label">Partidas</div><div class="kpi-value" style="font-size:1.1rem">${p.stats?.P ?? "—"}</div></div>
        <div class="kpi"><div class="kpi-label">Vitórias</div><div class="kpi-value" style="font-size:1.1rem;color:var(--green)">${p.stats?.V ?? "—"}</div></div>
        <div class="kpi"><div class="kpi-label">Derrotas</div><div class="kpi-value" style="font-size:1.1rem;color:var(--red)">${p.stats?.D ?? "—"}</div></div>
        <div class="kpi"><div class="kpi-label">Win Rate</div><div class="kpi-value cyan" style="font-size:1.1rem">${p.stats?.P ? Math.round(p.stats.winRate*100)+"%" : "—"}</div></div>
        <div class="kpi"><div class="kpi-label">Função</div><div class="kpi-value" style="font-size:1rem">${escapeHTML(p.functionRole || roleLabel(p.role))}</div></div>
      </div>
    </div>

    <div class="section">
      <h2 class="section-h">Histórico de Carreira</h2>
      ${(() => {
        const career = getCareerHistory(p.key, p.name, p.club);
        return `<div class="table-wrap"><table>
          <thead><tr><th>Clube</th><th>Período</th><th>Taxa</th></tr></thead>
          <tbody>
            ${career.map(c => `<tr>
              <td><strong>${c.club}</strong></td>
              <td>${c.from} → ${c.to}</td>
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
        <div class="kpi"><div class="kpi-label">Contrato</div><div class="kpi-value" style="font-size:1.1rem">${escapeHTML(p.contractUntil)}</div></div>
        <div class="kpi"><div class="kpi-label">Salário</div><div class="kpi-value" style="font-size:1rem">${p.salary != null ? formatUSD(p.salary, true) : "—"}</div></div>
        <div class="kpi"><div class="kpi-label">Cláusula</div><div class="kpi-value" style="font-size:1rem">${p.releaseClause != null ? formatUSD(p.releaseClause, true) : "—"}</div></div>
      </div>
    </div>
  `;

  // Render chart
  requestAnimationFrame(() => renderValueChart(history));
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

function buildSyntheticHistory(p) {
  if (!p.marketValue) return [];
  const current = p.marketValue;
  const peak = p.peakValue || current;
  // Simula 4 temporadas de evolução
  return [
    { season: "Temporada 1", value: Math.round(current * 0.35) },
    { season: "Temporada 2", value: Math.round(current * 0.55) },
    { season: "Temporada 3", value: Math.round(Math.min(peak, current * 0.8)) },
    { season: "Temporada 4", value: current }
  ];
}

function renderValueChart(history) {
  const canvas = document.getElementById("valueChart");
  if (!canvas) return;
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

  if (window._valueChartInstance) {
    window._valueChartInstance.destroy();
  }
  const styles = getComputedStyle(document.documentElement);
  const color = styles.getPropertyValue("--cyan").trim();
  const muted = styles.getPropertyValue("--text-muted").trim();
  const border = styles.getPropertyValue("--border").trim();

  window._valueChartInstance = new Chart(canvas, {
    type: "line",
    data: {
      labels: history.map(h => h.season),
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
  const agents = getAllPlayersFlat().filter(p => p.club === clubName)
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

    <h1 style="font-size:1.6rem;font-weight:800;margin-bottom:8px">${escapeHTML(clubName)}</h1>
    <div class="profile-meta" style="margin-bottom:24px">
      <span class="tag">${agents.length} agentes</span>
    </div>

    <div class="kpi-row">
      <div class="kpi"><div class="kpi-label">Valor Total do Elenco</div><div class="kpi-value cyan">${formatUSD(totalValue)}</div></div>
      <div class="kpi"><div class="kpi-label">Valor Médio</div><div class="kpi-value cyan">${formatUSD(avg, true)}</div></div>
      <div class="kpi"><div class="kpi-label">Agente mais valioso</div><div class="kpi-value" style="font-size:1rem">${agents[0]?.name || "—"}</div></div>
      <div class="kpi"><div class="kpi-label">Valor do mais valioso</div><div class="kpi-value cyan">${agents[0] ? formatUSD(agents[0].marketValue, true) : "—"}</div></div>
    </div>

    <div class="section">
      <h2 class="section-h">Elenco</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th></th><th>Agente</th><th>Função</th><th>Valor</th><th>Nacionalidade</th><th>Idade</th></tr></thead>
          <tbody>
            ${agents.map(p => `
              <tr>
                <td style="width:44px">${photoHTML(p, 36)}</td>
                <td><span class="player-link" onclick="openPlayerProfile('${escapeInlineJsSingle(p.key)}')">${escapeHTML(p.name)}</span></td>
                <td><span class="tag ${escapeHTML(p.role)}">${roleLabel(p.role)}</span></td>
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
  document.addEventListener("jet:updated", () => window.AppRouter.refresh());
  document.addEventListener("market:updated", () => {
    updateTransferWindowBadge();
    window.AppRouter.refresh();
  });
  document.addEventListener("fantasy:updated", () => queueMicrotask(() => window.AppRouter.refresh()));
  window.AppRouter.start();
  startJetListeners();
  startMarketListeners();
  updateTransferWindowBadge();
});

document.addEventListener("theme:changed", () => {
  const player = window.AppState.ui.selectedPlayer;
  if (window.AppState.ui.currentView === "player-profile" && player) {
    renderValueChart(player.valueHistory?.length ? player.valueHistory : buildSyntheticHistory(player));
  }
});

window.renderCompare = renderCompare;
window.openPlayerProfile = openPlayerProfile;
window.openClubProfile = openClubProfile;
window.showView = showView;
window.copyPlayerLink = copyPlayerLink;
window.requestMarketAnalysis = requestMarketAnalysis;
window.isTransferWindowOpen = isTransferWindowOpen;


/* Boot Fantasy listeners */
(function bootFantasy() {
  function run() {
    if (typeof startFantasyListeners === "function") startFantasyListeners();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
})();
