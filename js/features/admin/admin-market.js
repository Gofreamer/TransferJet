/* Edição de mercado com revisão, transação e registro de valor real. */
(function () {
  function draftRow(btn) {
    const row = btn.closest("tr");
    const key = row.dataset.key;
    const changes = {};
    row.querySelectorAll(".admin-input:not(.admin-title)").forEach(input => {
      if (!input.dataset.field || input.dataset.original === input.value) return;
      const field = input.dataset.field;
      const raw = input.value.trim();
      changes[field] = ["marketValue", "peakValue", "salary", "releaseClause", "age"].includes(field) ? (raw === "" ? null : Number(raw)) : raw;
    });
    const titles = row.querySelectorAll(".admin-title");
    if ([...titles].some(input => input.dataset.original !== input.value)) {
      changes.titles = {};
      titles.forEach(input => {
        const count = Number(input.value);
        if (!Number.isInteger(count) || count < 0) throw Error("Títulos devem ser números inteiros positivos ou zero.");
        changes.titles[input.dataset.title] = count;
      });
      changes.trophy = Object.values(changes.titles).reduce((total, n) => total + n, 0);
    }
    if ("status" in changes) changes.freeAgent = changes.status === "livre";
    const expected = row._marketExpected || window.AppState.market.players[key] || {};
    return { key, changes, expected };
  }

  async function saveRow(btn, draft) {
    if (btn.disabled) return;
    btn.disabled = true;
    try {
      draft = draft || draftRow(btn);
      const record = await Market.savePlayer(draft.key, draft.changes, {
        expected: draft.expected, season: window.AppState.jet.currentSeason,
        round: window.AppState.market.settings.statsRound || null, source: "admin"
      });
      const row = btn.closest("tr");
      row._marketExpected = JSON.parse(JSON.stringify(record || {}));
      row.dataset.status = record.status || "ativo";
      const seasons = [...new Set([...Market.events(record).map(e => e.season), record.statsSeason].filter(Boolean))];
      row.dataset.seasons = JSON.stringify(seasons);
      const select = document.getElementById("adminValueSeason");
      if (select) seasons.forEach(season => {
        if ([...select.options].some(option => option.value === season)) return;
        const option = document.createElement("option"); option.value = season; option.textContent = season; select.appendChild(option);
      });
      row.querySelectorAll(".admin-input").forEach(input => {
        const value = input.dataset.title ? record.titles?.[input.dataset.title] : record[input.dataset.field];
        if (value != null) input.value = value;
        input.dataset.original = input.value;
      });
      btn.textContent = "✓ Salvo";
      setTimeout(() => { btn.textContent = "Revisar"; }, 1500);
      return true;
    } catch (err) {
      alert("Erro ao salvar: " + err.message);
      return false;
    } finally { btn.disabled = false; }
  }

  function reviewRow(btn) {
    try {
      const draft = draftRow(btn);
      const next = Market.createRecord(draft.key, draft.expected, draft.changes, { expected: draft.expected }, "preview");
      const fields = Object.entries(next).filter(([field, value]) => !["id", "valueEvents", "changeLog"].includes(field) && !Market.same(value, draft.expected[field]));
      if (!fields.length) return alert("Nenhuma alteração para salvar.");
      let dialog = document.getElementById("marketEditDialog");
      if (!dialog) { dialog = document.createElement("dialog"); dialog.id = "marketEditDialog"; document.body.appendChild(dialog); }
      const display = value => escapeHTML(value == null ? "—" : typeof value === "object" ? JSON.stringify(value) : value);
      dialog.innerHTML = `<h2 id="marketEditTitle">Revisar alterações</h2><p>Somente os campos abaixo serão alterados. Mudanças de valor geram um registro real.</p><div class="table-wrap"><table><thead><tr><th>Campo</th><th>Antes</th><th>Depois</th></tr></thead><tbody>${fields.map(([field, value]) => `<tr><td>${escapeHTML(field)}</td><td>${display(draft.expected[field])}</td><td>${display(value)}</td></tr>`).join("")}</tbody></table></div><div class="review-actions"><button class="btn-gray" id="marketCancelEdit">Cancelar</button><button class="btn-primary" id="marketConfirmEdit">Confirmar e salvar</button></div>`;
      dialog.setAttribute("aria-labelledby", "marketEditTitle");
      dialog.querySelector("#marketCancelEdit").onclick = () => dialog.close();
      dialog.querySelector("#marketConfirmEdit").onclick = async function () {
        this.disabled = true;
        if (await saveRow(btn, draft)) dialog.close();
        this.disabled = false;
      };
      dialog.showModal();
    } catch (err) { alert(err.message); }
  }

  function importChanges(row, statsOnly, value) {
    const old = row._existing || {};
    if (![row.P, row.V, row.D].every(n => Number.isInteger(n) && n >= 0) || row.V + row.D > row.P) throw Error("Estatísticas inválidas para " + row.name);
    const titles = row.titles || normalizeTitlesAdmin(old);
    const changes = {
      name: row.name, team: row.team, rank: row.rank || old.rank || "—",
      functionRole: row.func || old.functionRole || "", titles,
      trophy: window.VALUATION.totalTitles(titles, row.trophy),
      stats: { P: row.P, V: row.V, D: row.D, winRate: row.wr },
      statsRound: "Import " + new Date().toISOString().slice(0, 10),
      statsSeason: window.AppState.jet.currentSeason || "Sem temporada"
    };
    if (!statsOnly) { changes.marketValue = value; changes.peakValue = Math.max(old.peakValue || 0, row.peak || 0, value); }
    return { key: row.key, changes, expected: old };
  }

  async function applyImport(data, mode, values) {
    const statsOnly = mode === "statsOnly";
    const rows = data.map((row, i) => importChanges(row, statsOnly, values[i] ?? row.newValue));
    await Market.saveBatch(rows, { season: window.AppState.jet.currentSeason, source: "import" });
  }

  async function applySync(data, context, values) {
    const rows = data.map((row, i) => {
      const old = row._existing || {};
      const entry = importChanges(row, context.mode === "statsOnly", values[i] ?? row.newValue);
      entry.changes.statsSeason = context.season;
      entry.changes.statsRound = `Sync Jet · ${context.season} · Rodada ${context.round}`;
      entry.changes.mvpCount = context.ignoreAwards ? Number(old.mvpCount) || 0 : row.mvpCount ?? (Number(old.mvpCount) || 0);
      entry.changes.destaqueCount = context.ignoreAwards ? Number(old.destaqueCount) || 0 : row.destaqueCount ?? (Number(old.destaqueCount) || 0);
      return entry;
    });
    const extra = {};
    (context.matchIds || []).filter(Boolean).forEach(id => { extra["settings/syncedMatches/" + id] = { at: new Date().toISOString(), season: context.season, round: context.round, mode: context.mode }; });
    await Market.saveBatch(rows, { season: context.season, round: context.round, source: "jet-sync" }, extra);
  }

  function renderBackup() {
    document.getElementById("adminTabContent").innerHTML = `<h3 class="admin-section-title">Backup do mercado</h3><p class="market-note">Exporta agentes, transferências, rumores e configurações. O Fantasy pertence a uma etapa separada. A restauração permite inserir um registro ausente por vez, sem sobrescrever dados existentes nem restaurar configurações.</p><button class="btn-primary" onclick="MarketAdmin.exportBackup()">Baixar backup JSON</button><h3 class="admin-section-title">Restaurar registro ausente</h3><label for="marketBackupFile">Selecione um backup do mercado</label><input id="marketBackupFile" type="file" accept="application/json,.json" onchange="MarketAdmin.readBackup(this)"><div id="marketBackupReview"></div>`;
  }
  async function exportBackup() {
    try {
      const data = {};
      for (const collection of ["players", "transfers", "rumors", "settings"]) data[collection] = (await window.marketDb.ref(collection).once("value")).val() || {};
      const backup = { format: "transferjet-market", version: 1, exportedAt: new Date().toISOString(), data };
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = `transferjet-market-${new Date().toISOString().slice(0, 10)}.json`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) { alert("Erro ao exportar: " + err.message); }
  }
  function validateBackup(backup) {
    if (backup?.format !== "transferjet-market" || backup.version !== 1 || !backup.data || typeof backup.data !== "object") throw Error("Arquivo de backup não reconhecido.");
    const choices = [];
    for (const collection of ["players", "transfers", "rumors"]) {
      const records = backup.data[collection] || {};
      if (typeof records !== "object" || Array.isArray(records)) throw Error("Coleção inválida: " + collection);
      Object.entries(records).forEach(([key, record]) => {
        if (!key || /[.#$\[\]/\u0000-\u001f\u007f]/.test(key) || !record || typeof record !== "object" || Array.isArray(record)) throw Error("Registro inválido no backup.");
        if (["__proto__", "constructor", "prototype"].includes(key)) throw Error("Chave de registro inválida.");
        if (collection === "players") {
          if (["marketValue", "peakValue", "salary", "releaseClause", "age"].some(field => record[field] != null && (!Number.isFinite(record[field]) || record[field] < 0))) throw Error("Valor numérico inválido no backup.");
          if (["name", "team", "status", "id"].some(field => record[field] != null && typeof record[field] !== "string")) throw Error("Identificação inválida no backup.");
        }
        choices.push({ collection, key, record });
      });
    }
    return choices;
  }
  async function restoreRecord(choice) {
    validateBackup({ format: "transferjet-market", version: 1, data: { [choice.collection]: { [choice.key]: choice.record } } });
    if (!["players", "transfers", "rumors"].includes(choice.collection)) throw Error("Coleção não permitida para restauração.");
    if (choice.collection === "players") {
      const players = (await window.marketDb.ref("players").once("value")).val() || {};
      if (Market.auditPlayers({ ...players, [choice.key]: choice.record }).length > Market.auditPlayers(players).length) throw Error("A restauração criaria duplicidade de identidade ou de nome/equipe.");
    }
    const ref = window.marketDb.ref(choice.collection + "/" + choice.key);
    await ref.once("value");
    const result = await ref.transaction(current => current === null ? choice.record : undefined, undefined, false);
    if (!result.committed) throw Error("O registro já existe. Nada foi sobrescrito.");
  }
  async function readBackup(input) {
    const container = document.getElementById("marketBackupReview");
    try {
      if (!input.files?.length) return;
      const choices = validateBackup(JSON.parse(await input.files[0].text()));
      container.innerHTML = `<p class="market-note">${choices.length} registros disponíveis. Selecione um, confira o conteúdo e confirme a restauração.</p><select id="marketRestoreChoice" aria-label="Registro do backup"><option value="">Selecione um registro</option>${choices.map((c, i) => `<option value="${i}">${escapeHTML(c.collection + "/" + c.key)}</option>`).join("")}</select><pre id="marketRestorePreview"></pre><button class="btn-primary" id="marketRestoreConfirm" disabled>Restaurar este registro ausente</button><p id="marketRestoreResult" role="status"></p>`;
      const select = container.querySelector("select");
      const button = container.querySelector("button");
      select.onchange = () => { button.disabled = select.value === ""; container.querySelector("pre").textContent = select.value === "" ? "" : JSON.stringify(choices[Number(select.value)].record, null, 2); };
      button.onclick = async () => {
        button.disabled = true;
        try { await restoreRecord(choices[Number(select.value)]); document.getElementById("marketRestoreResult").textContent = "Registro restaurado sem alterar os demais."; }
        catch (err) { document.getElementById("marketRestoreResult").textContent = err.message; }
        finally { button.disabled = false; }
      };
    } catch (err) { container.textContent = err.message; }
  }

  window.MarketAdmin = { draftRow, saveRow, reviewRow, applyImport, applySync, renderBackup, exportBackup, validateBackup, restoreRecord, readBackup };
  window.reviewPlayerRow = reviewRow;
})();
