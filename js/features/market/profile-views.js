(function () {
  const e = value => escapeHTML(value);
  const expandedClubAchievements = new Set();
  function clubName(name, kind) {
    return kind !== "external" && kind !== "free" && Object.hasOwn(AppState.jet.rosters || {}, name)
      ? `<button class="text-button" data-premium-club="${e(name)}">${e(name)} ↗</button>` : `<strong>${e(name)}</strong>`;
  }
  function contract(p) {
    const term = !["none", "indefinite", "unspecified"].includes(p.contractMode);
    const fields = [
      ["Situação", ProfileData.contractLabel(p)],
      ["Início informado", [p.contractStart, p.contractStartDate].filter(Boolean).join(" · ") || "Não informado"],
      ["Ciclo / temporada final", !term ? "Não se aplica ao tipo de contrato" : p.contractUntil === "—" ? "Não informado" : p.contractUntil],
      ["Data final informada", !term ? "Não se aplica ao tipo de contrato" : p.contractEndDate || "Não informada"]
    ];
    return `<section class="contract-summary section"><div><span class="eyebrow">VÍNCULO CONTRATUAL</span><h2 class="section-h">${e(ProfileData.contractLabel(p))}</h2></div><dl>${fields.map(([label,value]) => `<div><dt>${e(label)}</dt><dd>${e(value)}</dd></div>`).join("")}</dl>${p.bio || p.description || p.notes ? `<div class="profile-notes">${[p.bio, p.description, p.notes].filter(Boolean).map(note => `<p>${e(note)}</p>`).join("")}</div>` : ""}</section>`;
  }
  function career(p, automatic) {
    const rows = ProfileData.careerRows(p, automatic);
    const labels = { manual: "Cadastrado manualmente", official: "Transferência oficial", current: "Equipe atual" };
    return `<p class="affiliation-now">Equipe atual: ${clubName(p.club, p.status === "fora-liga" ? "external" : p.freeAgent ? "free" : "league")}</p><div class="table-wrap"><table class="career-table"><thead><tr><th>Equipe</th><th>Período informado</th><th>Vínculo</th><th>Origem do registro</th><th>Observações</th><th>Taxa oficial</th></tr></thead><tbody>${rows.map(row => `<tr><td>${clubName(row.teamName || row.club, row.teamKind)}</td><td>${e(row.from)} → ${e(row.to)}${row.fromCycle && row.fromDate || row.toCycle && row.toDate ? `<small>${e(row.fromDate || "Não informado")} → ${e(row.toDate || "Não informado")}</small>` : ""}</td><td>${e(row.binding || row.type || "Não informado")}</td><td>${[...new Set(row.origins)].map(origin => `<span class="history-source ${origin}">${labels[origin]}</span>`).join("")}</td><td>${e(row.notes || "—")}</td><td>${row.fee != null && row.origins.includes("official") ? formatUSD(row.fee, true) : "—"}</td></tr>`).join("")}</tbody></table></div>`;
  }
  const unknown = value => value || "informação não registrada";
  function achievementCards(entries, staff = false) {
    const icons = { nacional:"🥇",lji:"🥈",mundial:"🏆",eventoEspecial:"🏅",individual:"⭐" };
    return `<div class="glory-timeline">${entries.map(({row,player})=>`<article class="glory-card"><span class="glory-icon" aria-hidden="true">${icons[row.type] || "🏆"}</span><div><span class="eyebrow">${e(ProfileData.achievementTypes[row.type] || "Conquista")}</span><h3>${e(unknown(row.competitionName))}</h3><p class="glory-result">${e(unknown(row.result))}</p>${player ? `<p>Agente: <button class="text-button" data-premium-player="${e(player.key)}">${e(player.name)} ↗</button></p>` : ""}<dl><div><dt>Equipe representada</dt><dd>${row.teamName ? clubName(row.teamName,row.teamKind) : unknown("")}</dd></div><div><dt>Ciclo / temporada</dt><dd>${e(unknown(row.season))}</dd></div><div><dt>Data</dt><dd>${e(unknown(row.date))}</dd></div></dl>${row.notes ? `<p class="glory-notes">${e(row.notes)}</p>` : ""}<small>${staff ? "Conquista como manager / coach" : row.type==='individual' ? "Prêmio individual" : "Conquista coletiva"}${row.officialId ? " · Campeonato registrado" : ""}</small></div></article>`).join("")}</div>`;
  }
  function achievements(p) {
    const entries = Object.values(p.achievements || {}).map(row=>({row}));
    const linked = {};
    entries.forEach(({row})=>{if(row.legacySlot && row.type!=="individual") (linked[row.type] ||= new Set()).add(row.legacySlot);});
    return `<section class="section agent-glory"><div class="glory-heading"><h2 class="section-h">Histórico das conquistas</h2>${window.isMarketAdmin?.() ? `<button class="btn-primary btn-sm" id="manageAchievements" onclick="ProfileEditor.openAgent('${escapeInlineJsSingle(p.key)}','glory')">Gerenciar conquistas</button>` : ""}</div><div class="glory-coverage">${Object.entries(ProfileData.achievementTypes).filter(([key])=>key!=="individual" && p.titles?.[key]>0).map(([key,label])=>`<p>${label}: ${linked[key]?.size || 0} de ${e(p.titles[key])} título(s) com detalhes históricos.${p.titles[key]>(linked[key]?.size || 0) ? " Demais títulos: informação não registrada." : ""}</p>`).join("")}</div>${entries.length ? achievementCards(entries) : '<p class="empty-state">Conquistas detalhadas: informação não registrada.</p>'}</section>`;
  }
  function clubAchievements(name) {
    const visible=document.querySelector?.('details[data-club-achievements]');
    if(visible?.dataset.clubAchievements===name) {
      if(visible.open)expandedClubAchievements.add(name);
      else expandedClubAchievements.delete(name);
    }
    const entries = [];
    getAllPlayersFlat().forEach(player=>Object.values(player.achievements || {}).forEach(row=>{
      if (row.playerId === player.id && row.teamKind === "league" && row.teamName === name && row.teamKey === ProfileData.clubKey(name)) entries.push({row,player});
    }));
    return entries.length ? `<details class="section club-agent-glory history-disclosure" data-club-achievements="${e(name)}"${expandedClubAchievements.has(name)?' open':''}><summary class="history-disclosure-summary"><h2>Conquistas históricas dos agentes</h2></summary><div class="history-disclosure-content"><p class="market-note">Participações individuais pela equipe. Não alteram o quadro de títulos institucionais nem o elenco atual.</p>${achievementCards(entries)}</div></details>` : "";
  }
  document.addEventListener('toggle',event=>{
    const el=event.target;
    if(!el.isConnected || !el.matches?.('details[data-club-achievements]'))return;
    if(el.open)expandedClubAchievements.add(el.dataset.clubAchievements);
    else expandedClubAchievements.delete(el.dataset.clubAchievements);
  },true);
  window.ProfileViews = { contract, career, clubName, achievements, clubAchievements, achievementCards };
})();
