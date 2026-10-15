/* Rotas por query string: compatíveis com hospedagem estática e links antigos. */
(function () {
  const views = new Set(["home", "players", "clubs", "compare", "transfers", "rumors", "rankings"]);
  const fantasyViews = new Set(["hub", "squad", "market", "ranking", "rounds"]);
  const controls = {
    players: ["playerSearch", "playerClubFilter", "playerRankFilter", "playerRoleFilter", "playerStatusFilter", "playerValueFilter", "playerSort"],
    compare: ["compareA", "compareB", "compareC"],
    transfers: ["transferSeasonFilter", "transferClubFilter"],
    rankings: ["rankingType"],
    "player-profile": ["historySource", "historySeason", "historyRound"],
    "fantasy:market": ["fxFilterClub", "fxFilterSort", "fxFilterQ", "fxFilterRank", "fxFilterMax", "fxFilterAvailability"]
  };
  const original = {
    showView, openPlayerProfile, openClubProfile,
    enterFantasyMode, exitFantasyMode, showFantasyView
  };
  let rendering = false;
  let started = false;
  let revision = 0;
  let active;
  let pendingScroll = null;
  let refreshPending = false;

  function readRoute() {
    const params = new URL(location.href).searchParams;
    if (params.has("player")) return { view: "player-profile", key: params.get("player") };
    if (params.has("club")) return { view: "club-profile", key: params.get("club") };
    if (params.has("fantasy")) return { view: "fantasy", key: fantasyViews.has(params.get("fantasy")) ? params.get("fantasy") : "hub" };
    return { view: views.has(params.get("view")) ? params.get("view") : "home" };
  }

  function routeURL(route) {
    const url = new URL(location.href);
    for (const key of [...url.searchParams.keys()]) {
      if (["view", "player", "club", "fantasy"].includes(key) || key.startsWith("f.")) url.searchParams.delete(key);
    }
    if (route.view === "player-profile") url.searchParams.set("player", route.key);
    else if (route.view === "club-profile") url.searchParams.set("club", route.key);
    else if (route.view === "fantasy") url.searchParams.set("fantasy", route.key);
    else if (route.view !== "home") url.searchParams.set("view", route.view);
    url.hash = "";
    return url;
  }

  function controlIds(route = active) {
    return controls[route.view === "fantasy" ? `fantasy:${route.key}` : route.view] || [];
  }

  function save() {
    if (!started || rendering) return;
    const url = new URL(location.href);
    for (const id of controlIds()) {
      const el = document.getElementById(id);
      if (el) url.searchParams.set(`f.${id}`, el.value);
    }
    history.replaceState({ ...history.state, transferJet: true, scroll: pendingScroll || [window.scrollX, window.scrollY] }, "", url);
  }

  function restoreScroll() {
    if (!pendingScroll) return;
    const ui = window.AppState.ui;
    if (!ui.jetLoaded || !ui.marketLoaded) return;
    if (active.view === "fantasy" && !window.AppState.fantasy.ui.participantsLoaded) return;
    const scroll = pendingScroll;
    const currentRevision = revision;
    requestAnimationFrame(() => {
      if (currentRevision !== revision || pendingScroll !== scroll) return;
      window.scrollTo(...scroll);
      pendingScroll = null;
    });
  }

  function restoreControls() {
    const params = new URL(location.href).searchParams;
    let restored = false;
    for (const id of controlIds()) {
      const el = document.getElementById(id);
      if (el && params.has(`f.${id}`)) {
        el.value = params.get(`f.${id}`);
        restored = true;
      }
    }
    return restored;
  }

  function render(resetControls = false) {
    rendering = true;
    const route = active;
    try {
      if (route.view === "fantasy") {
        ensureFantasyState().ui.view = route.key;
        original.enterFantasyMode();
      } else {
        if (window.AppState.fantasy?.active) original.exitFantasyMode();
        if (resetControls) {
          for (const id of controlIds()) {
            const el = document.getElementById(id);
            if (el) el.value = el.tagName === "SELECT" ? el.options[0]?.value || "" : "";
          }
        }
        restoreControls();
        if (route.view === "player-profile") {
          if (getAllPlayersFlat().some(p => p.key === route.key)) original.openPlayerProfile(route.key);
          else {
            original.showView("player-profile");
            const el = document.getElementById("playerProfileContent");
            el.textContent = window.AppState.ui.jetLoaded && window.AppState.ui.marketLoaded
              ? "Agente não encontrado. Volte para Agentes para consultar a lista."
              : "Aguardando dados do agente. Verifique a conexão se o carregamento não terminar.";
          }
        } else if (route.view === "club-profile") original.openClubProfile(route.key);
        else original.showView(route.view);
      }
      // Selects dinâmicos só recebem seu valor depois que as opções existem.
      if (restoreControls()) {
        if (route.view === "fantasy" && route.key === "market") fxFilterMarket();
        else if (views.has(route.view)) original.showView(route.view);
      }
    } finally {
      window.updateMarketInterface?.(route);
      rendering = false;
    }
  }

  function navigate(route) {
    if (!started) return;
    if (active.view === route.view && active.key === route.key) return;
    save();
    pendingScroll = null;
    active = route;
    history.pushState({ transferJet: true, scroll: [0, 0] }, "", routeURL(route));
    revision++;
    render(true);
    window.scrollTo(0, 0);
  }

  window.showView = (view, el) => rendering ? original.showView(view, el) : navigate({ view: views.has(view) ? view : "home" });
  window.openPlayerProfile = key => rendering ? original.openPlayerProfile(key) : navigate({ view: "player-profile", key });
  window.openClubProfile = key => rendering ? original.openClubProfile(key) : navigate({ view: "club-profile", key });
  window.enterFantasyMode = () => rendering ? original.enterFantasyMode() : navigate({ view: "fantasy", key: "hub" });
  window.exitFantasyMode = () => rendering ? original.exitFantasyMode() : navigate({ view: "home" });
  window.showFantasyView = key => rendering ? original.showFantasyView(key) : navigate({ view: "fantasy", key: fantasyViews.has(key) ? key : "hub" });

  window.AppRouter = {
    start() {
      if (started) return;
      started = true;
      active = readRoute();
      history.scrollRestoration = "manual";
      history.replaceState({ ...history.state, transferJet: true, scroll: history.state?.scroll || [0, 0] }, "", location.href);
      pendingScroll = history.state.scroll;
      render();
      restoreScroll();
    },
    refresh() {
      if (!started) return;
      const focused = document.activeElement;
      const editing = focused?.id && /^(INPUT|TEXTAREA|SELECT)$/.test(focused.tagName)
        ? { id: focused.id, value: focused.value, start: focused.selectionStart, end: focused.selectionEnd } : null;
      const scroll = [window.scrollX, window.scrollY];
      render();
      if (editing) {
        const restored = document.getElementById(editing.id);
        if (restored && restored !== focused) {
          restored.value = editing.value;
          restored.focus({ preventScroll: true });
          if (editing.start != null && typeof restored.setSelectionRange === "function") restored.setSelectionRange(editing.start, editing.end);
        }
      }
      if (pendingScroll) restoreScroll();
      else window.scrollTo(...scroll);
    },
    requestRefresh(group) {
      if (!started || (group === "fantasy" && active.view !== "fantasy") || refreshPending) return;
      refreshPending = true;
      requestAnimationFrame(() => { refreshPending = false; window.AppRouter.refresh(); });
    },
    playerURL: key => routeURL({ view: "player-profile", key }).toString()
  };

  window.addEventListener("popstate", () => {
    active = readRoute();
    revision++;
    pendingScroll = history.state?.scroll || [0, 0];
    render(true);
    restoreScroll();
  });
  document.addEventListener("input", e => { if (controlIds().includes(e.target.id)) save(); });
  document.addEventListener("change", e => { if (controlIds().includes(e.target.id)) save(); });
  document.addEventListener("click", e => {
    const link = e.target.closest(".nav a[data-view]");
    if (!link || e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || link.target === "_blank") return;
    e.preventDefault();
    window.showView(link.dataset.view);
  });
  let scrollPending = false;
  window.addEventListener("scroll", () => {
    if (scrollPending) return;
    scrollPending = true;
    requestAnimationFrame(() => { scrollPending = false; save(); });
  }, { passive: true });
  window.addEventListener("pagehide", save);
})();
