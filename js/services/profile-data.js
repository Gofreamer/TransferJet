/* Edição de perfis e história declarada, independente de transferências e elencos. */
(function () {
  const same = (a,b) => Market.same(a,b);
  const clone = value => JSON.parse(JSON.stringify(value || {}));
  const safeKey = key => typeof key === "string" && key && !/[.#$\[\]/\u0000-\u001f\u007f]/.test(key) && !["__proto__", "constructor", "prototype"].includes(key);
  function requireAdmin() {
    if (!window.isMarketAdmin?.()) throw Error("Entre como administrador para editar.");
  }
  function text(value, max = 4000) {
    if (value != null && typeof value !== "string") throw Error("Texto inválido.");
    const result = String(value || "").trim();
    if (result.length > max) throw Error(`Texto excede ${max} caracteres.`);
    return result;
  }
  function date(value) {
    const result = text(value, 10);
    if (result && (!/^\d{4}-\d{2}-\d{2}$/.test(result) || !Number.isFinite(Date.parse(result)) || new Date(result).toISOString().slice(0,10) !== result)) throw Error("Data inválida. Informe uma data completa ou deixe em branco.");
    return result;
  }
  function image(value) {
    const result = text(value, 2000);
    if (result && !/^https?:\/\//i.test(result)) throw Error("A imagem deve usar uma URL http ou https.");
    if (result) { try { new URL(result); } catch (_) { throw Error("URL de imagem inválida."); } }
    return result;
  }
  function number(value, integer = false) {
    if (value === "" || value == null) return null;
    const result = Number(value);
    if (!Number.isFinite(result) || result < 0 || integer && !Number.isInteger(result)) throw Error("Informe um número não negativo válido.");
    return result;
  }
  const historyFields = ["teamKind", "teamName", "fromCycle", "toCycle", "fromDate", "toDate", "binding", "notes"];
  function historySignature(row) {
    return JSON.stringify([row.teamKind === "free" ? "Livre" : row.teamName || row.club, row.fromCycle || row.fromDate || row.from || "", row.toCycle || row.toDate || row.to || ""].map(Market.normalize));
  }
  function validateHistory(rows, original = {}, playerId) {
    if (!Array.isArray(rows)) throw Error("Histórico inválido.");
    const result = {}, signatures = new Set();
    rows.forEach(row => {
      if (!safeKey(row.id) || result[row.id]) throw Error("Identificador da passagem inválido ou duplicado.");
      const item = { ...(original[row.id] || {}) };
      historyFields.forEach(field => { item[field] = field.endsWith("Date") ? date(row[field]) : text(row[field], field === "notes" ? 4000 : 200); });
      if (!["league", "external", "free"].includes(item.teamKind)) throw Error("Escolha o tipo da equipe.");
      if (item.teamKind === "free") item.teamName = "Livre";
      if (!item.teamName) throw Error("Informe a equipe da passagem.");
      if (item.teamKind === "league" && !Object.hasOwn(AppState.jet.rosters || {}, item.teamName) && original[row.id]?.teamName !== item.teamName) throw Error("Selecione uma equipe da liga ou use equipe externa.");
      if (item.fromDate && item.toDate && item.fromDate > item.toDate) throw Error("A saída não pode ser anterior à entrada.");
      const signature = historySignature(item);
      if (signatures.has(signature)) throw Error("Existe uma passagem equivalente no histórico. Edite a linha existente.");
      signatures.add(signature);
      result[row.id] = { ...item, playerId, source: "manual" };
    });
    return result;
  }
  function contractLabel(p) {
    if (p.contractMode === "none") return "Sem contrato";
    if (p.contractMode === "indefinite") return "Contrato indeterminado";
    if (p.contractMode === "unspecified") return "Prazo não informado";
    return p.contractUntil && p.contractUntil !== "—" ? `Até ${p.contractUntil}` : (p.contractEndDate ? `Até ${p.contractEndDate}` : "Prazo não informado");
  }
  function prepareAgent(key, raw, input) {
    if (!safeKey(key)) throw Error("Identificador inválido.");
    const allowed = ["name", "nationality", "age", "rank", "functionRole", "photo", "status", "contractMode", "contractStart", "contractStartDate", "contractUntil", "contractEndDate", "salary", "releaseClause", "bio", "description", "notes", "titles"];
    const changes = {};
    for (const [field, value] of Object.entries(input)) {
      if (!allowed.includes(field)) throw Error("Campo protegido: " + field);
      let next;
      if (["age", "salary", "releaseClause"].includes(field)) next = number(value, field === "age");
      else if (field === "photo") next = image(value);
      else if (field.endsWith("Date")) next = date(value);
      else if (field === "titles") {
        next = { ...(raw.titles || {}), ...(typeof normalizeTitles === "function" ? normalizeTitles(raw) : {}) };
        for (const [title, count] of Object.entries(value || {})) {
          if (!["nacional", "lji", "mundial", "eventoEspecial"].includes(title)) throw Error("Título inválido.");
          next[title] = number(count, true) ?? 0;
        }
      } else next = text(value);
      if (field === "name" && !next) throw Error("Informe o nome do agente.");
      if (field === "status" && !["ativo", "livre", "emprestado", "lesionado", "suspenso", "aposentado", "fora-liga"].includes(next)) throw Error("Status inválido.");
      if (field === "contractMode" && !["fixed", "indefinite", "none", "unspecified"].includes(next)) throw Error("Tipo de contrato inválido.");
      if (!same(next, raw[field])) changes[field] = next;
    }
    const proposed = { ...raw, ...changes };
    if (("contractStartDate" in changes || "contractEndDate" in changes) && proposed.contractStartDate && proposed.contractEndDate && proposed.contractStartDate > proposed.contractEndDate) throw Error("O vencimento do contrato não pode preceder o início.");
    if ("status" in changes) changes.freeAgent = changes.status === "livre";
    if ("titles" in changes) changes.trophy = Object.values(changes.titles).reduce((sum,n) => sum + (Number(n) || 0), 0);
    return changes;
  }
  async function saveAgent(key, input, expected, historyRows) {
    requireAdmin();
    const changes = prepareAgent(key, expected, input);
    if (historyRows) {
      const history = validateHistory(historyRows, expected.careerHistory, expected.id || "legacy:" + key);
      if (!same(history, expected.careerHistory || {})) changes.careerHistory = history;
    }
    if (!Object.keys(changes).length) return expected;
    return Market.savePlayer(key, changes, { expected, playerId: expected.id || "legacy:" + key, source: "profile-admin", actor: window.getMarketAdminId?.(), season: AppState.jet.currentSeason });
  }
  function careerRows(player, automatic) {
    const rows = automatic.map(row => ({ ...row, teamName: row.club, origins: [row.to === "Atual" && /não registrado|Sem início/.test(row.from) ? "current" : "official"] }));
    Object.entries(player.careerHistory || {}).forEach(([id, entry]) => {
      const manual = { ...entry, id, club: entry.teamName, from: entry.fromCycle || entry.fromDate || "Não informado", to: entry.toCycle || entry.toDate || "Não informado", origins: ["manual"] };
      const equivalent = rows.find(row => historySignature(row) === historySignature(entry));
      if (equivalent) { Object.assign(equivalent, { ...entry, id, origins: [...equivalent.origins, "manual"] }); }
      else rows.push(manual);
    });
    return rows;
  }
  function prepareExit(key, player, destination, kind, note, rosterName) {
    if (!safeKey(key) || !["external", "free"].includes(kind)) throw Error("Saída inválida.");
    const team = kind === "free" ? "Livre" : text(destination, 200);
    if (!team || kind === "external" && Object.hasOwn(AppState.jet.rosters || {}, team)) throw Error("Informe uma equipe externa. Transferências internas usam o fluxo de mercado.");
    return { team, status: kind === "free" ? "livre" : "fora-liga", freeAgent: kind === "free", name: player.name,
      leagueExit: { from: player.club, destination: team, playerId: player.id, rosterName: rosterName || null, note: text(note), at: Date.now() } };
  }
  async function saveExit(key, player, destination, kind, note, expected, rosterName) {
    requireAdmin();
    const currentView = getAllPlayersFlat().find(p => p.key === key);
    if (!currentView || currentView.id !== player.id || currentView.club !== player.club) throw Error("O vínculo atual mudou. Reabra o editor antes de registrar a saída.");
    const changes = prepareExit(key, player, destination, kind, note, rosterName);
    const protectedExpected = { ...expected, team: expected.team, status: expected.status, name: expected.name };
    return Market.savePlayer(key, changes, { expected: protectedExpected, playerId: player.id, source: "explicit-league-exit", actor: window.getMarketAdminId?.(), season: AppState.jet.currentSeason });
  }
  async function syncExit(key) {
    requireAdmin();
    if (!safeKey(key)) throw Error("Identificador inválido.");
    const record = (await marketDb.ref("players/" + key).once("value")).val();
    const exit = record?.leagueExit;
    if (!exit || !["livre", "fora-liga"].includes(record.status) || record.team !== exit.destination || !exit.rosterName) throw Error("A saída atual não pode ser identificada com segurança na liga.");
    const ref = jetDb.ref("liga/rosters");
    await ref.once("value");
    const result = await ref.transaction(current => {
      if (!current || !Array.isArray(current[exit.from])) return;
      const candidates = current[exit.from].filter(p => p.id || p.playerId ? (p.id || p.playerId) === exit.playerId : p.n === exit.rosterName);
      if (candidates.length !== 1) return;
      return { ...current, [exit.from]: current[exit.from].filter(p => p !== candidates[0]) };
    }, undefined, false);
    if (!result.committed) throw Error("Origem ausente ou ambígua. Nenhum elenco foi alterado.");
  }
  function clubKey(name) { return "club_" + Array.from(name).map(c => c.codePointAt(0).toString(16)).join("-"); }
  function clubProfile(name) { return AppState.market.settings?.clubProfiles?.[clubKey(name)] || {}; }
  function prepareClub(raw, input) {
    const allowed = ["crest", "cover", "founded", "description", "bestEra", "rivalries", "legends", "highlights", "titles", "placements", "formerMembers"];
    const changes = {};
    Object.entries(input).forEach(([field,value]) => {
      if (!allowed.includes(field)) throw Error("Campo institucional protegido: " + field);
      let next;
      if (["crest","cover"].includes(field)) next = image(value);
      else if (field === "titles") {
        next = { ...(raw.titles || {}) };
        Object.entries(value).forEach(([key,count]) => {
          if (!["nacional","lji","mundial","eventoEspecial"].includes(key)) throw Error("Título inválido.");
          next[key] = number(count,true) ?? 0;
        });
      } else if (["placements","formerMembers"].includes(field)) {
        if (!Array.isArray(value)) throw Error("Lista institucional inválida.");
        next = {}; const signatures = new Set();
        const fields = field === "placements" ? ["competition","cycle","place","notes"] : ["name","fromCycle","toCycle","fromDate","toDate","notes"];
        value.forEach(row => {
          if (!safeKey(row.id) || next[row.id]) throw Error("Identificador de linha inválido.");
          const item = { ...(raw[field]?.[row.id] || {}) };
          fields.forEach(key => { item[key] = key.endsWith("Date") ? date(row[key]) : text(row[key]); });
          if (field === "placements" && !item.competition || field === "formerMembers" && !item.name) throw Error("Preencha a competição ou o nome do ex-membro.");
          if (item.fromDate && item.toDate && item.fromDate > item.toDate) throw Error("Período do ex-membro inválido.");
          const signature = JSON.stringify(fields.filter(key => key !== "notes").map(key => Market.normalize(item[key])));
          if (signatures.has(signature)) throw Error("Existe uma linha institucional equivalente.");
          signatures.add(signature); next[row.id] = { ...item, source: "manual" };
        });
      } else next = text(value);
      if (!same(next,raw[field])) changes[field] = next;
    });
    return changes;
  }
  async function saveClub(name, input, expected) {
    requireAdmin();
    if (!Object.hasOwn(AppState.jet.rosters || {},name)) throw Error("O perfil institucional deve pertencer a uma equipe cadastrada na liga.");
    const changes = prepareClub(expected,input);
    if (!Object.keys(changes).length) return expected;
    const ref = marketDb.ref("settings/clubProfiles/" + clubKey(name));
    await ref.once("value");
    const eventId = ref.push().key;
    let failure;
    const result = await ref.transaction(value => {
      const current = value || {};
      try {
        const delta = {};
        Object.entries(changes).forEach(([field,after]) => {
          if (!same(expected[field],current[field])) throw Error("A equipe foi alterada em outra sessão. Reabra o editor.");
          delta[field] = { before: current[field] ?? null, after };
        });
        return { ...current, ...changes, leagueName:name, changeLog:{ ...(current.changeLog || {}), [eventId]:{ at:Date.now(),source:"club-profile-admin",actor:window.getMarketAdminId?.() || null,changes:delta } } };
      } catch (error) { failure=error; return; }
    },undefined,false);
    if (!result.committed) throw failure || Error("Não foi possível confirmar a gravação institucional.");
    return result.snapshot.val();
  }
  window.ProfileData = { requireAdmin, text, date, image, number, safeKey, clone, validateHistory, historySignature, contractLabel, prepareAgent, saveAgent, careerRows, prepareExit, saveExit, syncExit, clubKey, clubProfile, prepareClub, saveClub };
})();
