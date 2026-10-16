/* Componentes de apresentação; valores e regras continuam nos serviços existentes. */
(function () {
  const esc = value => escapeHTML(value);
  const fold = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const money = value => value == null ? "—" : formatUSD(value, true);
  const playerButton = (p, content, className = "") => `<button type="button" class="${className}" data-premium-player="${esc(p.key)}">${content}</button>`;

  function portrait(p, size) {
    if (/^https?:\/\//i.test(String(p.photo || ""))) return photoHTML(p, size);
    return `<span class="premium-initials" style="--portrait-size:${size}px" aria-label="${esc(p.name)}">${esc(getPlayerInitials(p.name))}</span>`;
  }

  function search(query, players, clubs) {
    const q = fold(query);
    if (!q) return [];
    return [
      ...players.filter(p => fold(p.name).includes(q)).map(p => ({ kind: "player", key: p.key, name: p.name, detail: `${p.club} · ${p.rank || "—"}` })),
      ...clubs.filter(club => fold(club).includes(q)).map(club => ({ kind: "club", key: club, name: club, detail: "Equipe · Jet League" }))
    ].sort((a,b) => Number(fold(b.name).startsWith(q)) - Number(fold(a.name).startsWith(q)) || a.name.localeCompare(b.name)).slice(0, 8);
  }

  function renderDashboard() {
    const target = document.getElementById("premiumDashboard");
    if (!target) return;
    const players = getAllPlayersFlat();
    const byValue = players.filter(isCompetitivePlayer).filter(p => Number(p.marketValue) > 0).sort((a,b) => b.marketValue - a.marketValue || a.name.localeCompare(b.name));
    const featured = byValue.find(p => !p.retired && !p.freeAgent && !["aposentado", "livre"].includes(p.status));
    const transfers = Object.values(AppState.market.transfers || {}).filter(Boolean).sort((a,b) => String(b.date || "").localeCompare(String(a.date || "")));
    const rumors = Object.values(AppState.market.rumors || {}).filter(r => r && r.status !== "encerrada").sort((a,b) => String(b.date || "").localeCompare(String(a.date || "")));
    const header = (tag, title, action) => `<div class="panel-head"><div><span class="eyebrow">${tag}</span><h2>${title}</h2></div>${action || ""}</div>`;
    const link = (view, label) => `<button class="text-button" onclick="showView('${view}')">${label} <span aria-hidden="true">↗</span></button>`;
    const variation = featured && Market.variation(featured);
    const featuredMarkup = featured ? `
      <div class="spotlight-visual"><span class="spotlight-rank">${esc(featured.rank || "—")}</span>${portrait(featured, 160)}<span class="spotlight-watermark" aria-hidden="true">JET LEAGUE</span></div>
      <div class="spotlight-info"><button class="spotlight-club" data-premium-club="${esc(featured.club)}">${esc(featured.club)} ↗</button>
        <h3>${esc(featured.name)}</h3><div class="spotlight-value">${money(featured.marketValue)}</div>
        ${variation ? `<span class="movement-chip ${variation.positive ? "up" : "down"}">${esc(variation.text)}</span>` : `<p class="panel-caption">Valor oficial de mercado</p>`}
        ${playerButton(featured, 'Conhecer agente <span aria-hidden="true">↗</span>', "btn-primary")}
        <p class="selection-note">Maior valor entre os agentes em atividade.</p>
      </div>` : `<p class="empty-state">O destaque aparece quando os dados dos agentes estiverem disponíveis.</p>`;
    const transferRows = transfers.slice(0, 4).map(t => {
      const agent = players.find(p => t.playerKey === p.key || t.playerId && t.playerId === p.id);
      const st = statusLabel(t.status);
      const name = agent ? playerButton(agent, esc(t.playerName || agent.name), "transfer-agent") : `<strong>${esc(t.playerName || "Agente não informado")}</strong>`;
      return `<li class="transfer-row"><div class="transfer-portrait">${portrait(agent || { name: t.playerName }, 40)}</div><div class="transfer-route">${name}<div><span>${esc(t.from || "—")}</span><span class="route-arrow" aria-hidden="true">→</span><strong>${esc(t.to || "—")}</strong></div></div><div class="transfer-price"><strong>${money(t.fee)}</strong><span class="deal-status ${t.status === "oficial" ? "official" : "pending"}">${esc(st.label)}</span></div></li>`;
    }).join("");
    const rankings = byValue.slice(0, 6).map((p, i) => {
      const v = Market.variation(p);
      return `<li class="value-rank-row"><span class="rank-position">${String(i + 1).padStart(2, "0")}</span>${playerButton(p, `${portrait(p, 36)}<span><strong>${esc(p.name)}</strong><small>${esc(p.club)}</small></span>`, "rank-agent")}<div><strong>${money(p.marketValue)}</strong>${v ? `<small class="${v.positive ? "up" : "down"}">${esc(v.text)}</small>` : ""}</div></li>`;
    }).join("");
    const news = rumors.slice(0, 3).map(r => `<article class="news-row"><div class="news-topline"><span class="news-category">RUMOR DE MERCADO</span><time>${esc(r.date || "Data não informada")}</time></div><h3>${esc(r.interestedClub || "Equipe não informada")} de olho em ${esc(r.playerName || "agente")}</h3>${r.description ? `<p>${esc(r.description)}</p>` : ""}<div class="news-bottom"><span>${esc(statusLabel(r.status).label)}</span>${Number.isFinite(Number(r.reliability)) && r.reliability != null ? `<span>Confiabilidade registrada: ${esc(r.reliability)}%</span>` : ""}</div></article>`).join("");
    target.innerHTML = `
      <div class="dashboard-title"><div><span class="eyebrow">O JOGO ALÉM DA ARENA</span><h2>Dentro do mercado<span>.</span></h2></div><span class="section-caption">Agentes. Equipes. Próximos movimentos.</span></div>
      <div class="premium-grid">
        <section class="premium-panel spotlight-panel">${header("NO RADAR", "Agente em destaque")}${featuredMarkup}</section>
        <section class="premium-panel transfers-panel">${header("MOVIMENTAÇÕES", "Últimas transferências", link("transfers", "Ver todas"))}<ul class="premium-transfer-list">${transferRows || `<li class="empty-state">Nenhuma transferência registrada.</li>`}</ul><div class="panel-foot"><span class="official-dot"></span> Oficial e negociação identificados por registro.</div></section>
        <section class="fantasy-promo"><span class="eyebrow">SEU CONHECIMENTO EM JOGO</span><div class="fantasy-emblem" aria-hidden="true">✦</div><h2>JET<br><span>FANTASY</span></h2><p>Monte seu esquadrão.<br>Escolha seu capitão.<br>Dispute cada ponto.</p><button class="btn-fantasy" onclick="enterFantasyMode()">Entrar no Fantasy <span aria-hidden="true">↗</span></button><small>5 titulares · 1 reserva · 1 capitão</small></section>
        <section class="premium-panel ranking-panel">${header("QUEM DITA O RITMO", "Ranking do mercado", link("rankings", "Explorar"))}<ol class="premium-value-list">${rankings || `<li class="empty-state">Valores ainda não disponíveis.</li>`}</ol></section>
        <section class="premium-panel news-panel">${header("BASTIDORES DA LIGA", "Central de rumores", link("rumors", "Ver central"))}${news || `<p class="empty-state">Nenhum rumor ativo. Novos registros aparecerão aqui.</p>`}</section>
      </div>`;
  }

  let results = [];
  let selected = -1;
  function closeSearch() {
    const input = document.getElementById("globalSearch");
    const list = document.getElementById("globalSearchResults");
    if (list) list.hidden = true;
    input?.setAttribute("aria-expanded", "false");
    input?.removeAttribute("aria-activedescendant");
    selected = -1;
  }
  function refreshSearch(preserveClosed = false) {
    const input = document.getElementById("globalSearch");
    const list = document.getElementById("globalSearchResults");
    if (!input || !list || !input.value.trim()) { results = []; return closeSearch(); }
    if (preserveClosed && list.hidden) return;
    results = search(input.value, getAllPlayersFlat(), Object.keys(AppState.jet.rosters || {}));
    selected = -1;
    input.removeAttribute("aria-activedescendant");
    list.innerHTML = results.length ? results.map((r,i) => `<button type="button" role="option" aria-selected="false" tabindex="-1" id="global-result-${i}" data-search-index="${i}"><span class="search-result-icon" aria-hidden="true">${r.kind === "club" ? "◇" : "↗"}</span><span><strong>${esc(r.name)}</strong><small>${esc(r.detail)}</small></span><span class="search-result-type">${r.kind === "club" ? "EQUIPE" : "AGENTE"}</span></button>`).join("") : '<p role="status">Nenhum agente ou equipe encontrado.</p>';
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }
  function chooseResult(index) {
    const result = results[index];
    if (!result) return;
    document.getElementById("globalSearch").value = "";
    closeSearch();
    if (result.kind === "club") openClubProfile(result.key);
    else openPlayerProfile(result.key);
  }
  document.addEventListener("input", e => { if (e.target.id === "globalSearch") refreshSearch(); });
  document.addEventListener("submit", e => {
    if (e.target.id !== "globalSearchForm") return;
    e.preventDefault();
    chooseResult(selected >= 0 ? selected : 0);
  });
  document.addEventListener("click", e => {
    const player = e.target.closest("[data-premium-player]");
    const club = e.target.closest("[data-premium-club]");
    const result = e.target.closest("[data-search-index]");
    if (player) openPlayerProfile(player.dataset.premiumPlayer);
    else if (club) openClubProfile(club.dataset.premiumClub);
    else if (result) chooseResult(Number(result.dataset.searchIndex));
    if (!e.target.closest(".global-search")) closeSearch();
  });
  document.addEventListener("keydown", e => {
    if (e.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && !e.target.isContentEditable && !e.ctrlKey && !e.metaKey && !document.body.classList.contains("fantasy-mode") && !document.querySelector("#adminPanel.open, #aiReviewOverlay.open, dialog[open]")) {
      e.preventDefault(); document.getElementById("globalSearch")?.focus();
    }
    if (e.target.id !== "globalSearch") return;
    if (e.key === "Escape") closeSearch();
    if (["ArrowDown", "ArrowUp"].includes(e.key) && results.length) {
      e.preventDefault();
      selected = selected < 0 ? (e.key === "ArrowDown" ? 0 : results.length - 1) : (selected + (e.key === "ArrowDown" ? 1 : -1) + results.length) % results.length;
      document.getElementById("globalSearchResults").hidden = false;
      e.target.setAttribute("aria-expanded", "true");
      e.target.setAttribute("aria-activedescendant", "global-result-" + selected);
      document.querySelectorAll("[data-search-index]").forEach((el, i) => el.setAttribute("aria-selected", String(i === selected)));
      document.getElementById("global-result-" + selected)?.scrollIntoView({ block: "nearest" });
    }
  });
  window.PremiumUI = { renderDashboard, search, refreshSearch };
})();
