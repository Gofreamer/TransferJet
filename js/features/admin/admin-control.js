/* Central administrativa: navegação e pesquisa sobre os editores e serviços existentes. */
(function () {
  const e=value=>escapeHTML(value ?? "");
  const tasks=[
    ['home','Central de Controle','Visão geral e atalhos','⌂','Cotidiano'],
    ['agents','Gerenciar agentes','Cadastro, fotos, contratos e valores','◈','Cotidiano'],
    ['clubs','Gerenciar equipes','Identidade e memória institucional','◇','Cotidiano'],
    ['staff','Comissão técnica','Managers, coaches e ex-integrantes','♟','Cotidiano'],
    ['transfers','Transferências e janela','Operações oficiais e saídas da liga','⇄','Cotidiano'],
    ['history','Históricos e conquistas','Passagens manuais e Hall da Glória','♜','Cotidiano'],
    ['rumors','Rumores','Notícias e negociações','≋','Cotidiano'],
    ['fantasy','Jet Fantasy','Rodadas, participantes e resultados','☆','Cotidiano'],
    ['import','Importações e sincronizações','Planilhas e partidas da Jet League','↓','Ferramentas'],
    ['ai','IA','Análises e conteúdos com revisão','✦','Ferramentas'],
    ['values','Valores em lote','Tabela completa com revisão','＄','Ferramentas'],
    ['photos','Fotos em lote','URLs e importação de imagens','▧','Ferramentas'],
    ['backup','Backup e manutenção','Exportação, restauração e resets','⚙','Manutenção']
  ];
  tasks.push(['audit','Histórico de edições','Consulta restrita à administração','≡','Manutenção']);
  let baseline=new WeakMap(), observer, focusBefore, transferReview;
  const box=()=>document.getElementById('adminBox');
  const content=()=>document.getElementById('adminTabContent');
  const opened=()=>document.getElementById('adminPanel')?.classList.contains('open');
  function requireAdmin() { ProfileData.requireAdmin(); }
  function readValue(input) { return /checkbox|radio/.test(input.type) ? input.checked : input.type==='file' ? input.files.length : input.value; }
  function editable(input) { return !input.disabled && input.type!=='search' && !/^(acFilter|adminValue|adminPhoto(Search|Club|Filter)|marketRestoreChoice|adminAuditRecord)/.test(input.id); }
  function capture() {
    content()?.querySelectorAll('input,textarea,select').forEach(input=>{if(!baseline.has(input))baseline.set(input,readValue(input));});
  }
  function dirty() {
    return [...(content()?.querySelectorAll('input,textarea,select') || [])].some(input=>editable(input) && baseline.has(input) && String(readValue(input))!==String(input.dataset.original ?? baseline.get(input)));
  }
  function pending() {
    const el=document.getElementById('adminPending');
    if(el)el.hidden=!dirty();
  }
  function canLeave() { return !dirty() || confirm('Descartar as alterações não salvas deste formulário? Os dados já salvos serão preservados.'); }
  function rememberFocus() { focusBefore=document.activeElement; }
  function restoreFocus() { const target=focusBefore?.closest?.('[inert]') ? document.getElementById('menuToggle') : focusBefore; target?.focus?.({preventScroll:true}); }
  function beforeNavigate() { if(!canLeave())return false; observer?.disconnect(); return true; }
  function closed() {observer?.disconnect();baseline=new WeakMap();}
  function shell(tab) {
    const item=tasks.find(task=>task[0]===tab) || tasks[0];
    return `<div class="admin-header"><div><span class="eyebrow">TRANSFERJET · ADMINISTRAÇÃO</span><h2>${e(item[1])}</h2></div><div class="admin-header-actions"><button class="btn-gray btn-sm" onclick="logoutAdmin()">Sair da conta</button><button class="btn-gray btn-sm" onclick="closeAdmin()">Fechar</button></div></div><label class="ac-mobile-task">Ir para uma tarefa<select id="adminTaskSelect">${['Cotidiano','Ferramentas','Manutenção'].map(group=>`<optgroup label="${group}">${tasks.filter(task=>task[4]===group).map(([id,label])=>`<option value="${id}" ${tab===id?'selected':''}>${label}</option>`).join('')}</optgroup>`).join('')}</select></label><div class="ac-layout"><nav class="ac-nav" aria-label="Tarefas administrativas">${['Cotidiano','Ferramentas','Manutenção'].map(group=>`<div><span class="ac-nav-label">${group}</span>${tasks.filter(task=>task[4]===group).map(([id,label,,icon])=>`<button class="admin-tab ${tab===id ? 'active':''}" data-ac-tab="${id}" ${tab===id ? 'aria-current="page"':''}><span aria-hidden="true">${icon}</span>${label}</button>`).join('')}</div>`).join('')}</nav><div class="ac-workspace"><div class="ac-search"><label for="adminGlobalSearch">Encontrar agente ou equipe</label><input type="search" id="adminGlobalSearch" placeholder="Digite um nome…" autocomplete="off" aria-controls="adminSearchResults"><div id="adminSearchResults" aria-live="polite" hidden></div></div><div id="adminPending" role="status" hidden><span>Alterações pendentes · revise e salve antes de sair.</span><button class="btn-gray btn-sm" data-ac-discard>Descartar rascunho</button></div><p id="adminControlStatus" role="status"></p><div id="adminTabContent"></div></div></div>`;
  }
  function home() {
    const players=getAllPlayersFlat(), clubs=Object.keys(AppState.jet.rosters || {});
    content().innerHTML=`<div class="ac-welcome"><span class="eyebrow">SUA CENTRAL DE CONTROLE</span><h3>O que vamos gerenciar?</h3><p>Encontre um registro pela busca ou escolha uma tarefa abaixo.</p><div class="ac-overview"><span><b>${players.length}</b> agentes</span><span><b>${clubs.length}</b> equipes</span><span data-ac-window>Janela ${isTransferWindowOpen() ? 'aberta':'fechada'}</span></div></div><div class="ac-shortcuts">${tasks.filter(task=>!['home','values','photos'].includes(task[0])).map(([id,label,description,icon])=>`<button data-ac-tab="${id}" class="ac-shortcut"><span class="ac-task-icon" aria-hidden="true">${icon}</span><strong>${label}</strong><small>${description}</small><span class="ac-arrow" aria-hidden="true">↗</span></button>`).join('')}</div>`;
  }
  function seasons(p) {
    const raw=AppState.market.players[p.key] || {};
    return [...new Set([raw.statsSeason,...Market.events(raw).map(row=>row.season),...Object.values(raw.careerHistory || {}).flatMap(row=>[row.fromCycle,row.toCycle]),...Object.values(raw.achievements || {}).map(row=>row.season)].filter(Boolean))];
  }
  function filterPlayers(players,filters={}) {
    return Market.filter(players,{search:filters.query,club:filters.club,status:filters.status,rank:filters.rank}).filter(p=>!filters.season || seasons(p).includes(filters.season));
  }
  function options(values,label) {return `<option value="">${label}</option>${[...new Set(values.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR',{numeric:true})).map(value=>`<option value="${e(value)}">${e(value)}</option>`).join('')}`;}
  function directory(type) {
    const players=getAllPlayersFlat(), isClub=type==='clubs';
    content().innerHTML=`<div class="ac-directory-head"><h3>${isClub ? 'Equipes da Jet League' : type==='history' ? 'Passagens e conquistas individuais':'Agentes do mercado'}</h3><p>${isClub ? 'O editor institucional preserva o elenco sincronizado.' : type==='history' ? 'Registros históricos não alteram o vínculo atual. Saídas efetivas ficam na área de transferências.' : 'Abra o editor individual para revisar as alterações antes de salvar.'}</p></div><div class="ac-filters"><label>Buscar nome<input type="search" id="acFilterQuery" placeholder="Nome do ${isClub ? 'clube':'agente'}"></label>${!isClub ? `<label>Equipe<select id="acFilterClub">${options(players.map(p=>p.club),'Todas')}</select></label><label>Status<select id="acFilterStatus">${options(players.map(p=>p.status),'Todos')}</select></label><label>Rank<select id="acFilterRank">${options(players.map(p=>p.rank),'Todos')}</select></label><label>Ciclo registrado<select id="acFilterSeason">${options(players.flatMap(seasons),'Todos')}</select></label>`:''}</div><p id="acResultCount" role="status"></p><div id="acDirectory" data-kind="${type}" data-limit="40"></div><button class="btn-gray" id="acLoadMore" data-ac-more hidden>Mostrar mais registros</button>`;
    renderDirectory();
  }
  function action(kind,key,pane,label) {return `<button class="btn-gray btn-sm" data-ac-edit="${kind}" data-key="${e(key)}" data-pane="${pane}">${label}</button>`;}
  function publicLink(kind,key) {return `<button class="text-button" data-ac-profile="${kind}" data-key="${e(key)}">Perfil público ↗</button>`;}
  function renderDirectory() {
    const target=document.getElementById('acDirectory');if(!target)return;
    const get=id=>document.getElementById('acFilter'+id)?.value || '';
    const type=target.dataset.kind, isClub=type==='clubs', q=Market.normalize(get('Query'));
    const entries=isClub ? Object.keys(AppState.jet.rosters || {}).filter(name=>Market.normalize(name).includes(q)).sort((a,b)=>a.localeCompare(b)) : filterPlayers(getAllPlayersFlat(),{query:q,club:get('Club'),status:get('Status'),rank:get('Rank'),season:get('Season')}).sort((a,b)=>a.name.localeCompare(b.name));
    const limit=Number(target.dataset.limit);
    target.innerHTML=entries.slice(0,limit).map(p=>isClub ? `<article class="ac-record"><div><span class="eyebrow">EQUIPE</span><h4>${e(p)}</h4><p>${(AppState.jet.rosters[p] || []).length} integrantes na Jet League</p></div><div class="ac-record-actions">${action('club',p,'institution','Editar equipe')}${publicLink('club',p)}</div></article>` : `<article class="ac-record" data-player-key="${e(p.key)}"><div><span class="eyebrow">${e(p.club)} · ${e(agentStatusMeta(p.status).label)}</span><h4>${e(p.name)}</h4><p>${e(p.rank)} · ${formatUSD(p.marketValue,true)}</p></div><div class="ac-record-actions">${type==='history' ? '' : action('player',p.key,'identity','Cadastro e foto')+action('player',p.key,'contract','Contrato e valores')+action('player',p.key,'exit','Vínculo atual')}${action('player',p.key,'career','Histórico')}${action('player',p.key,'glory','Conquistas')}${publicLink('player',p.key)}</div></article>`).join('') || '<p class="ac-empty">Nenhum registro encontrado para estes filtros.</p>';
    document.getElementById('acResultCount').textContent=`${entries.length} registro(s) encontrado(s) · ${Math.min(entries.length,limit)} exibido(s)`;
    document.getElementById('acLoadMore').hidden=entries.length<=limit;
  }
  function searchResults(query) {
    const found=PremiumUI.search(query,getAllPlayersFlat(),Object.keys(AppState.jet.rosters || {}));
    const q=Market.normalize(query);
    if(q && window.StaffData)Object.entries(StaffData.all()).forEach(([key,row])=>{const p=StaffData.identity(row);if(Market.normalize(p.name).includes(q))found.push({kind:'staff',key,name:p.name,detail:p.role+' · Comissão técnica · '+(p.teamName || 'Sem equipe')});});
    return found.slice(0,12);
  }
  function search() {
    const target=document.getElementById('adminSearchResults'), query=document.getElementById('adminGlobalSearch').value;
    target.hidden=!query.trim();
    target.innerHTML=searchResults(query).map(row=>`<article class="ac-search-result"><div><strong>${e(row.name)}</strong><small>${e(row.detail)}</small></div><div>${action(row.kind,row.key,row.kind==='club'?'institution':'identity','Editar')}${publicLink(row.kind,row.key)}</div></article>`).join('') || '<p>Nenhum agente ou equipe encontrado.</p>';
  }
  function openEditor(kind,key,pane) {
    requireAdmin();
    if(kind==='staff')ProfileEditor.openStaff(key);else if(kind==='club')ProfileEditor.openClub(key,pane);else ProfileEditor.openAgent(key,pane);
  }
  function staffDirectory() {
    requireAdmin();
    content().innerHTML=`<div class="glory-heading"><div class="ac-directory-head"><h3>Comissão técnica</h3><p>Vincule um combatente existente ou cadastre uma pessoa exclusiva. Contratos e conquistas da comissão são independentes dos de combate.</p></div><button class="btn-primary" data-staff-add="">Cadastrar manager / coach</button></div><div class="ac-filters"><label>Buscar pessoa<input type="search" id="acFilterStaffQuery" placeholder="Nome do manager ou coach"></label><label>Equipe<select id="acFilterStaffTeam">${options(Object.values(StaffData.all()).map(row=>row.teamName),'Todas')}</select></label></div><div id="acStaffDirectory"></div>`;
    renderStaffList();
  }
  function renderStaffList() {
    const target=document.getElementById('acStaffDirectory');if(!target)return;
    const select=document.getElementById('acFilterStaffTeam');
    Object.values(StaffData.all()).map(row=>row.teamName).filter(Boolean).forEach(name=>{if(![...select.options].some(option=>option.value===name))select.insertAdjacentHTML('beforeend',`<option value="${e(name)}">${e(name)}</option>`);});
    const q=Market.normalize(document.getElementById('acFilterStaffQuery').value), team=document.getElementById('acFilterStaffTeam').value;
    target.innerHTML=Object.entries(StaffData.all()).map(([id,row])=>({id,p:StaffData.identity(row)})).filter(({p})=>Market.normalize(p.name).includes(q) && (!team || p.teamName===team)).map(({id,p})=>`<article class="ac-record"><div><span class="eyebrow">${e(p.role)} · ${p.kind==='linked'?(p.competitive===false?'SOMENTE COMISSÃO':'TAMBÉM COMBATENTE'):'CADASTRO EXCLUSIVO'}</span><h4>${e(p.name)}</h4><p>${e(p.teamName || 'Sem equipe')} · ${p.status==='active'?'Em atuação':'Vínculo encerrado'}</p></div><div class="ac-record-actions">${action('staff',id,'identity','Editar comissão')}${publicLink('staff',id)}<button type="button" class="btn-danger btn-sm" data-ac-remove-staff="${e(id)}">Excluir da comissão</button></div></article>`).join('') || '<p class="ac-empty">Nenhuma pessoa cadastrada na comissão para este filtro.</p>';
  }
  function auditEntries() {
    return [...Object.entries(AppState.market.players || {}).map(([key,record])=>({key:'player:'+key,label:'Agente · '+(record.name || key),record})),...Object.entries(AppState.market.settings?.clubProfiles || {}).map(([key,record])=>({key:'club:'+key,label:'Equipe · '+(record.leagueName || key),record})),...Object.entries(window.StaffData?.all() || {}).map(([key,record])=>({key:'staff:'+key,label:'Comissão · '+StaffData.identity(record).name,record})),...Object.entries(AppState.market.settings?.staffArchive || {}).map(([key,entry])=>({key:'staff-archived:'+key,label:'Comissão excluída · '+StaffData.identity(entry.record).name,record:{...entry.record,changeLog:{...(entry.record.changeLog || {}),deletion:{at:entry.deletedAt,source:entry.source,actor:entry.actor,changes:{cadastro:{before:'Comissão Técnica',after:'Excluído da comissão'}}}}}}))].filter(entry=>Object.keys(entry.record.changeLog || {}).length);
  }
  function audit() {
    requireAdmin();const entries=auditEntries();
    content().innerHTML=`<section class="ac-audit"><h3 class="admin-section-title">Histórico de edições</h3><p class="admin-sub">Consulta administrativa. Os registros são preservados e não aparecem nos perfis públicos.</p><label>Selecionar cadastro<select id="adminAuditRecord"><option value="">Selecione um registro</option>${entries.map(entry=>`<option value="${e(entry.key)}">${e(entry.label)}</option>`).join('')}</select></label><div id="adminAuditContent"></div>${entries.length?'':'<p>Nenhuma edição registrada.</p>'}</section>`;
  }
  function windowMarkup() {
    return `<section class="ac-market-window"><div><span class="eyebrow">CONTROLE DO MERCADO</span><h3>Janela de transferências</h3><span data-ac-window class="window-badge ${isTransferWindowOpen()?'open':'closed'}">${isTransferWindowOpen()?'ABERTA':'FECHADA'}</span></div><div class="admin-actions"><button class="btn-primary btn-sm" onclick="setTransferWindow(true)">Abrir janela</button><button class="btn-gray btn-sm" onclick="setTransferWindow(false)">Fechar janela</button></div><p id="adminWindowStatus" role="status"></p></section><div class="ac-operation-types"><article><h4>Transferência oficial</h4><p>O formulário abaixo registra operações do mercado. Status oficial altera o vínculo atual após confirmação.</p></article><article><h4>Saída internacional</h4><p>Use a ação explícita de vínculo atual no editor do agente. Sincronização com a Jet League tem confirmação separada.</p><button class="text-button" data-ac-tab="agents">Encontrar agente para saída ↗</button></article><article><h4>Somente histórico</h4><p>Passagens e conquistas antigas não transferem o agente nem criam uma transferência oficial.</p><button class="text-button" data-ac-tab="history">Gerenciar registros históricos ↗</button></article></div>`;
  }
  function organizeFantasy() {
    const buttons=[...content().querySelectorAll('button[onclick]')].filter(btn=>/^(fxAdminSeed|fxAdminResetAll|fxAdminRebuildNpcs|fxAdminRepairData)\(/.test(btn.getAttribute('onclick')) && !btn.closest('.ac-danger'));
    if(!buttons.length)return;
    let area=content().querySelector('.ac-danger');
    if(!area){area=document.createElement('details');area.className='ac-danger';area.innerHTML='<summary>Ferramentas avançadas e operações destrutivas do Fantasy</summary><p>Reparos, remontagem e resets afetam dados existentes. Confira as confirmações de cada operação.</p><div class="admin-actions"></div>';content().appendChild(area);}
    buttons.forEach(btn=>area.querySelector('.admin-actions').appendChild(btn));
  }
  function finish(tab) {
    observer?.disconnect();
    baseline=new WeakMap();
    if(tab==='transfers') {
      content().insertAdjacentHTML('afterbegin',windowMarkup());
      content().querySelector('button[onclick="saveTransfer()"]')?.setAttribute('onclick','AdminControl.reviewTransfer()');
    }
    if(tab==='backup') {
      const headings=content().querySelectorAll('h3');const start=headings[1];
      if(start){const area=document.createElement('details');area.className='ac-danger';area.innerHTML='<summary>Restaurar registro ausente · revisar antes de confirmar</summary>';let node=start;while(node){const next=node.nextSibling;area.appendChild(node);node=next;}content().appendChild(area);}
      content().insertAdjacentHTML('beforeend','<details class="ac-danger"><summary>Operações destrutivas do mercado</summary><p>Reaplicar o seed sobrescreve agentes, transferências, rumores e configurações. Use apenas quando essa substituição for intencional.</p><button class="btn-danger" onclick="forceReseedFromCode()">Reaplicar seed do mercado</button><p id="importStatus" role="status"></p></details><div class="ac-maintenance-link"><h3>Manutenção do Fantasy</h3><p>Reparos e resets ficam separados dos controles cotidianos, em uma seção recolhida no painel Fantasy.</p><button class="btn-gray" data-ac-tab="fantasy">Abrir ferramentas Fantasy</button></div>');
    }
    if(tab==='fantasy')organizeFantasy();
    capture();pending();
    observer=new MutationObserver(()=>{if(box()?.dataset.tab==='fantasy')organizeFantasy();capture();pending();});
    observer.observe(content(),{childList:true,subtree:true});
  }
  function reviewTransfer() {
    requireAdmin();
    let dialog=document.getElementById('adminTransferReview');
    if(!dialog){dialog=document.createElement('dialog');dialog.id='adminTransferReview';document.body.appendChild(dialog);}
    transferReview=['trPlayer','trFrom','trTo','trFee','trType','trDate','trSeason','trStatus'].map(id=>({id,value:document.getElementById(id).value,label:document.getElementById(id).closest('div').querySelector('label')?.textContent || id,display:document.getElementById(id).selectedOptions?.[0]?.textContent || document.getElementById(id).value}));
    dialog.innerHTML=`<h2>Revisar transferência</h2><p>Confira a operação. Uma transferência oficial altera o vínculo atual do agente.</p><dl>${transferReview.map(row=>`<div><dt>${e(row.label)}</dt><dd>${e(row.display || 'Não informado')}</dd></div>`).join('')}</dl><div class="admin-actions"><button class="btn-gray" data-ac-cancel-transfer>Voltar sem salvar</button><button class="btn-primary" data-ac-confirm-transfer>Confirmar transferência</button></div>`;
    dialog.setAttribute('aria-label','Revisar transferência');dialog.showModal();
  }
  document.addEventListener('click',async event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.hasAttribute('data-ac-cancel-transfer'))return document.getElementById('adminTransferReview').close();
    if(button.hasAttribute('data-ac-confirm-transfer')){
      try {requireAdmin();if(transferReview.some(row=>document.getElementById(row.id)?.value!==row.value))throw Error('O formulário mudou. Revise novamente.');button.disabled=true;if(await saveTransfer())document.getElementById('adminTransferReview').close();}
      catch(error){alert(error.message);}finally{button.disabled=false;}return;
    }
    if(!button.closest('#adminBox'))return;
    try {
      requireAdmin();
      if(button.dataset.acTab)return renderAdminPanel(button.dataset.acTab);
      if(button.hasAttribute('data-ac-discard'))return renderAdminPanel(box().dataset.tab);
      if(button.dataset.acRemoveStaff)return ProfileEditor.removeStaff(button.dataset.acRemoveStaff);
      if(button.dataset.acEdit)return openEditor(button.dataset.acEdit,button.dataset.key,button.dataset.pane);
      if(button.dataset.acProfile){if(closeAdmin()===false)return;if(button.dataset.acProfile==='staff')StaffViews.open(button.dataset.key);else button.dataset.acProfile==='club' ? openClubProfile(button.dataset.key) : openPlayerProfile(button.dataset.key);}
      if(button.hasAttribute('data-ac-more')){document.getElementById('acDirectory').dataset.limit=Number(document.getElementById('acDirectory').dataset.limit)+40;renderDirectory();}
    } catch(error){document.getElementById('adminControlStatus').textContent=error.message;}
  });
  document.addEventListener('input',event=>{if(event.target.id==='adminGlobalSearch')search();if(event.target.id.startsWith('acFilter') && event.target.tagName!=='SELECT'){if(event.target.id.startsWith('acFilterStaff'))renderStaffList();else renderDirectory();}if(event.target.closest('#adminTabContent'))pending();});
  document.addEventListener('change',event=>{if(event.target.id==='adminTaskSelect'){renderAdminPanel(event.target.value);document.getElementById('adminTaskSelect').value=box().dataset.tab;return;}if(event.target.id==='adminAuditRecord'){requireAdmin();const entry=auditEntries().find(row=>row.key===event.target.value);document.getElementById('adminAuditContent').innerHTML=entry?MarketUI.auditMarkup(entry.record):'';return;}if(event.target.id.startsWith('acFilter') && event.target.tagName==='SELECT'){if(event.target.id.startsWith('acFilterStaff'))renderStaffList();else renderDirectory();}if(event.target.closest('#adminTabContent'))pending();});
  document.addEventListener('keydown',event=>{
    if(event.key==='Tab' && opened() && !document.querySelector('dialog[open],#aiReviewOverlay.open')) {
      const items=[...box().querySelectorAll('button,input,select,textarea,a[href]')].filter(el=>!el.disabled && el.getClientRects().length);
      if(event.shiftKey && document.activeElement===items[0]){event.preventDefault();items.at(-1)?.focus();}
      else if(!event.shiftKey && document.activeElement===items.at(-1)){event.preventDefault();items[0]?.focus();}
    }
    if(event.key==='Escape' && opened() && !document.querySelector('dialog[open],#aiReviewOverlay.open')){event.preventDefault();closeAdmin();}});
  window.addEventListener('beforeunload',event=>{if(opened() && dirty() || window.ProfileEditor?.hasUnsavedChanges()){event.preventDefault();event.returnValue='';}});
  ['market:updated','jet:updated','admin:record-saved'].forEach(name=>document.addEventListener(name,()=>{if(opened()){renderDirectory();renderStaffList();document.querySelectorAll('[data-ac-window]').forEach(el=>{el.textContent=isTransferWindowOpen()?'Janela aberta':'Janela fechada';el.classList.toggle('open',isTransferWindowOpen());el.classList.toggle('closed',!isTransferWindowOpen());});}}));
  window.AdminControl={tasks,shell,home,directory,finish,canLeave,beforeNavigate,dirty,pending,rememberFocus,restoreFocus,filterPlayers,seasons,searchResults,openEditor,reviewTransfer,closed,staffDirectory,renderStaffList,audit};
})();
