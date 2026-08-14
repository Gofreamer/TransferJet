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

/* ========== HELPERS DE DADOS ========== */
function getAllPlayersFlat() {
  const rosters = window.AppState.jet.rosters || {};
  const marketPlayers = window.AppState.market.players || {};
  const list = [];

  for (const [club, agents] of Object.entries(rosters)) {
    (agents || []).forEach((p, idx) => {
      const key = playerKey(club, p.n);
      const m = marketPlayers[key] || {};
      const stats = m.stats || {};
      list.push({
        key,
        name: p.n,
        role: p.role || "titular",
        club,
        marketValue: m.marketValue ?? null,
        peakValue: m.peakValue ?? null,
        nationality: m.nationality || "—",
        age: m.age || null,
        contractUntil: m.contractUntil || "—",
        status: m.status || "ativo",
        photo: m.photo || "",
        valueHistory: m.valueHistory || [],
        rank: m.rank || "—",
        functionRole: m.functionRole || "",
        trophy: m.trophy || 0,
        stats: {
          P: stats.P ?? 0,
          V: stats.V ?? 0,
          D: stats.D ?? 0,
          winRate: stats.winRate ?? (stats.P ? stats.V / stats.P : 0)
        },
        statsRound: m.statsRound || ""
      });
    });
  }
  return list;
}

