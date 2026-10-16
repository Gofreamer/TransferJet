/* Apresentação do legado: somente leitura dos registros institucionais existentes. */
(function () {
  const e = value => escapeHTML(value ?? "");
  const orders = new Map();
  const titleTypes = { nacional:["Nacional","🥇"], lji:["L.J.I","🥈"], mundial:["Mundial","🏆"], eventoEspecial:["Evento Especial","🏅"] };
  const validImage = value => /^https?:\/\//i.test(String(value || ""));
  const populated = row => row && Object.values(row).some(value => typeof value === "string" && value.trim());
  const rows = value => Object.values(value || {}).filter(populated);
  const initials = name => String(name).trim().split(/\s+/).map(word=>Array.from(word)[0]).slice(0,2).join("");
  const totalTitles = p => Object.keys(titleTypes).reduce((sum,key)=>sum+(Number.isFinite(Number(p.titles?.[key])) ? Math.max(0,Number(p.titles[key])) : 0),0);
  function medal(place) {
    const text = Market.normalize(String(place || ""));
    if (/^(?:campea[oã]?|campeao|1[º°o]?(?:\s*(?:lugar|colocado))?)$/.test(text)) return "gold";
    if (/^(?:vice(?:[- ]campea[oã]?)?|2[º°o]?(?:\s*(?:lugar|colocado))?)$/.test(text)) return "silver";
    if (/^3[º°o]?(?:\s*(?:lugar|colocado))?$/.test(text)) return "bronze";
    return "";
  }
  function personEntries(value) {
    if (typeof value === "string") return value.split(/\r?\n/).map(name=>({name:name.trim()})).filter(row=>row.name);
    return Object.values(value || {}).map(row=>typeof row === "string" ? {name:row} : row).filter(row=>row?.name);
  }
  function resolvePerson(row, players) {
    const candidates = row.playerId ? players.filter(p=>p.id===row.playerId) : row.playerKey ? players.filter(p=>p.key===row.playerKey) : players.filter(p=>Market.normalize(p.name)===Market.normalize(row.name));
    return candidates.length === 1 ? candidates[0] : null;
  }
  function portrait(row, person) {
    return `<span class="legacy-portrait"><span>${e(initials(row.name))}</span>${person && validImage(person.photo) ? `<img src="${e(person.photo)}" alt="${e(person.name)}" loading="lazy" onerror="this.hidden=true">` : ""}</span>`;
  }
  function personName(row, person) {
    return person ? `<button class="text-button" data-premium-player="${e(person.key)}">${e(row.name)} ↗</button>` : `<strong>${e(row.name)}</strong>`;
  }
  function header(name, agentCount) {
    const p = ProfileData.clubProfile(name), titles=totalTitles(p), campaigns=rows(p.placements);
    const champion = titles > 0;
    return `<header class="legacy-hero ${champion ? "legacy-champion" : ""}">${validImage(p.cover) ? `<img class="legacy-cover" src="${e(p.cover)}" alt="Capa de ${e(name)}" onerror="this.hidden=true">` : ""}<div class="legacy-hero-content"><div class="legacy-brand"><div class="legacy-shield"><span>${e(initials(name))}</span>${validImage(p.crest) ? `<img src="${e(p.crest)}" alt="Brasão de ${e(name)}" onerror="this.hidden=true">` : ""}</div><div class="legacy-brand-name"><span class="eyebrow">JET LEAGUE · ORGANIZAÇÃO</span><h1>${e(name)}</h1><div class="legacy-tags">${p.founded ? `<span>Fundação · ${e(p.founded)}</span>` : ""}${champion ? '<span class="legacy-champion-tag">🏆 Legado campeão</span>' : ""}</div></div>${window.isMarketAdmin?.() && Object.hasOwn(AppState.jet.rosters || {},name) ? `<button class="btn-primary btn-sm" id="editClubProfile" onclick="ProfileEditor.openClub('${escapeInlineJsSingle(name)}')">Editar equipe</button>` : ""}</div>${p.description ? `<p class="legacy-intro">${e(p.description)}</p>` : ""}<div class="legacy-metrics">${titles ? `<div><strong>${e(titles)}</strong><span>Títulos registrados</span></div>` : ""}${campaigns.length ? `<div><strong>${campaigns.length}</strong><span>Campanhas na história</span></div>` : ""}<div><strong>${agentCount}</strong><span>Agentes no elenco atual</span></div></div></div></header>`;
  }
  function trophyGallery(p) {
    const known = Object.entries(titleTypes).filter(([key])=>p.titles?.[key]!=null);
    if (!known.length) return "";
    return `<section class="legacy-panel legacy-wide legacy-trophies"><div class="legacy-section-title"><span class="eyebrow">A SALA DE TROFÉUS</span><h2>Conquistas da organização</h2></div><div class="legacy-trophy-grid">${known.map(([key,[name,icon]])=>{
      const count=p.titles[key];
      const cycles=[...new Set(sortedCampaigns(p.placements).filter(row=>medal(row.place || row.result)==="gold" && Market.normalize(row.competition).replace(/[^a-z0-9]/g,"")===Market.normalize(name).replace(/[^a-z0-9]/g,"")).map(row=>row.cycle).filter(Boolean))];
      return `<article class="legacy-trophy ${Number(count)>0 ? "is-winner" : ""}"><span class="legacy-trophy-icon" aria-hidden="true">${icon}</span><div><span class="eyebrow">${name}</span><strong>${e(count)}</strong><span class="legacy-trophy-caption">${Number(count)===1 ? "conquista registrada" : "conquistas registradas"}</span></div>${cycles.length ? `<p>Campanhas vencedoras registradas<br><b>${cycles.map(e).join(" · ")}</b></p>` : '<p>Temporadas dos títulos não registradas</p>'}</article>`;
    }).join("")}</div></section>`;
  }
  function sortedCampaigns(placements, order="asc") {
    const dated = rows(placements).filter(row=>row.cycle || row.date).sort((a,b)=>String(a.cycle || a.date).localeCompare(String(b.cycle || b.date),"pt-BR",{numeric:true,sensitivity:"base"}));
    if (order === "desc") dated.reverse();
    return [...dated,...rows(placements).filter(row=>!row.cycle && !row.date)];
  }
  function campaignCards(p, order) {
    return sortedCampaigns(p.placements,order).map(row=>{
      const award=medal(row.place || row.result);
      const result=row.result || ({gold:"Campeão",silver:"Vice-campeão",bronze:"Terceiro lugar"})[award];
      return `<li class="legacy-campaign ${award ? "podium-"+award : ""}"><div class="legacy-cycle">${e(row.cycle || "Temporada não registrada")}${row.date ? `<small>${e(row.date)}</small>` : ""}</div><div class="legacy-campaign-main"><span class="legacy-placement">${award ? ({gold:"🥇",silver:"🥈",bronze:"🥉"})[award] : "↗"} ${e(row.place || "Colocação não registrada")}</span><h3>${e(row.competition || "Competição não registrada")}</h3>${result ? `<span class="legacy-result">${e(result)}</span>` : ""}${row.notes ? `<p>${e(row.notes)}</p>` : ""}</div></li>`;
    }).join("");
  }
  function timeline(name,p) {
    if (!rows(p.placements).length) return "";
    const order=orders.get(name) || "asc";
    return `<section class="legacy-panel legacy-campaigns"><div class="legacy-section-title"><span class="eyebrow">CADA CICLO, UM CAPÍTULO</span><h2>Trajetória competitiva</h2><label class="legacy-sort">Ordem do histórico<select data-legacy-order="${e(name)}"><option value="asc" ${order==="asc" ? "selected" : ""}>Mais antigo primeiro</option><option value="desc" ${order==="desc" ? "selected" : ""}>Mais recente primeiro</option></select></label></div><ol class="legacy-timeline">${campaignCards(p,order)}</ol></section>`;
  }
  function identity(p) {
    const blocks=[["✦","Melhor fase histórica",p.bestEra],["⚡","Rivalidades",p.rivalries],["◈","Fundação",p.founded]] .filter(([, ,value])=>value);
    return blocks.length ? `<section class="legacy-panel legacy-identity"><div class="legacy-section-title"><span class="eyebrow">DNA DA ORGANIZAÇÃO</span><h2>Identidade & rivalidade</h2></div><div class="legacy-fact-grid">${blocks.map(([icon,label,value])=>`<article class="legacy-fact"><span aria-hidden="true">${icon}</span><div><h3>${label}</h3><p>${e(value)}</p></div></article>`).join("")}</div></section>` : "";
  }
  function people(p,players) {
    const groups=[["legends","Ídolos da organização",personEntries(p.legends)],["highlights","Destaques históricos",personEntries(p.highlights)]].filter(([, ,entries])=>entries.length);
    return groups.map(([type,title,entries])=>`<section class="legacy-panel legacy-wide legacy-people ${type}"><div class="legacy-section-title"><span class="eyebrow">QUEM MARCOU A HISTÓRIA</span><h2>${title}</h2></div><div class="legacy-person-grid">${entries.map(row=>{
      const person=resolvePerson(row,players);
      return `<article class="legacy-person">${portrait(row,person)}<div><span class="eyebrow">${type==="legends" ? "ÍDOLO" : "DESTAQUE"}</span>${personName(row,person)}${row.notes ? `<p>${e(row.notes)}</p>` : ""}</div></article>`;
    }).join("")}</div></section>`).join("");
  }
  function formerMembers(p,players) {
    const members=rows(p.formerMembers);
    if (!members.length) return "";
    return `<section class="legacy-panel legacy-wide legacy-former"><div class="legacy-section-title"><span class="eyebrow">PARTE DO NOSSO CAMINHO</span><h2>Ex-integrantes</h2></div><div class="legacy-person-grid">${members.map(row=>{
      const person=resolvePerson(row,players);
      const start=[row.fromCycle,row.fromDate].filter(Boolean).join(" · ") || "Entrada não registrada";
      const end=[row.toCycle,row.toDate].filter(Boolean).join(" · ") || "Saída não registrada";
      return `<article class="legacy-person legacy-former-person">${portrait(row,person)}<div>${personName(row,person)}<p class="legacy-member-period">${e(start)} → ${e(end)}</p>${row.teamName || row.team || row.binding ? `<p>${e([row.teamName || row.team,row.binding].filter(Boolean).join(" · "))}</p>` : ""}${row.notes ? `<p>${e(row.notes)}</p>` : ""}</div></article>`;
    }).join("")}</div></section>`;
  }
  function body(name) {
    const p=ProfileData.clubProfile(name), players=getAllPlayersFlat();
    const campaigns=timeline(name,p), memory=identity(p)+people(p,players);
    const story=campaigns || memory ? `<div class="legacy-story-grid">${campaigns}${memory ? `<div class="legacy-memory-stack">${memory}</div>` : ""}</div>` : "";
    const content=trophyGallery(p)+story+formerMembers(p,players);
    return `<div class="club-institution legacy-grid">${content}</div>`;
  }
  document.addEventListener("change",event=>{
    const name=event.target.dataset?.legacyOrder;
    if (name===undefined) return;
    const order=event.target.value==="desc" ? "desc" : "asc";
    orders.set(name,order);
    event.target.closest('.legacy-campaigns').querySelector('.legacy-timeline').innerHTML=campaignCards(ProfileData.clubProfile(name),order);
  });
  window.ClubLegacy={header,body,medal,personEntries,resolvePerson,sortedCampaigns};
  ProfileViews.club=body;
})();
