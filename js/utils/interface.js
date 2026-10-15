/* Comportamentos de apresentação compartilhados pelo roteador. */
(function () {
  const pages = {
    home: ["Visão geral", "O mercado em jogo.", "Acompanhe os agentes, as equipes e os movimentos que definem a Jet League."],
    players: ["Agentes", "Talento que faz a diferença.", "Explore o elenco da liga. Encontre agentes por equipe, rank, função e valor."],
    clubs: ["Equipes", "A força de cada equipe.", "Conheça os elencos e descubra onde está o valor da Jet League."],
    compare: ["Comparar", "Lado a lado. Dado a dado.", "Compare até três agentes para avaliar valores, títulos e desempenho."],
    transfers: ["Transferências", "Cada movimento conta.", "Acompanhe as negociações e as mudanças de equipe ao longo das temporadas."],
    rumors: ["Rumores", "No radar do mercado.", "Interesses, negociações e rumores. Acompanhe o que pode vir a seguir."],
    rankings: ["Rankings", "Quem está no topo?", "Os destaques da liga por valor, desempenho e força do elenco."],
    "player-profile": ["Perfil do agente", "Por dentro do agente.", "Valor de mercado, desempenho e trajetória na Jet League."],
    "club-profile": ["Perfil da equipe", "Por dentro da equipe.", "O elenco, os agentes e o patrimônio esportivo de cada clube."]
  };

  window.toggleSiteMenu = function (open, restoreFocus = true) {
    const isOpen = open ?? !document.body.classList.contains("menu-open");
    document.body.classList.toggle("menu-open", isOpen);
    const button = document.getElementById("menuToggle");
    button?.setAttribute("aria-expanded", String(isOpen));
    button?.setAttribute("aria-label", isOpen ? "Fechar navegação" : "Abrir navegação");
    const mobile = window.matchMedia("(max-width: 900px)").matches;
    const nav = document.getElementById("siteNavigation");
    nav.inert = mobile && !isOpen;
    if (isOpen) nav.querySelector("a")?.focus();
    else if (restoreFocus && mobile) button?.focus({ preventScroll: true });
  };

  function refreshMetrics() {
    const state = window.AppState;
    const players = getAllPlayersFlat();
    const metrics = {
      statPlayers: state.ui.jetLoaded || state.ui.marketLoaded ? players.length : "—",
      statClubs: state.ui.jetLoaded ? Object.keys(state.jet.rosters || {}).length : "—",
      statMarketValue: state.ui.marketLoaded ? formatUSD(getTotalMarketValue(), true) : "—",
      statTransfers: state.ui.marketLoaded ? Object.keys(state.market.transfers || {}).length : "—",
      seasonBadge: state.jet.currentSeason || "—"
    };
    Object.entries(metrics).forEach(([id, value]) => { const el = document.getElementById(id); if (el) el.textContent = value; });
  }

  function refreshNotice() {
    const el = document.getElementById("dataNotice");
    const ui = window.AppState.ui;
    const failed = ui.jetError || ui.marketError;
    const loading = !ui.jetLoaded || !ui.marketLoaded;
    const offline = !ui.jetConnected || !ui.marketConnected;
    document.getElementById("mainContent").setAttribute("aria-busy", String(loading && !failed));
    el.classList.toggle("hidden", !failed && !loading && !offline);
    if (failed) {
      el.replaceChildren(document.createTextNode("Não foi possível carregar parte dos dados. As informações disponíveis continuam acessíveis."));
      const retry = document.createElement("button");
      retry.textContent = "Tentar novamente";
      retry.onclick = () => { startJetListeners(); startMarketListeners(); };
      el.appendChild(retry);
    } else {
      el.textContent = loading
        ? "Carregando os dados da liga e do mercado… Se estiver sem conexão, você ainda pode navegar pelas seções."
        : "Conexão parcial ou indisponível. Exibindo os últimos dados recebidos.";
    }
  }

  window.updateMarketInterface = function (route) {
    document.body.dataset.page = route.view;
    if (route.view === "fantasy") {
      document.title = "Jet Fantasy · Jet Market";
      toggleSiteMenu(false, false);
      return;
    }
    const [label, title, description] = pages[route.view] || pages.home;
    document.getElementById("currentPageLabel").textContent = label;
    document.title = `${label} · Jet Market`;
    const heading = document.getElementById("heroTitle");
    heading.textContent = title.replace(/\.$/, "");
    if (title.endsWith(".")) {
      const dot = document.createElement("span");
      dot.className = "accent-dot";
      dot.textContent = ".";
      heading.appendChild(dot);
    }
    document.getElementById("heroDescription").textContent = description;
    document.getElementById("heroActions").classList.toggle("hidden", route.view !== "home");
    document.querySelectorAll(".nav a[data-view]").forEach(link => {
      const section = route.view === "player-profile" ? "players" : route.view === "club-profile" ? "clubs" : route.view;
      const selected = link.dataset.view === section;
      link.classList.toggle("active", selected);
      if (selected) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    document.querySelectorAll("main .card[onclick], main .player-link[onclick]").forEach(el => {
      el.tabIndex = 0;
      el.setAttribute("role", "button");
    });
    const labels = { compareA: "Primeiro agente para comparar", compareB: "Segundo agente para comparar", compareC: "Terceiro agente para comparar", transferSeasonFilter: "Filtrar temporada", transferClubFilter: "Filtrar equipe", rankingType: "Tipo de ranking" };
    Object.entries(labels).forEach(([id, text]) => document.getElementById(id)?.setAttribute("aria-label", text));
    refreshMetrics();
    refreshNotice();
  };

  document.addEventListener("click", e => {
    if (e.target.closest(".site-header [data-view], .site-header .fx-entry-btn, .site-header .logo")) toggleSiteMenu(false, false);
  });
  document.addEventListener("keydown", e => {
    if (document.body.classList.contains("menu-open")) {
      if (e.key === "Escape") { e.preventDefault(); toggleSiteMenu(false); }
      if (e.key === "Tab") {
        const items = [...document.querySelectorAll(".site-header a[href], .site-header button")];
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
      return;
    }
    if ((e.key === "Enter" || e.key === " ") && e.target.matches(".card[role='button'], .player-link[role='button']")) {
      e.preventDefault();
      e.target.click();
    }
  });
  document.addEventListener("DOMContentLoaded", () => toggleSiteMenu(false, false));
  document.addEventListener("connection:updated", refreshNotice);
  window.matchMedia("(max-width: 900px)").addEventListener("change", () => toggleSiteMenu(false, false));
})();