function getClubMarketValue(clubName) {
  const players = getAllPlayersFlat().filter(p => p.club === clubName);
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
  const freeAgents = players.filter(p => !p.club).length;
  document.getElementById("kpiRow").innerHTML = `
    <div class="kpi"><div class="kpi-label">Total de Agentes</div><div class="kpi-value">${players.length}</div></div>
    <div class="kpi"><div class="kpi-label">Equipes</div><div class="kpi-value">${clubs.length}</div></div>
    <div class="kpi"><div class="kpi-label">Valor Total do Mercado</div><div class="kpi-value cyan">${formatUSD(getTotalMarketValue(), true)}</div></div>
    <div class="kpi"><div class="kpi-label">Valor Médio</div><div class="kpi-value cyan">${formatUSD(avgValue, true)}</div></div>
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
        html: `<strong>${t.playerName}</strong> transferido: ${t.from} → <strong>${t.to}</strong> por ${formatUSD(t.fee, true)}`
      });
    });
    rumors.filter(r => r.status !== "encerrada").forEach(r => {
      const st = statusLabel(r.status);
      feedItems.push({
        type: "rumor",
        date: r.date || "",
        html: `${st.icon} <strong>${r.interestedClub}</strong> interessado em <strong>${r.playerName}</strong> (${r.reliability}%)`
      });
    });
    // Top valued as "destaque"
    const top3 = [...players].filter(p => p.marketValue).sort((a,b)=>b.marketValue-a.marketValue).slice(0,3);
    top3.forEach(p => {
      feedItems.push({
        type: "value",
        date: "9999",
        html: `💎 <strong>${p.name}</strong> (${p.club}) valorizado em ${formatUSD(p.marketValue, true)}`
      });
    });
    feedItems.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    const shown = feedItems.slice(0, 8);
    feedEl.innerHTML = shown.length ? `
      <div class="table-wrap">
        <table>
          <tbody>
            ${shown.map(item => `<tr><td style="padding:12px 14px">${item.html}</td><td style="color:var(--text-dim);font-size:0.8rem;white-space:nowrap">${item.date !== "9999" ? item.date : ""}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>
    ` : `<p class="empty-state">Feed vazio por enquanto.</p>`;
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
                <td><span class="player-link" onclick="openPlayerProfile('${t.playerKey}')">${t.playerName}</span></td>
                <td>${t.from} → <strong>${t.to}</strong></td>
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
              <td><span class="player-link" onclick="openPlayerProfile('${p.key}')">${p.name}</span></td>
              <td>${p.club}</td>
              <td style="color:var(--cyan);font-weight:700">${formatUSD(p.marketValue, true)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  ` : `<p class="empty-state">Sem dados de valor ainda.</p>`;

  // Gainers / Losers (usando peakValue como referência simples)
  const withVar = players.filter(p => p.marketValue && p.peakValue).map(p => ({
    ...p,
    diff: p.marketValue - p.peakValue,
    pct: ((p.marketValue - p.peakValue) / p.peakValue) * 100
  }));

  const gainers = [...withVar].filter(p => p.diff < 0).sort((a, b) => a.diff - b.diff).slice(0, 5); // mais longe do pico = mais "desvalorizado" no momento? 
  // Na verdade, para demo, vamos inverter a lógica de forma mais interessante:
  // Como os valores são seed, vamos simular variação positiva/negativa baseada em posição

  // Para visualização: top por valor atual como "valorizados"
  const topGainersEl = document.getElementById("topGainers");
  const topLosersEl = document.getElementById("topLosers");

  const top5 = byValue.slice(0, 5);
  topGainersEl.innerHTML = top5.length ? `
    <div class="table-wrap"><table>
      <thead><tr><th>Agente</th><th>Equipe</th><th>Valor</th></tr></thead>
      <tbody>
        ${top5.map(p => `<tr>
          <td><span class="player-link" onclick="openPlayerProfile('${p.key}')">${p.name}</span></td>
          <td>${p.club}</td>
          <td class="variation up">${formatUSD(p.marketValue, true)}</td>
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
          <td><span class="player-link" onclick="openPlayerProfile('${p.key}')">${p.name}</span></td>
          <td>${p.club}</td>
          <td class="variation down">${formatUSD(p.marketValue, true)}</td>
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
            <div class="rumor-title">${r.interestedClub} → ${r.playerName}</div>
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
  if (roleF) players = players.filter(p => p.role === roleF);
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
    <div class="card" onclick="openPlayerProfile('${p.key}')">
      <div class="card-with-photo">
        ${photoHTML(p, 52)}
        <div class="card-body">
          <div class="card-title">${p.name}</div>
          <div class="card-sub">${p.club} · ${p.rank || "—"}${p.stats?.P ? ` · ${p.stats.V}V-${p.stats.D}D (${wr})` : ""}</div>
          <div class="card-value">${p.marketValue ? formatUSD(p.marketValue, true) : '<span style="color:var(--text-muted);font-size:0.85rem">Sem valor</span>'}</div>
          <div class="card-meta">
            <span class="tag ${p.role}">${roleLabel(p.role)}</span>
            ${p.trophy ? `<span class="tag">🏆 ${p.trophy}</span>` : ""}
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
    <div class="card" onclick="openClubProfile('${c.name}')">
      <div class="card-title">${c.name}</div>
      <div class="card-sub">#${i + 1} em valor de mercado</div>
      <div class="card-value">${formatUSD(c.totalValue, true)}</div>
      <div class="card-meta">
        <span class="tag">${c.size} agentes</span>
        <span class="tag">Média ${formatUSD(c.avg, true)}</span>
      </div>
      <div style="margin-top:8px;font-size:0.8rem;color:var(--text-muted)">
        Mais valioso: <strong style="color:var(--text)">${c.topAgent}</strong>
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
              <td><span class="player-link" onclick="openPlayerProfile('${t.playerKey}')">${t.playerName}</span></td>
              <td>${t.from}</td>
              <td><strong>${t.to}</strong></td>
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
            <div class="rumor-title">${r.interestedClub} tem interesse em ${r.playerName}</div>
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
  const opts = players.map(p => `<option value="${p.key}">${p.name} (${p.club})</option>`).join("");

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
    { label: "Troféus", fn: p => p.trophy ? "🏆 " + p.trophy : "—" },
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
                <span class="player-link" onclick="openPlayerProfile('${p.key}')">${p.name}</span>
                <span style="font-size:0.75rem;color:var(--text-muted)">${p.club}</span>
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
            <td><span class="player-link" onclick="openPlayerProfile('${p.key}')">${p.name}</span></td>
            <td>${p.club}</td>
            <td>${p.rank || "—"}</td>
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
            <td><span class="player-link" onclick="openPlayerProfile('${p.key}')">${p.name}</span></td>
            <td>${p.club}</td>
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
            <td><span class="player-link" onclick="openPlayerProfile('${p.key}')">${p.name}</span></td>
            <td>${p.club}</td>
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
            <td><span class="player-link" onclick="openClubProfile('${c.name}')">${c.name}</span></td>
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
            <td>${t.playerName}</td>
            <td>${t.from} → ${t.to}</td>
            <td style="color:var(--cyan);font-weight:700">${formatUSD(t.fee)}</td>
            <td>${t.season}</td>
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
    <button onclick="showView('players')" style="background:none;border:1px solid var(--border);color:var(--text-muted);padding:6px 12px;border-radius:8px;cursor:pointer;margin-bottom:20px;font-size:0.85rem">
      ← Voltar para Agentes
    </button>

    <div class="profile-header">
      <div class="profile-photo" style="padding:0;overflow:hidden">
        <img src="${getPlayerPhoto(p)}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover"
             onerror="this.parentElement.innerHTML='${getPlayerInitials(p.name)}'"/>
      </div>
      <div class="profile-info">
        <h1>${p.name}</h1>
        <div class="profile-meta">
          <span class="tag">${p.club}</span>
          <span class="tag ${p.role}">${roleLabel(p.role)}</span>
          <span class="tag">${p.nationality}</span>
          ${p.age ? `<span class="tag">${p.age} anos</span>` : ""}
          <span class="tag">Contrato até ${p.contractUntil}</span>
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
    </div>

    <div class="section">
      <h2 class="section-h">Evolução do Valor</h2>
      <div class="chart-container">
        <canvas id="valueChart"></canvas>
      </div>
    </div>

    <div class="section">
      <h2 class="section-h">Performance ${p.statsRound ? `(${p.statsRound})` : ""}</h2>
      <div class="kpi-row">
        <div class="kpi"><div class="kpi-label">Rank</div><div class="kpi-value" style="font-size:1.1rem">${p.rank || "—"}</div></div>
        <div class="kpi"><div class="kpi-label">Partidas</div><div class="kpi-value" style="font-size:1.1rem">${p.stats?.P ?? "—"}</div></div>
        <div class="kpi"><div class="kpi-label">Vitórias</div><div class="kpi-value" style="font-size:1.1rem;color:var(--green)">${p.stats?.V ?? "—"}</div></div>
        <div class="kpi"><div class="kpi-label">Derrotas</div><div class="kpi-value" style="font-size:1.1rem;color:var(--red)">${p.stats?.D ?? "—"}</div></div>
        <div class="kpi"><div class="kpi-label">Win Rate</div><div class="kpi-value cyan" style="font-size:1.1rem">${p.stats?.P ? Math.round(p.stats.winRate*100)+"%" : "—"}</div></div>
        <div class="kpi"><div class="kpi-label">Função</div><div class="kpi-value" style="font-size:1rem">${p.functionRole || roleLabel(p.role)}</div></div>
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
        <div class="kpi"><div class="kpi-label">Equipe Atual</div><div class="kpi-value" style="font-size:1.1rem">${p.club}</div></div>
        <div class="kpi"><div class="kpi-label">Nacionalidade</div><div class="kpi-value" style="font-size:1.1rem">${p.nationality}</div></div>
        <div class="kpi"><div class="kpi-label">Idade</div><div class="kpi-value" style="font-size:1.1rem">${p.age || "—"}</div></div>
        <div class="kpi"><div class="kpi-label">Contrato</div><div class="kpi-value" style="font-size:1.1rem">${p.contractUntil}</div></div>
      </div>
    </div>
  `;

  // Render chart
  requestAnimationFrame(() => renderValueChart(history));
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
  if (!canvas || typeof Chart === "undefined" || !history.length) return;

  if (window._valueChartInstance) {
    window._valueChartInstance.destroy();
  }

  window._valueChartInstance = new Chart(canvas, {
    type: "line",
    data: {
      labels: history.map(h => h.season),
      datasets: [{
        label: "Valor de Mercado",
        data: history.map(h => h.value),
        borderColor: "#00e5ff",
        backgroundColor: "rgba(0, 229, 255, 0.1)",
        fill: true,
        tension: 0.3,
        pointBackgroundColor: "#00e5ff",
        pointRadius: 5,
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
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
          ticks: { color: "#8494a7", font: { size: 11 } },
          grid: { color: "rgba(255,255,255,0.04)" }
        },
        y: {
          ticks: {
            color: "#8494a7",
            font: { size: 11 },
            callback: (v) => formatUSD(v, true)
          },
          grid: { color: "rgba(255,255,255,0.04)" }
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

    <h1 style="font-size:1.6rem;font-weight:800;margin-bottom:8px">${clubName}</h1>
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
                <td><span class="player-link" onclick="openPlayerProfile('${p.key}')">${p.name}</span></td>
                <td><span class="tag ${p.role}">${roleLabel(p.role)}</span></td>
                <td style="color:var(--cyan);font-weight:700">${p.marketValue ? formatUSD(p.marketValue, true) : "—"}</td>
                <td>${p.nationality}</td>
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

  startJetListeners();
  startMarketListeners();
  if (typeof initAuth === "function") initAuth();

  document.addEventListener("jet:updated", () => {
    const view = window.AppState.ui.currentView;
    if (view === "home") renderHome();
    if (view === "players") renderPlayers();
    if (view === "clubs") renderClubs();
  });

  document.addEventListener("market:updated", () => {
    const view = window.AppState.ui.currentView;
    if (view === "home") renderHome();
    if (view === "players") renderPlayers();
    if (view === "clubs") renderClubs();
    if (view === "compare") renderCompare();
    if (view === "transfers") renderTransfers();
    if (view === "rumors") renderRumors();
    if (view === "rankings") renderRankings();
  });

  renderHome();
});

window.renderCompare = renderCompare;
window.openPlayerProfile = openPlayerProfile;
window.openClubProfile = openClubProfile;
window.showView = showView;
