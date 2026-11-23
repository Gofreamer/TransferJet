/* Seleção e carregamento do painel de importação e sincronização. */
(function () {
  const locate = id => document.getElementById(id);

  function updateOptions() {
    const form = locate("syncLookup");
    if (!form) return;
    const seasonInput = locate("syncSeason");
    const current = AppState.jet.currentSeason;
    if (!seasonInput.dataset.edited) seasonInput.value = current || "";

    const markers = getSyncedMatchMap();
    const archived = new Map();
    const addArchived = (name, value) => {
      if (!name || value == null || value === "") return;
      const round = Number(value);
      if (!Number.isSafeInteger(round) || round < 0) return;
      if (!archived.has(name)) archived.set(name, new Set());
      archived.get(name).add(round);
    };
    const seasons = new Set([current]);
    for (const marker of Object.values(markers)) {
      if (!marker?.season) continue;
      seasons.add(marker.season);
      addArchived(marker.season, marker.round);
    }

    const season = seasonInput.value.trim();
    const catalog = form.catalog.get(season);
    const pending = new Set();
    for (const [name, matches] of form.catalog) {
      seasons.add(name);
      for (const match of matches) {
        if (Object.hasOwn(markers, match.id)) addArchived(name, match.round);
        else if (name === season && match.syncable) pending.add(match.round);
      }
    }

    const compareSeasons = (a, b) => b.localeCompare(a, "pt-BR", { numeric: true });
    const seasonList = locate("syncSeasons");
    seasonList.replaceChildren(...[...seasons].filter(Boolean).sort(compareSeasons).map(name => new Option(name, name)));

    const list = locate("syncRoundChoices");
    list.replaceChildren(...[...pending].sort((a, b) => b - a)
      .map(round => roundButton(season, round, "pendente")));

    if (locate("syncShowArchived").checked) {
      for (const name of [...archived.keys()].sort(compareSeasons)) {
        const rounds = [...archived.get(name)].filter(round => name !== season || !pending.has(round)).sort((a, b) => b - a);
        if (!rounds.length) continue;
        const group = document.createElement("fieldset");
        group.className = "sync-mode sync-archive-group";
        const label = document.createElement("legend");
        label.textContent = name;
        const choices = document.createElement("div");
        choices.className = "sync-round-choices";
        choices.append(...rounds.map(round => roundButton(name, round, "já sincronizada")));
        group.append(label, choices);
        list.append(group);
      }
      if (!list.querySelector("fieldset")) {
        const empty = document.createElement("p");
        empty.textContent = "Nenhuma rodada arquivada.";
        list.append(empty);
      }
    }
    if (catalog) {
      locate("syncCatalogStatus").textContent = pending.size
        ? `${pending.size} rodada(s) com partidas pendentes nesta temporada.`
        : "Nenhuma rodada pendente nesta temporada.";
    }
  }

  function roundButton(season, round, status) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn-gray btn-sm";
    button.textContent = roundLabel(round) + " · " + status;
    button.addEventListener("click", () => {
      if (locate("syncLoad").disabled) return;
      const seasonInput = locate("syncSeason");
      if (seasonInput.value.trim() !== season) {
        seasonInput.dataset.edited = "true";
        seasonInput.value = season;
        locate("syncCatalogStatus").textContent = "";
      }
      locate("syncRound").value = round;
      void lookup();
    });
    return button;
  }

  function roundLabel(round) {
    return round === 0 ? "Sem rodada (0)" : "Rodada " + round;
  }

  function canSync(match) {
    return !!match.id && Array.isArray(match.fights) && match.fights.length > 0
      && !/cancel|pending|scheduled|agend|andamento|live/i.test(String(match.status || ""));
  }

  async function discover() {
    const form = locate("syncLookup");
    const button = locate("syncDiscover");
    const status = locate("syncCatalogStatus");
    button.disabled = true;
    status.textContent = "Buscando rodadas disponíveis…";
    try {
      const season = locate("syncSeason").value.trim();
      if (!season) { status.textContent = "Informe a temporada para buscar as rodadas."; return; }
      const data = await JetMatches.readSeason(season);
      if (!form.isConnected || locate("syncSeason").value.trim() !== season) return;
      form.catalog.set(season, data.filter(match => match.timeA && match.timeB).map(match => ({
        id: match.id, round: JetMatches.matchRound(match), syncable: canSync(match)
      })));
      updateOptions();
    } catch (error) {
      status.textContent = "Falha ao buscar rodadas. " + error.message;
    } finally {
      button.disabled = false;
    }
  }

  async function lookup() {
    const form = locate("syncLookup");
    if (!form.reportValidity()) return;
    const season = locate("syncSeason").value.trim();
    const round = locate("syncRound").valueAsNumber;
    const status = locate("syncStatus");
    const list = locate("syncMatchList");
    const button = locate("syncLoad");
    if (button.disabled || !season || !Number.isSafeInteger(round) || round < 0) return;
    button.disabled = true;
    status.textContent = "Carregando partidas…";
    form.selection = null;
    list.replaceChildren();
    try {
      const data = await JetMatches.readRound(season, round);
      if (!form.isConnected || locate("syncSeason").value.trim() !== season || locate("syncRound").valueAsNumber !== round) return;
      const matches = Object.values(data).filter(match => match?.timeA && match.timeB);
      if (!matches.length) {
        status.textContent = `Nenhuma partida em ${season} · ${roundLabel(round)}.`;
        return;
      }
      form.selection = { matches, season, round };
      updateOptions();
      renderMatches(form.selection);
    } catch (error) {
      status.textContent = "Falha ao carregar partidas. " + error.message;
    } finally {
      button.disabled = false;
    }
  }

  function renderMatches({ matches, season, round }, savedIds = []) {
    const markers = getSyncedMatchMap();
    const isSynced = id => !!id && (Object.hasOwn(markers, id) || savedIds.includes(id));
    const pending = matches.filter(match => canSync(match) && !isSynced(match.id));
    const list = locate("syncMatchList");
    const status = locate("syncStatus");
    list.replaceChildren();
    status.textContent = `${season} · ${roundLabel(round)} · ${pending.length} de ${matches.length} partida(s) pendente(s).`;
    const items = document.createElement("ul");
    for (const match of matches) {
      const item = document.createElement("li");
      const label = isSynced(match.id) ? "Já sincronizada" : canSync(match) ? "Pendente" : "Indisponível para sincronizar";
      const score = document.createElement("strong");
      score.textContent = `${match.timeA} ${match.scoreA ?? "–"} × ${match.scoreB ?? "–"} ${match.timeB}`;
      const detail = document.createElement("span");
      detail.textContent = `${match.fights?.length || 0} luta(s) · ${label}`;
      item.append(score, detail);
      items.append(item);
    }
    list.append(items);

    const actions = document.createElement("div");
    actions.className = "admin-actions sync-actions";
    if (pending.length) {
      const review = document.createElement("button");
      review.type = "button";
      review.className = "btn-primary";
      review.textContent = "Revisar alterações";
      review.addEventListener("click", () => previewJetLeagueSync(matches, season, round));
      actions.append(review);
    }
    const close = document.createElement("button");
    close.type = "button";
    close.className = "btn-gray";
    close.textContent = "Fechar rodada";
    close.addEventListener("click", () => {
      locate("syncLookup").selection = null;
      list.replaceChildren();
      status.textContent = "";
      locate("syncRound").focus();
    });
    actions.append(close);
    list.append(actions);
  }

  function onSaved(context, agentCount) {
    const form = locate("syncLookup");
    if (!form) return;
    if (form.selection?.season === context.season && form.selection.round === context.round) {
      renderMatches(form.selection, context.matchIds);
    }
    locate("syncStatus").textContent = `${agentCount} agente(s) atualizado(s). ${context.matchIds.length} partida(s) registrada(s).`;
  }

  function init() {
    const form = locate("syncLookup");
    form.catalog = new Map();
    form.addEventListener("submit", event => { event.preventDefault(); void lookup(); });
    locate("syncDiscover").addEventListener("click", discover);
    locate("syncShowArchived").addEventListener("change", updateOptions);
    form.addEventListener("input", event => {
      if (!["syncRound", "syncSeason"].includes(event.target.id)) return;
      form.selection = null;
      locate("syncMatchList").replaceChildren();
      locate("syncStatus").textContent = "";
      if (event.target.id === "syncSeason") {
        event.target.dataset.edited = "true";
        locate("syncCatalogStatus").textContent = "";
        updateOptions();
      }
    });
    updateOptions();
  }

  document.addEventListener("jet:updated", updateOptions);
  document.addEventListener("market:updated", updateOptions);
  window.AdminSync = { init, canSync, onSaved };
})();
