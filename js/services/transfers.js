/* Uma transferência não muda a chave do agente nem as referências históricas. */
(function () {
  function validKey(value) {
    return typeof value === "string" && value.trim() && !/[.#$\[\]/\u0000-\u001f\u007f]/.test(value);
  }

  function buildTransferUpdates(transfer, id, players, agent) {
    if (!validKey(id) || !validKey(transfer.playerKey)) throw new Error("Identificador inválido.");
    if (!agent || !transfer.from || !transfer.to || transfer.from === transfer.to) throw new Error("Confira o agente, a origem e o destino.");
    if (!Number.isFinite(transfer.fee) || transfer.fee < 0) throw new Error("A taxa deve ser um valor válido, maior ou igual a zero.");
    const record = players[transfer.playerKey] || {};
    const playerId = record.id || agent.id || "legacy:" + transfer.playerKey;
    const updates = { [`transfers/${id}`]: { ...transfer, playerId } };
    if (transfer.status !== "oficial") return updates;
    if (agent.club !== transfer.from) throw new Error("A origem não corresponde à equipe atual do agente. Atualize a lista.");
    if (agent.canTransfer === false || agentStatusEffects(agent.status).canTransfer === false) throw new Error("O status deste agente impede a transferência.");
    const collision = Object.entries(players).some(([key, p]) => key !== transfer.playerKey
      && p && (p.team || key.slice(0, key.indexOf("_"))) === transfer.to
      && (p.name || key.slice(key.indexOf("_") + 1)) === agent.name);
    if (collision) throw new Error("Já existe um agente com esse nome no destino. Confira os registros antes de transferir.");
    // Atualiza somente os campos de vínculo; valores, contratos e históricos permanecem.
    const prefix = `players/${transfer.playerKey}/`;
    Object.assign(updates, {
      [prefix + "id"]: playerId,
      [prefix + "name"]: agent.name,
      [prefix + "role"]: agent.role || "titular",
      [prefix + "team"]: transfer.to,
      [prefix + "freeAgent"]: transfer.to === "Livre",
      [prefix + "status"]: transfer.to === "Livre" ? "livre" : transfer.type === "emprestimo" ? "emprestado" : "ativo"
    });
    return updates;
  }

  async function recordTransfer(transfer, agent) {
    if (transfer.status === "oficial" && !isTransferWindowOpen()) throw new Error("A janela de transferências está fechada.");
    // Leitura por coleção, compatível com as regras atuais (a raiz não é pública).
    const snap = await window.marketDb.ref("players").once("value");
    const players = snap.val() || {};
    const latest = players[transfer.playerKey];
    const currentAgent = latest ? {
      ...agent,
      id: latest.id || agent?.id,
      name: latest.name || agent?.name,
      club: agentStatusEffects(latest.status).clubOverride || latest.team || agent?.club,
      status: latest.status || agent?.status
    } : agent;
    const id = window.marketDb.ref("transfers").push().key;
    const updates = buildTransferUpdates(transfer, id, players, currentAgent);
    await window.marketDb.ref().update(updates);
    return id;
  }

  window.buildTransferUpdates = buildTransferUpdates;
  window.recordTransfer = recordTransfer;
})();
