(function () {
  const e=value=>escapeHTML(value ?? '');
  const expandedTeams=new Set();
  function portrait(p) {return `<span class="staff-portrait"><span>${e(String(p.name || '?').split(/\s+/).slice(0,2).map(name=>Array.from(name)[0]).join(''))}</span>${/^https?:\/\//i.test(p.photo || '') ? `<img src="${e(p.photo)}" alt="${e(p.name)}" loading="lazy" onerror="this.hidden=true">`:''}</span>`;}
  function period(row) {return `${[row.fromCycle || row.startCycle,row.fromDate || row.startDate].filter(Boolean).join(' · ') || 'Entrada não registrada'} → ${[row.toCycle || row.endCycle,row.toDate || row.endDate].filter(Boolean).join(' · ') || 'Saída não registrada'}`;}
  function card(id,row,past) {
    const p=StaffData.identity(row);
    return `<article class="staff-card ${!past && row.principal?'staff-principal':''}">${portrait(p)}<div><span class="eyebrow">${past ? 'HISTÓRICO DA COMISSÃO' : row.principal ? 'RESPONSÁVEL PRINCIPAL' : 'COMISSÃO TÉCNICA'}</span><h3>${e(p.name)}</h3><p>${e(past?.binding || row.role)}${row.kind==='linked' && row.competitive!==false?' · Também combatente':''}</p>${past ? `<small>${e(period(past))}</small>`:''}<button class="text-button" data-staff-view="${e(id)}">Ver perfil e conquistas ↗</button>${window.isMarketAdmin?.()?`<button class="btn-gray btn-sm" data-staff-edit="${e(id)}">Editar comissão</button>`:''}</div></article>`;
  }
  function team(name) {
    const current=[],past=[];
    Object.entries(StaffData.all()).forEach(([id,row])=>{
      if(row.teamKind==='league' && row.teamName===name && row.status==='active')current.push({id,row});
      const history=Object.values(row.careerHistory || {}).filter(entry=>entry.teamKind==='league' && entry.teamName===name);
      history.forEach(entry=>past.push({id,row,entry}));
      if(!history.length && row.teamKind==='league' && row.teamName===name && row.status==='ended')past.push({id,row,entry:row});
    });
    if(!current.length && !past.length && !window.isMarketAdmin?.())return '';
    current.sort((a,b)=>Number(!!b.row.principal)-Number(!!a.row.principal));
    return `<details class="section staff-committee" data-staff-team="${e(name)}"${expandedTeams.has(name)?' open':''}><summary class="staff-committee-summary"><h2>Comissão Técnica</h2><span class="staff-committee-count">${current.length} em atuação${past.length?' · Histórico':''}</span></summary><div class="staff-committee-content"><div class="glory-heading"><span class="eyebrow">LIDERANÇA & ESTRATÉGIA</span>${window.isMarketAdmin?.()?`<button class="btn-primary btn-sm" data-staff-add="${e(name)}">Adicionar manager / coach</button>`:''}</div>${current.length ? current.filter(({row})=>row.principal).map(({id,row})=>card(id,row)).join('')+`<div class="staff-grid">${current.filter(({row})=>!row.principal).map(({id,row})=>card(id,row)).join('')}</div>`:'<p class="market-note">Nenhum integrante da comissão cadastrado.</p>'}${past.length?`<h3 class="staff-past-title">Ex-managers e passagens anteriores</h3><div class="staff-grid staff-past">${past.map(({id,row,entry})=>card(id,row,entry)).join('')}</div>`:''}</div></details>`;
  }
  function agent(player) {
    const entries=Object.entries(StaffData.all()).filter(([,row])=>row.kind==='linked' && row.playerId===player.id && row.playerKey===player.key);
    return entries.length?`<section class="section staff-agent"><h2 class="section-h">Atuação na comissão técnica</h2>${entries.map(([id,row])=>`<p>${e(row.role)} · ${e(row.teamName || 'Sem equipe')} · ${row.status==='active'?'Em atuação':'Vínculo encerrado'}</p><button class="text-button" data-staff-view="${e(id)}">Histórico e conquistas como ${e(row.role)} ↗</button>`).join('')}</section>`:'';
  }
  function close(){document.getElementById('staffProfileDialog')?.close();}
  function open(id) {
    const raw=StaffData.all()[id];if(!raw)return;
    const p=StaffData.identity(raw);
    let el=document.getElementById('staffProfileDialog');if(!el){el=document.createElement('dialog');el.id='staffProfileDialog';document.body.appendChild(el);}
    el.setAttribute('aria-labelledby','staffProfileName');
    const info=[['Nacionalidade',p.nationality],['Idade',p.age],['Aparência',p.appearance],['Sobre',p.bio],['Descrição',p.description]].filter(([,value])=>value && value!=='—');
    const professional=Object.values(raw.careerHistory || {});
    const achievements=Object.values(raw.achievements || {});
    el.innerHTML=`<div class="staff-dialog-top"><span class="eyebrow">PERFIL · COMISSÃO TÉCNICA</span><button class="btn-gray btn-sm" data-staff-close>Fechar</button></div><div class="staff-profile-heading">${portrait(p)}<div><h2 id="staffProfileName">${e(p.name)}</h2><p>${e(p.role)} · ${e(p.teamName || 'Sem equipe')}</p><span class="tag">${p.status==='active'?'Em atuação':'Vínculo encerrado'}</span></div></div><div class="staff-profile-actions">${p.kind==='linked'?`<button class="btn-gray" data-staff-player="${e(p.playerKey)}">Ver perfil do combatente ↗</button>`:''}${window.isMarketAdmin?.()?`<button class="btn-primary" data-staff-edit="${e(id)}">Editar comissão</button>`:''}</div>${info.length?`<dl class="staff-info">${info.map(([label,value])=>`<div><dt>${label}</dt><dd>${e(value)}</dd></div>`).join('')}</dl>`:''}<section class="section"><h3 class="section-h">Vínculo profissional</h3><p>${p.status==='active'?'Em atuação':'Vínculo encerrado'} · ${e(period(raw))}</p><h3 class="staff-contract">${e(ProfileData.contractLabel(p))}</h3><p>${e([p.contractStart,p.contractStartDate].filter(Boolean).join(' · ') || 'Início do contrato não registrado')}${p.contractEndDate && !["none","indefinite","unspecified"].includes(p.contractMode) ? ' · Vencimento: '+e(p.contractEndDate):''}</p>${p.salary!=null?`<p>Salário: ${formatUSD(p.salary)}</p>`:''}${p.releaseClause!=null?`<p>Cláusula: ${formatUSD(p.releaseClause)}</p>`:''}${p.notes?`<p class="staff-notes">${e(p.notes)}</p>`:''}</section>${professional.length?`<section class="section"><h3 class="section-h">Histórico profissional</h3><div class="staff-history">${professional.map(row=>`<article><h4>${e(row.teamName)}</h4><p>${e(period(row))}</p>${row.binding?`<span class="tag">${e(row.binding)}</span>`:''}${row.notes?`<p class="staff-notes">${e(row.notes)}</p>`:''}</article>`).join('')}</div></section>`:''}<section class="section"><h3 class="section-h">Conquistas como manager / coach</h3>${achievements.length?ProfileViews.achievementCards(achievements.map(row=>({row})),true):'<p class="market-note">Informação não registrada.</p>'}</section>`;
    el.showModal();
  }
  document.addEventListener('toggle',event=>{
    const el=event.target;
    if(!el.isConnected || !el.matches?.('details[data-staff-team]'))return;
    if(el.open)expandedTeams.add(el.dataset.staffTeam);
    else expandedTeams.delete(el.dataset.staffTeam);
  },true);
  document.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.hasAttribute('data-staff-close'))close();
    if(button.dataset.staffView)open(button.dataset.staffView);
    if(button.hasAttribute('data-staff-add')){close();ProfileEditor.openStaff(null,button.dataset.staffAdd);}
    if(button.dataset.staffEdit){close();ProfileEditor.openStaff(button.dataset.staffEdit);}
    if(button.dataset.staffPlayer){close();openPlayerProfile(button.dataset.staffPlayer);}
  });
  window.addEventListener('popstate',close);
  window.StaffViews={team,agent,open,close};
})();
