/* Mercado: registros auditáveis, filtros e compatibilidade com dados antigos. */
(function () {
  const normalize = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const numeric = ["marketValue", "peakValue", "salary", "releaseClause", "age"];
  const safeKey = key => typeof key === "string" && key.trim() && !/[.#$\[\]/\u0000-\u001f\u007f]/.test(key);

  function events(player) {
    return Object.entries(player.valueEvents || {}).filter(([, e]) => e && e.kind === "recorded" && Number.isFinite(e.value) && Number.isFinite(e.at))
      .map(([id, e]) => ({ ...e, eventId: id })).sort((a, b) => a.at - b.at || a.eventId.localeCompare(b.eventId));
  }
  function variation(player) {
    const list = events(player);
    const last = list[list.length - 1];
    if (!last || !Number.isFinite(last.previousValue) || last.value !== player.marketValue) return null;
    const diff = last.value - last.previousValue;
    const result = formatVariation(last.value, last.previousValue) || { diff, pct: null, positive: diff >= 0, text: `${diff >= 0 ? "▲" : "▼"} ${formatUSD(Math.abs(diff), true)}` };
    return { ...result, previousValue: last.previousValue, value: last.value, at: last.at, season: last.season, round: last.round };
  }
  function history(player, { source = "recorded", season = "", round = "" } = {}) {
    const list = source === "legacy"
      ? Object.values(player.valueHistory || {}).filter(e => e && Number.isFinite(Number(e.value))).map(e => ({ ...e, value: Number(e.value), label: e.season || "Sem temporada", kind: "legacy" }))
      : events(player).map(e => ({ ...e, label: [e.season, e.round ? `Rodada ${e.round}` : "", new Date(e.at).toLocaleDateString("pt-BR")].filter(Boolean).join(" · ") }));
    return list.filter(e => (!season || e.season === season) && (!round || String(e.round || "") === String(round)));
  }
  function transferMatches(t, player, players = []) {
    if (t.status !== "oficial") return false;
    if (t.playerId) return t.playerId === player.id;
    if (t.playerKey === player.key) return true;
    // Fallback por nome somente quando não há homônimos nem identidade conhecida conflitante.
    if (t.playerKey && players.some(p => p.key === t.playerKey && p.id !== player.id)) return false;
    return normalize(t.playerName) === normalize(player.name)
      && players.filter(p => normalize(p.name) === normalize(player.name)).length === 1;
  }
  function filter(players, filters = {}) {
    const rank = value => normalize(value).replace(/^rank\s+/, "").replace(/^clandestina$/, "clandestino");
    return players.filter(p => {
      if (filters.search && !normalize(p.name).includes(normalize(filters.search))) return false;
      if (filters.club && p.club !== filters.club) return false;
      if (filters.status === "livre" ? !p.freeAgent && p.status !== "livre" : filters.status && p.status !== filters.status) return false;
      if (filters.rank && rank(p.rank) !== rank(filters.rank)) return false;
      if (filters.role === "livre" ? !p.freeAgent : filters.role && (p.role !== filters.role || p.freeAgent)) return false;
      if (filters.minValue != null && (p.marketValue ?? 0) < filters.minValue) return false;
      if (filters.maxValue != null && (p.marketValue ?? 0) >= filters.maxValue) return false;
      return true;
    });
  }

  function createRecord(key, current, changes, meta, eventId) {
    if (!safeKey(key) || !safeKey(eventId)) throw Error("Identificador inválido.");
    current = current || {};
    if (meta.playerId && (current.id || "legacy:" + key) !== meta.playerId) throw Error("A identidade do agente mudou. Reabra o editor.");
    if (Object.keys(changes).some(field => !safeKey(field) || ["id", "valueHistory", "valueEvents", "changeLog"].includes(field))) throw Error("Campo protegido na edição.");
    numeric.forEach(field => {
      if (changes[field] != null && (!Number.isFinite(changes[field]) || changes[field] < 0)) throw Error("Informe um valor válido para " + field + ".");
    });
    Object.keys(changes).forEach(field => {
      if (meta.expected && !same(meta.expected[field], current[field])) throw Error("O agente foi alterado em outra sessão. Atualize a lista antes de salvar.");
    });
    const next = { ...current, ...changes, id: current.id || "legacy:" + key };
    if (next.marketValue != null && ("marketValue" in changes || "peakValue" in changes)) next.peakValue = Math.max(Number(current.peakValue) || 0, Number(next.peakValue) || 0, next.marketValue);
    const delta = {};
    Object.keys(next).forEach(field => { if (field !== "id" && !same(next[field], current[field])) delta[field] = { before: current[field] ?? null, after: next[field] ?? null }; });
    if (!Object.keys(delta).length) return current;
    const at = meta.at ?? Date.now();
    if (delta.marketValue && next.marketValue != null) {
      next.valueEvents = { ...(current.valueEvents || {}), [eventId]: {
        kind: "recorded", at, season: meta.season || "Sem temporada", round: String(meta.round || "").match(/^(?:Rodada\s*)?(\d+)$/i)?.[1] || null,
        previousValue: current.marketValue ?? null, value: next.marketValue, source: meta.source || "admin", playerId: next.id
      } };
    }
    next.changeLog = { ...(current.changeLog || {}), [eventId]: { at, source: meta.source || "admin", ...(meta.actor ? { actor: meta.actor } : {}), changes: delta } };
    return next;
  }

  async function savePlayer(key, changes, meta = {}) {
    if (!safeKey(key)) throw Error("Identificador inválido.");
    const ref = window.marketDb.ref("players/" + key);
    await ref.once("value");
    const eventId = ref.push().key;
    let failure;
    const result = await ref.transaction(current => {
      try { return createRecord(key, current, changes, meta, eventId); }
      catch (error) { failure = error; return; }
    }, undefined, false);
    if (!result.committed) throw failure || Error("A gravação não foi confirmada. Tente novamente.");
    return result.snapshot.val();
  }

  async function saveBatch(rows, meta = {}, extraUpdates = {}) {
    const snap = await window.marketDb.ref("players").once("value");
    const players = snap.val() || {};
    const updates = { ...extraUpdates };
    const seen = new Set();
    rows.forEach(row => {
      if (seen.has(row.key)) throw Error("Agente duplicado na importação: " + row.key);
      seen.add(row.key);
      const current = players[row.key] || {};
      const eventId = window.marketDb.ref("players/" + row.key).push().key;
      const next = createRecord(row.key, current, row.changes, { ...meta, expected: row.expected }, eventId);
      for (const [field, value] of Object.entries(next)) {
        if (same(current[field], value)) continue;
        if (field === "valueEvents" || field === "changeLog") updates[`players/${row.key}/${field}/${eventId}`] = value[eventId];
        else updates[`players/${row.key}/${field}`] = value;
      }
    });
    if (Object.keys(updates).length) await window.marketDb.ref().update(updates);
  }

  function resolveImportPlayer(players, { id, name, team }) {
    if (id) {
      const matches = players.filter(p => p.id === id || p.key === id);
      if (matches.length !== 1) throw Error("ID não encontrado ou duplicado para " + name);
      return matches[0];
    }
    const exact = players.filter(p => normalize(p.name) === normalize(name) && p.club === team);
    if (exact.length === 1) return exact[0];
    const names = players.filter(p => normalize(p.name) === normalize(name));
    if (names.length > 1) throw Error("Nome ambíguo: " + name + ". Informe a coluna ID para identificar o agente.");
    return names[0] || null;
  }

  function compareWinners(players, metric) {
    const rows = players.map(p => ({ key: p.key, value: metric(p) })).filter(p => typeof p.value === "number" && Number.isFinite(p.value));
    if (!rows.length) return [];
    const best = Math.max(...rows.map(p => p.value));
    return rows.filter(p => p.value === best).map(p => p.key);
  }

  function auditPlayers(players) {
    const identities = new Map(), bindings = new Map(), issues = [];
    for (const [key, player] of Object.entries(players || {})) {
      if (!player) continue;
      const id = player.id || "legacy:" + key;
      const name = player.name || key.split("_").slice(1).join("_");
      const team = player.team || key.split("_")[0];
      if (identities.has(id)) issues.push(`ID duplicado: ${identities.get(id)} e ${key}`);
      identities.set(id, key);
      const binding = JSON.stringify([normalize(team), normalize(name)]);
      if (bindings.has(binding)) issues.push(`Nome e equipe duplicados: ${bindings.get(binding)} e ${key}`);
      bindings.set(binding, key);
    }
    return issues;
  }

  window.Market = { normalize, same, events, variation, history, filter, transferMatches, createRecord, savePlayer, saveBatch, resolveImportPlayer, compareWinners, auditPlayers };
})();
