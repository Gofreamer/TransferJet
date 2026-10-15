/* Componentes do mercado reutilizam os perfis, tabelas e gráficos existentes. */
(function () {
  function historyMarkup(player) {
    const all = [...Market.history(player), ...Market.history(player, { source: "legacy" })];
    const seasons = [...new Set(all.map(e => e.season).filter(Boolean))];
    const rounds = [...new Set(Market.events(player).map(e => e.round).filter(Boolean))];
    return `<p class="market-note" id="historyOrigin">Registros reais começam nas novas alterações. Dados anteriores ficam separados, sem comprovação de origem.</p>
      <div class="filters history-filters">
        <select id="historySource" aria-label="Origem do histórico" onchange="MarketUI.renderHistory()"><option value="recorded">Alterações reais registradas</option><option value="legacy">Histórico anterior / não verificado</option></select>
        <select id="historySeason" aria-label="Temporada do histórico" onchange="MarketUI.renderHistory()"><option value="">Todas as temporadas</option>${seasons.map(s => `<option value="${escapeHTML(s)}">${escapeHTML(s)}</option>`).join("")}</select>
        <select id="historyRound" aria-label="Rodada do histórico" onchange="MarketUI.renderHistory()"><option value="">Todas as rodadas</option>${rounds.map(r => `<option value="${escapeHTML(r)}">${escapeHTML(r)}</option>`).join("")}</select>
      </div><div class="chart-container" id="marketHistoryChart"><canvas id="valueChart"></canvas></div><div id="marketHistoryRows"></div>`;
  }
  function renderHistory() {
    const player = window.AppState.ui.selectedPlayer;
    if (!player || !document.getElementById("marketHistoryChart")) return;
    const source = document.getElementById("historySource").value;
    const rows = Market.history(player, { source, season: document.getElementById("historySeason").value, round: document.getElementById("historyRound").value });
    document.getElementById("historyOrigin").textContent = source === "legacy"
      ? "Histórico anterior: pode conter estimativas fictícias. Não é usado para calcular altas e quedas reais."
      : "Alterações realmente salvas a partir desta versão, identificadas por temporada, rodada, data e origem. Nenhum ponto anterior foi inventado.";
    document.getElementById("marketHistoryChart").innerHTML = '<canvas id="valueChart"></canvas>';
    renderValueChart(rows);
    const target = document.getElementById("marketHistoryRows");
    target.innerHTML = rows.length ? `<div class="table-wrap"><table><thead><tr><th>Período</th><th>Valor anterior</th><th>Valor registrado</th><th>Origem</th></tr></thead><tbody>${rows.map(e => `<tr><td>${escapeHTML(e.label)}</td><td>${e.previousValue != null ? formatUSD(e.previousValue, true) : "—"}</td><td>${formatUSD(e.value, true)}</td><td>${escapeHTML(source === "legacy" ? "Não verificada" : e.source)}</td></tr>`).join("")}</tbody></table></div>` : '<p class="empty-state">Nenhuma alteração registrada neste período. Os valores atuais continuam disponíveis acima.</p>';
  }
  function movementMarkup(player) {
    const v = Market.variation(player);
    return v ? `<div class="market-movement ${v.positive ? "up" : "down"}" title="Última alteração real registrada">${escapeHTML(v.text)}</div>` : '<div class="market-movement neutral">Sem variação registrada</div>';
  }
  function transferTimeline(player) {
    const players = getAllPlayersFlat();
    const transfers = Object.values(window.AppState.market.transfers || {}).filter(t => Market.transferMatches(t, player, players)).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    if (!transfers.length) return '<p class="empty-state">Nenhuma transferência oficial identificada para este agente.</p>';
    return `<ol class="transfer-timeline">${transfers.map(t => `<li><div><time>${escapeHTML(t.date || "Data não registrada")}</time><span>${escapeHTML(t.season || "")}</span></div><strong>${escapeHTML(t.from)} <span aria-hidden="true">→</span> ${escapeHTML(t.to)}</strong><p>${formatUSD(t.fee)} · ${escapeHTML(t.type || "Tipo não registrado")}</p></li>`).join("")}</ol>`;
  }
  function auditMarkup(player) {
    const entries = Object.values(player.changeLog || {}).filter(e => e && Number.isFinite(e.at)).sort((a, b) => b.at - a.at).slice(0, 20);
    if (!entries.length) return "";
    const labels = { marketValue: "Valor", peakValue: "Pico", salary: "Salário", releaseClause: "Cláusula", contractUntil: "Contrato", team: "Equipe", name: "Nome", status: "Status", stats: "Estatísticas", titles: "Títulos" };
    const describe = (field, value) => escapeHTML(value == null ? "—" : ["marketValue", "peakValue", "salary", "releaseClause"].includes(field) ? formatUSD(value, true) : typeof value === "object" ? JSON.stringify(value) : value);
    return `<section class="section"><h2 class="section-h">Últimas alterações registradas</h2><div class="table-wrap"><table><thead><tr><th>Data</th><th>Origem</th><th>Alterações</th></tr></thead><tbody>${entries.map(e => `<tr><td>${escapeHTML(new Date(e.at).toLocaleString("pt-BR"))}</td><td>${escapeHTML(e.source)}</td><td>${Object.entries(e.changes || {}).map(([field, change]) => `<div>${escapeHTML(labels[field] || field)}: ${describe(field, change.before)} → ${describe(field, change.after)}</div>`).join("")}</td></tr>`).join("")}</tbody></table></div></section>`;
  }
  window.MarketUI = { historyMarkup, renderHistory, movementMarkup, transferTimeline, auditMarkup };
})();
