(function () {
  const e = value => escapeHTML(value);
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
  function club(name) {
    const p = ProfileData.clubProfile(name);
    if (!Object.keys(p).length) return `<section class="section club-institution"><h2 class="section-h">História institucional</h2><p class="market-note">Nenhuma informação institucional cadastrada.</p></section>`;
    const safeImage = url => /^https?:\/\//i.test(String(url || ""));
    const titleNames = {nacional:"Nacional",lji:"L.J.I",mundial:"Mundial",eventoEspecial:"Evento Especial"};
    const textBlocks = [["Descrição",p.description],["Melhor fase histórica",p.bestEra],["Rivalidades",p.rivalries],["Ídolos históricos",p.legends],["Destaques históricos",p.highlights]].filter(([,value])=>value);
    const placements = Object.values(p.placements || {});
    const former = Object.values(p.formerMembers || {});
    return `<section class="section club-institution">${safeImage(p.cover) ? `<img class="club-cover" src="${e(p.cover)}" alt="Capa de ${e(name)}" onerror="this.hidden=true">` : ""}<div class="club-institution-heading">${safeImage(p.crest) ? `<img class="club-crest" src="${e(p.crest)}" alt="Brasão de ${e(name)}" onerror="this.hidden=true">` : ""}<div><span class="eyebrow">INFORMAÇÕES CADASTRADAS MANUALMENTE</span><h2 class="section-h">História de ${e(name)}</h2>${p.founded ? `<p>Fundação: ${e(p.founded)}</p>` : ""}</div></div>
      ${p.titles ? `<div class="club-title-counts">${Object.entries(titleNames).filter(([key])=>p.titles[key]!=null).map(([key,label])=>`<div><span>${label}</span><strong>${e(p.titles[key])}</strong></div>`).join("")}</div>` : ""}
      <div class="club-facts">${textBlocks.map(([label,value])=>`<article><h3>${label}</h3><p>${e(value)}</p></article>`).join("")}</div>
      ${placements.length ? `<h3>Colocações registradas</h3><div class="table-wrap"><table><thead><tr><th>Competição</th><th>Ciclo</th><th>Colocação</th><th>Observações</th></tr></thead><tbody>${placements.map(row=>`<tr><td>${e(row.competition)}</td><td>${e(row.cycle || "Não informado")}</td><td>${e(row.place || "Não informada")}</td><td>${e(row.notes || "—")}</td></tr>`).join("")}</tbody></table></div>` : ""}
      ${former.length ? `<h3>Ex-membros · cadastro manual</h3><div class="table-wrap"><table><thead><tr><th>Nome</th><th>Período informado</th><th>Observações</th></tr></thead><tbody>${former.map(row=>`<tr><td>${e(row.name)}</td><td>${e(row.fromCycle || row.fromDate || "Não informado")} → ${e(row.toCycle || row.toDate || "Não informado")}${row.fromCycle && row.fromDate || row.toCycle && row.toDate ? `<small>${e(row.fromDate || "Não informado")} → ${e(row.toDate || "Não informado")}</small>` : ""}</td><td>${e(row.notes || "—")}</td></tr>`).join("")}</tbody></table></div>` : ""}
      ${p.changeLog ? `<details class="club-profile-audit"><summary>Registro das alterações institucionais</summary><ul>${Object.values(p.changeLog).sort((a,b)=>b.at-a.at).slice(0,15).map(log=>`<li>${e(new Date(log.at).toLocaleString("pt-BR"))} · ${e(log.actor || "Admin")} · ${Object.keys(log.changes || {}).length} campo(s) alterado(s)</li>`).join("")}</ul></details>` : ""}</section>`;
  }
  const unknown = value => value || "informação não registrada";
  function achievementCards(entries) {
    const icons = { nacional:"🥇",lji:"🥈",mundial:"🏆",eventoEspecial:"🏅",individual:"⭐" };
    return `<div class="glory-timeline">${entries.map(({row,player})=>`<article class="glory-card"><span class="glory-icon" aria-hidden="true">${icons[row.type] || "🏆"}</span><div><span class="eyebrow">${e(ProfileData.achievementTypes[row.type] || "Conquista")}</span><h3>${e(unknown(row.competitionName))}</h3><p class="glory-result">${e(unknown(row.result))}</p>${player ? `<p>Agente: <button class="text-button" data-premium-player="${e(player.key)}">${e(player.name)} ↗</button></p>` : ""}<dl><div><dt>Equipe representada</dt><dd>${row.teamName ? clubName(row.teamName,row.teamKind) : unknown("")}</dd></div><div><dt>Ciclo / temporada</dt><dd>${e(unknown(row.season))}</dd></div><div><dt>Data</dt><dd>${e(unknown(row.date))}</dd></div></dl>${row.notes ? `<p class="glory-notes">${e(row.notes)}</p>` : ""}<small>${row.legacySlot ? `Detalha título antigo #${e(row.legacySlot)} · não soma ao contador` : row.type==="individual" ? "Prêmio individual · não conta como título coletivo" : "Registro detalhado · não soma automaticamente aos contadores"}${row.officialId ? ` · Campeonato vinculado: ${e(row.officialId)}` : " · Cadastro manual"}</small></div></article>`).join("")}</div>`;
  }
  function achievements(p) {
    const entries = Object.values(p.achievements || {}).map(row=>({row}));
    const linked = {};
    entries.forEach(({row})=>{if(row.legacySlot && row.type!=="individual") (linked[row.type] ||= new Set()).add(row.legacySlot);});
    return `<section class="section agent-glory"><div class="glory-heading"><h2 class="section-h">Histórico das conquistas</h2>${window.isMarketAdmin?.() ? `<button class="btn-primary btn-sm" id="manageAchievements" onclick="ProfileEditor.openAgent('${escapeInlineJsSingle(p.key)}','glory')">Gerenciar conquistas</button>` : ""}</div><p class="market-note">Os troféus acima preservam os contadores existentes. Detalhar uma conquista não aumenta esses totais.</p><div class="glory-coverage">${Object.entries(ProfileData.achievementTypes).filter(([key])=>key!=="individual" && p.titles?.[key]>0).map(([key,label])=>`<p>${label}: ${linked[key]?.size || 0} de ${e(p.titles[key])} título(s) com detalhes associados.${p.titles[key]>(linked[key]?.size || 0) ? " Demais títulos: informação não registrada." : ""}</p>`).join("")}</div>${entries.length ? achievementCards(entries) : '<p class="empty-state">Conquistas detalhadas: informação não registrada.</p>'}</section>`;
  }
  function clubAchievements(name) {
    const entries = [];
    getAllPlayersFlat().forEach(player=>Object.values(player.achievements || {}).forEach(row=>{
      if (row.playerId === player.id && row.teamKind === "league" && row.teamName === name && row.teamKey === ProfileData.clubKey(name)) entries.push({row,player});
    }));
    return entries.length ? `<section class="section club-agent-glory"><h2 class="section-h">Conquistas históricas dos agentes</h2><p class="market-note">Participações individuais pela equipe. Não alteram o quadro de títulos institucionais nem o elenco atual.</p>${achievementCards(entries)}</section>` : "";
  }
  window.ProfileViews = { contract, career, clubName, club, achievements, clubAchievements };
})();
