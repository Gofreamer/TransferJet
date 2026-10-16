/* O diálogo vive fora do perfil: listeners não substituem formulários em edição. */
(function () {
  const e = value => escapeHTML(value);
  let session = null;
  const labels = { name: "Nome", nationality: "Nacionalidade", age: "Idade", rank: "Rank", functionRole: "Função", photo: "Foto (URL)", status: "Status", contractMode: "Tipo de contrato", contractStart: "Ciclo / temporada inicial", contractStartDate: "Data inicial (opcional)", contractUntil: "Ciclo / temporada de vencimento", contractEndDate: "Data exata de vencimento (opcional)", salary: "Salário", releaseClause: "Cláusula de rescisão", bio: "Biografia", description: "Descrição adicional", notes: "Observações", titles: "Títulos", trophy: "Total de títulos", careerHistory: "Passagens manuais", team: "Equipe atual", freeAgent: "Agente livre", leagueExit: "Saída efetiva da liga" };
  Object.assign(labels,{crest:"Brasão (URL)",cover:"Imagem de capa (URL)",founded:"Fundação (texto livre)",bestEra:"Melhor fase histórica",rivalries:"Rivalidades",legends:"Ídolos históricos",highlights:"Destaques históricos",placements:"Colocações",formerMembers:"Ex-membros e períodos"});
  function dialog() { return document.getElementById("profileEditorDialog"); }
  labels.achievements = "Hall da Glória · conquistas detalhadas";
  Object.assign(labels,{marketValue:"Valor de mercado (US$)",peakValue:"Maior valor registrado (US$)"});
  Object.assign(labels,{competitive:"Manter no elenco competitivo",kind:"Tipo de pessoa",playerKey:"Combatente vinculado",appearance:"Aparência",teamKind:"Tipo de organização",teamName:"Organização",role:"Cargo",principal:"Responsável principal",startCycle:"Ciclo de entrada",startDate:"Data de entrada",endCycle:"Ciclo de saída",endDate:"Data de saída",staffHistory:"Histórico profissional",staffAwards:"Conquistas da comissão"});
  function field(name, value, type = "text", label = labels[name] || name, options) {
    const content = options ? `<select data-field="${name}">${options.map(([key, text]) => `<option value="${e(key)}" ${String(value ?? "") === key ? "selected" : ""}>${e(text)}</option>`).join("")}</select>` : type === "textarea" ? `<textarea data-field="${name}" rows="3">${e(value)}</textarea>` : `<input data-field="${name}" type="${type}" value="${e(value)}" ${type === "number" ? 'min="0" step="any"' : ""}>`;
    return `<label>${e(label)}${content}</label>`;
  }
  function notice(message, failed = false) {
    const el = document.getElementById("peStatus");
    if (el) { el.textContent = message; el.dataset.error = String(failed); }
  }
  function feedback(message) {
    let el = document.getElementById("profileFeedback");
    if (!el) { el = document.createElement("div"); el.id = "profileFeedback"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.textContent = message;
  }
  function setup(title, type, key, raw, visible) {
    ProfileData.requireAdmin();
    if (session) { if (!confirm("Fechar o rascunho atual sem salvar?")) return false; dialog().close(); }
    session = { type, key, raw: ProfileData.clone(raw), visible, busy: false, historyOriginal: JSON.stringify(raw.careerHistory || {}) };
    let el = dialog();
    if (!el) {
      el = document.createElement("dialog"); el.id = "profileEditorDialog"; el.setAttribute("aria-labelledby", "peTitle"); document.body.appendChild(el);
      el.addEventListener("cancel", event => { event.preventDefault(); close(); });
    }
    el.innerHTML = `<div class="pe-header"><div><span class="eyebrow">ADMINISTRAÇÃO · PERFIL</span><h2 id="peTitle">${e(title)}</h2></div><button class="pe-close" data-action="close" aria-label="Fechar editor">×</button></div><div id="peForm"></div><section id="peReview" hidden></section><p id="peStatus" role="status" aria-live="polite"></p><div class="pe-footer"><button class="btn-gray" data-action="close">Cancelar</button><button class="btn-gray" id="peBack" data-action="back" hidden>Voltar à edição</button><button class="btn-primary" id="peReviewBtn" data-action="review">Revisar alterações</button><button class="btn-primary" id="peSaveBtn" data-action="save" hidden>Confirmar alterações</button></div>`;
    return true;
  }
  function baseline() {
    dialog().querySelectorAll("[data-field]").forEach(input => { input.dataset.initial = fieldValue(input); });
    session.initialHistory = JSON.stringify(readHistory());
    session.initialClubRows = readClubRows();
  }
  function fieldValue(el) {return el.type==='checkbox' ? String(el.checked) : el.value;}
  function collect() {
    const input = {};
    dialog().querySelectorAll("#peForm [data-field]").forEach(el => {
      if (fieldValue(el) === el.dataset.initial) return;
      if (el.dataset.field.startsWith("title_")) { input.titles ||= {}; input.titles[el.dataset.field.slice(6)] = el.value; }
      else input[el.dataset.field] = fieldValue(el);
    });
    return input;
  }
  function readHistory() {
    return [...dialog().querySelectorAll(".pe-history-row:not(.pe-record-row)")].map(row => {
      const entry = { id: row.dataset.id };
      row.querySelectorAll("[data-history-field]").forEach(el => { entry[el.dataset.historyField] = el.value; });
      return entry;
    });
  }
  function changed() { return Object.keys(collect()).length || JSON.stringify(readHistory()) !== session.initialHistory || JSON.stringify(readClubRows()) !== JSON.stringify(session.initialClubRows); }
  function close() {
    if (!session || session.busy) return;
    if (changed() && !confirm("Descartar as alterações deste rascunho? Os dados salvos serão preservados.")) return;
    dialog().close(); session = null;
  }
  function teamInput(kind, name) {
    if (kind === "free") return `<input data-history-field="teamName" value="Livre" readonly>`;
    if (kind === "external") return `<input data-history-field="teamName" value="${e(name)}" placeholder="Nome da equipe internacional">`;
    const teams = [...new Set([...Object.keys(AppState.jet.rosters || {}), ...(name ? [name] : [])])].sort();
    return `<select data-history-field="teamName"><option value="">Selecione a equipe</option>${teams.map(team => `<option ${team === name ? "selected" : ""}>${e(team)}</option>`).join("")}</select>`;
  }
  function historyRow(id, row = {}) {
    const kind = row.teamKind || "league";
    const input = (key, label, type = "text") => `<label>${label}<input type="${type}" data-history-field="${key}" value="${e(row[key])}"></label>`;
    return `<fieldset class="pe-history-row" data-id="${e(id)}"><legend>Passagem manual</legend><div class="pe-grid"><label>Tipo de equipe<select data-history-field="teamKind">${[["league","Equipe da Jet League"],["external","Equipe externa / internacional"],["free","Período como agente livre"]].map(([k,l]) => `<option value="${k}" ${k === kind ? "selected" : ""}>${l}</option>`).join("")}</select></label><label>Equipe<span class="pe-team-name">${teamInput(kind, row.teamName || "")}</span></label>${input("fromCycle", "Ciclo de entrada (opcional)")}${input("toCycle", "Ciclo de saída (opcional)")}${input("fromDate", "Data de entrada (opcional)", "date")}${input("toDate", "Data de saída (opcional)", "date")}${input("binding", "Tipo de vínculo (opcional)")}<label>Observações<textarea data-history-field="notes" rows="2">${e(row.notes)}</textarea></label></div><button type="button" class="btn-danger" data-action="remove-history">Remover passagem</button></fieldset>`;
  }
  function tab(name) {
    dialog().querySelectorAll("[data-pane]").forEach(el => { el.hidden = el.dataset.pane !== name; });
    dialog().querySelectorAll("[data-tab]").forEach(el => { el.setAttribute("aria-selected", String(el.dataset.tab === name)); });
  }
  function openAgent(key, pane = "identity") {
    try {
      ProfileData.requireAdmin();
      const p = getAllPlayersFlat().find(p => p.key === key);
      if (!p) throw Error("Agente não encontrado.");
      const raw = AppState.market.players[key] || {};
      if (!setup("Editar agente · " + p.name, "agent", key, raw, p)) return;
      const value = field => raw[field] ?? (p[field] === "—" ? "" : p[field]) ?? "";
      document.getElementById("peForm").innerHTML = `<nav class="pe-tabs" role="tablist" aria-label="Categorias do agente">${[["identity","Cadastro"],["contract","Contrato"],["career","Carreira"],["exit","Vínculo atual"]].map(([id,label]) => `<button role="tab" data-tab="${id}" type="button">${label}</button>`).join("")}</nav>
        <section data-pane="identity"><p class="pe-help">Identidade permanente: ${e(p.id)}. A equipe atual continua ${e(p.club)}.</p><div class="pe-grid">${["name","nationality","age","rank","functionRole","photo"].map(key => field(key,value(key),key === "age" ? "number" : "text")).join("")}${field("status", value("status"), "text", "Status", ["ativo","livre","emprestado","lesionado","suspenso","aposentado","fora-liga"].map(s => [s,agentStatusMeta(s).label]))}${["bio","description","notes"].map(key => field(key,value(key),"textarea")).join("")}${["nacional","lji","mundial","eventoEspecial"].map(key => field("title_"+key, p.titles?.[key] || 0,"number", "Títulos · " + ({nacional:"Nacional",lji:"L.J.I",mundial:"Mundial",eventoEspecial:"Evento Especial"})[key])).join("")}</div></section>
        <section data-pane="contract" hidden><p class="pe-help">Ciclos são texto livre (ex.: C.4). Datas são opcionais; nenhum ciclo será convertido em data.</p><div class="pe-grid">${field("contractMode",raw.contractMode || (raw.contractUntil ? "fixed" : "unspecified"),"text",labels.contractMode,[["unspecified","Prazo não informado"],["fixed","Prazo determinado"],["indefinite","Indeterminado"],["none","Sem contrato"]])}${["contractStart","contractUntil","contractStartDate","contractEndDate","salary","releaseClause"].map(key => field(key,value(key),key.endsWith("Date") ? "date" : ["salary","releaseClause"].includes(key) ? "number" : "text")).join("")}</div></section>
        <section data-pane="career" hidden><p class="pe-help">Passagens manuais são apenas históricas. Não transferem o agente, não alteram contratos ou valores e não escrevem na Jet League.</p><div id="peHistoryRows">${Object.entries(raw.careerHistory || {}).map(([id,row]) => historyRow(id,row)).join("")}</div><button type="button" class="btn-gray" data-action="add-history">Adicionar passagem</button></section>
        <section data-pane="exit" hidden><h3>Equipe atual: ${e(p.club)}</h3><p class="pe-help">A saída efetiva é uma ação separada. Ela atualiza o vínculo no Market e não cria transferência ou equipe na liga. O valor, a identidade e os históricos são preservados. Nenhum elenco da Jet League é alterado automaticamente.</p><div class="pe-grid"><label>Destino<select id="peExitKind"><option value="external">Equipe externa / internacional</option><option value="free">Agente livre</option></select></label><label>Nome da equipe externa<input id="peExitTeam"></label><label>Observação<textarea id="peExitNote"></textarea></label></div><button class="btn-danger" type="button" data-action="review-exit">Revisar saída efetiva da liga</button></section>`;
      const tabs = document.querySelector('#peForm .pe-tabs');
      dialog().querySelector('[data-pane="identity"]').insertAdjacentHTML('beforeend','<button type="button" class="btn-gray" data-action="integrate-staff">Integrar à Comissão Técnica</button>');
      tabs.querySelector('[data-tab="contract"]').textContent="Contrato e valores";
      dialog().querySelector('[data-pane="contract"] .pe-grid').insertAdjacentHTML("beforeend",field("marketValue",value("marketValue"),"number")+field("peakValue",value("peakValue"),"number"));
      tabs.insertAdjacentHTML("beforeend",'<button role="tab" data-tab="glory" type="button">Hall da Glória</button>');
      document.getElementById("peForm").insertAdjacentHTML("beforeend",`<section data-pane="glory" hidden><h3>Gerenciar conquistas</h3><p class="pe-help">Cada registro detalha uma conquista, sem aumentar os contadores. Para detalhar um título antigo, informe seu número na categoria (1, 2…). Prêmios individuais não contam como títulos coletivos. Campos desconhecidos podem ficar em branco.</p><datalist id="peAchievementTeams">${Object.keys(AppState.jet.rosters || {}).map(name=>`<option value="${e(name)}"></option>`).join("")}</datalist><div id="peAchievements">${Object.entries(raw.achievements || {}).map(([id,row])=>clubRow("achievements",id,row)).join("")}</div><button type="button" class="btn-gray" data-action="add-club-row" data-group="achievements">Adicionar conquista</button></section>`);
      baseline(); tab(pane); dialog().showModal();
    } catch (error) { feedback(error.message); }
  }
  function summarize(field, value) {
    if(field==='competitive')return value===undefined ? 'Comportamento anterior (combatente)' : value===true || value==='true' ? 'Mantém no elenco competitivo' : 'Somente Comissão Técnica';
    if (field === "achievements") return Object.values(value || {}).map(row => `${ProfileData.achievementTypes[row.type]} · ${row.competitionName || "informação não registrada"} · ${row.result || "informação não registrada"} · ${row.teamName || "informação não registrada"} (${row.teamKind === "league" ? "equipe da liga" : "equipe externa / histórica"}) · ciclo: ${row.season || "informação não registrada"} · data: ${row.date || "informação não registrada"}${row.legacySlot ? " · título antigo #" + row.legacySlot : ""}${row.notes ? " · " + row.notes : ""}${row.officialId ? " · campeonato: " + row.officialId : ""}`).join("; ") || "Sem conquistas detalhadas";
    if (field === "careerHistory") return Object.values(value || {}).map(row => `${row.teamName}: ${row.fromCycle || row.fromDate || "início não informado"} → ${row.toCycle || row.toDate || "fim não informado"}`).join("; ") || "Sem passagens manuais";
    return value == null || value === "" ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value);
  }
  const clubRowFields = {
    placements: [["competition","Competição"],["cycle","Ciclo / temporada"],["place","Colocação"],["notes","Observações"]],
    formerMembers: [["name","Nome do ex-membro"],["fromCycle","Ciclo de entrada"],["toCycle","Ciclo de saída"],["fromDate","Data de entrada (opcional)","date"],["toDate","Data de saída (opcional)","date"],["notes","Observações"]]
  };
  function clubRow(group,id,row={}) {
    if (group === "achievements" || group === "staffAwards") return achievementRow(id,row,group);
    if (group === "staffHistory") return historyRow(id,row).replace('class="pe-history-row"', 'class="pe-history-row pe-staff-history"');
    return `<fieldset class="pe-record-row pe-history-row" data-group="${group}" data-id="${e(id)}"><legend>${labels[group]}</legend><div class="pe-grid">${clubRowFields[group].map(([key,label,type])=>`<label>${label}<input data-record-field="${key}" type="${type || "text"}" value="${e(row[key])}"></label>`).join("")}</div><button type="button" class="btn-danger" data-action="remove-club-row">Remover registro</button></fieldset>`;
  }
  function readClubRows() {
    const groups = { placements:[],formerMembers:[],achievements:[],staffAwards:[] };
    dialog().querySelectorAll(".pe-record-row").forEach(row=>{
      const entry={id:row.dataset.id}; row.querySelectorAll("[data-record-field]").forEach(el=>{entry[el.dataset.recordField]=el.value;}); groups[row.dataset.group].push(entry);
    });
    return groups;
  }
  function achievementRow(id,row,group="achievements") {
    const select = (key,label,options) => `<label>${label}<select data-record-field="${key}">${options.map(([value,title])=>`<option value="${e(value)}" ${String(row[key] || "")===value ? "selected" : ""}>${e(title)}</option>`).join("")}</select></label>`;
    const official = ProfileData.officialCompetitions().map(entry=>[entry.id,`${entry.competitionName} · ${entry.season} · ${entry.teamName}`]);
    if (row.officialId && !official.some(([id])=>id===row.officialId)) official.push([row.officialId,"Vínculo histórico preservado · " + row.officialId]);
    const fields=[["competitionName","Competição ou prêmio"],["result","Resultado / conquista"],["teamName","Nome da equipe (opcional)"],["season","Ciclo / temporada"],["date","Data opcional","date"],...(group==='achievements' ? [["legacySlot","Número do título antigo nesta categoria (opcional)","number"]]:[]),["notes","Observações"]];
    return `<fieldset class="pe-record-row pe-history-row" data-group="${group}" data-id="${e(id)}"><legend>🏆 ${group==='staffAwards' ? 'Conquista como manager / coach':'Conquista individualizada'}</legend><div class="pe-grid">${select("type","Tipo de conquista",Object.entries(ProfileData.achievementTypes))}${select("teamKind","Equipe representada",[["external","Nome livre / equipe externa ou histórica"],["league","Equipe cadastrada na Jet League"]])}${fields.map(([key,label,type])=>`<label>${label}<input data-record-field="${key}" type="${type || "text"}" ${key==="teamName" ? 'list="peAchievementTeams"' : ""} ${key==="legacySlot" ? 'min="1" step="1"' : ""} value="${e(row[key])}"></label>`).join("")}${select("officialId","Campeonato registrado (opcional)",[["","Preenchimento manual"],...official])}</div><p class="pe-help">${official.length ? "Ao selecionar um campeonato, seus dados explícitos preenchem a conquista para revisão." : "Sem campeonato com dados oficiais suficientes para relacionar. Use preenchimento manual."}</p><button type="button" class="btn-danger" data-action="remove-club-row">Excluir conquista</button></fieldset>`;
  }
  function openStaff(key,club='',playerKey='') {
    try {
      ProfileData.requireAdmin();
      if(playerKey) {
        const player=getAllPlayersFlat().find(p=>p.key===playerKey);
        if(!player)throw Error('Agente não encontrado.');
        key=Object.entries(StaffData.all()).find(([,row])=>row===StaffData.forPlayer(player))?.[0] || key;
      }
      key ||= marketDb.ref('settings/staff').push().key;
      const raw=StaffData.all()[key] || {};
      if(!setup(raw.id ? 'Editar comissão · '+StaffData.identity(raw).name:'Cadastrar manager / coach','staff',key,raw,{club}))return;
      const value=name=>raw[name] ?? ({kind:playerKey?'linked':'exclusive',playerKey,teamKind:club?'league':'none',teamName:club,role:'Manager',status:'active',principal:false,contractMode:'unspecified'})[name] ?? '';
      const players=getAllPlayersFlat().sort((a,b)=>a.name.localeCompare(b.name));
      document.getElementById('peForm').innerHTML=`<nav class="pe-tabs" role="tablist" aria-label="Comissão técnica">${[['identity','Pessoa'],['affiliation','Vínculo e cargo'],['contract','Contrato'],['career','Histórico'],['glory','Conquistas']].map(([id,label])=>`<button type="button" role="tab" data-tab="${id}">${label}</button>`).join('')}</nav>
        <section data-pane="identity">${field('kind',value('kind'),'text',labels.kind,[['exclusive','Manager exclusivo'],['linked','Combatente que também é manager / coach']])}<div data-staff-person="linked">${field('playerKey',value('playerKey'),'text','Combatente existente',[['','Selecione um agente'],...players.map(p=>[p.key,p.name+' · '+p.club])])}<p class="pe-help">A pessoa continua sendo o mesmo combatente. Nome, foto e informações são lidos do cadastro existente.</p>${raw.playerKey ? `<button class="btn-gray" data-action="edit-linked">Editar cadastro do combatente</button>`:''}</div><div class="pe-grid" data-staff-person="exclusive">${['name','photo','nationality','age','appearance','bio','description'].map(name=>field(name,value(name),name==='age'?'number':['appearance','bio','description'].includes(name)?'textarea':'text')).join('')}</div></section>
        <section data-pane="affiliation" hidden><p class="pe-help">Não altera o elenco de combate. Ao encerrar ou mudar equipe/cargo, o vínculo anterior é preservado no histórico, sem inventar datas.</p><div class="pe-grid">${field('teamKind',value('teamKind'),'text',labels.teamKind,[['league','Equipe Jet League'],['external','Organização externa / histórica'],['none','Sem equipe']])}${field('teamName',value('teamName'))}<datalist id="peStaffTeams">${Object.keys(AppState.jet.rosters || {}).map(name=>`<option value="${e(name)}"></option>`).join('')}</datalist>${field('role',value('role'),'text','Cargo',[['Manager','Manager'],['Coach','Coach']])}${field('principal',String(value('principal')),'text','Slot de destaque da equipe',[['false','Integrante da comissão'],['true','Responsável principal']])}${field('status',value('status'),'text','Situação do vínculo',[['active','Em atuação'],['ended','Vínculo encerrado / ex-manager']])}${['startCycle','startDate','endCycle','endDate','notes'].map(name=>field(name,value(name),name.endsWith('Date')?'date':name==='notes'?'textarea':'text')).join('')}</div></section>
        <section data-pane="contract" hidden><p class="pe-help">Contrato da comissão, independente do contrato como combatente. Datas e ciclos são opcionais.</p><div class="pe-grid">${field('contractMode',value('contractMode'),'text',labels.contractMode,[['unspecified','Prazo não informado'],['fixed','Prazo determinado'],['indefinite','Indeterminado'],['none','Sem contrato']])}${['contractStart','contractUntil','contractStartDate','contractEndDate','salary','releaseClause'].map(name=>field(name,value(name),name.endsWith('Date')?'date':['salary','releaseClause'].includes(name)?'number':'text')).join('')}</div></section>
        <section data-pane="career" hidden><p class="pe-help">Passagens profissionais; não modificam o vínculo atual.</p><div id="peHistoryRows">${Object.entries(raw.careerHistory || {}).map(([id,row])=>clubRow('staffHistory',id,row)).join('')}</div><button type="button" class="btn-gray" data-action="add-history">Adicionar passagem profissional</button></section>
        <section data-pane="glory" hidden><p class="pe-help">Conquistas como manager ou treinador, separadas dos títulos de combate e da pontuação Fantasy.</p><datalist id="peAchievementTeams">${Object.keys(AppState.jet.rosters || {}).map(name=>`<option value="${e(name)}"></option>`).join('')}</datalist><div id="peStaffAwards">${Object.entries(raw.achievements || {}).map(([id,row])=>clubRow('staffAwards',id,row)).join('')}</div><button type="button" class="btn-gray" data-action="add-club-row" data-group="staffAwards">Adicionar conquista da comissão</button></section>`;
      dialog().querySelector('[data-field="teamName"]').setAttribute('list','peStaffTeams');
      dialog().querySelector('[data-staff-person="linked"]').insertAdjacentHTML('beforeend',`<label class="pe-competitive"><input type="checkbox" data-field="competitive" ${raw.competitive===true || raw.id && raw.competitive===undefined ? 'checked':''}> Manter no elenco competitivo</label><p class="pe-help">Desmarcada: atua somente na Comissão Técnica. Marcada: também compete. Preserva o cadastro e os históricos; não altera a Jet League.</p>`);
      dialog().querySelector('[data-field="kind"] option[value="linked"]').textContent='Agente existente';
      dialog().querySelector('[data-pane="affiliation"] .pe-help').textContent='O vínculo profissional é independente do elenco da Jet League. Ao encerrar ou mudar equipe/cargo, a passagem anterior é preservada, sem inventar datas.';
      if(raw.id)['kind','playerKey'].forEach(name=>{dialog().querySelector(`[data-field="${name}"]`).disabled=true;});
      if(raw.id)dialog().querySelector('[data-pane="identity"]').insertAdjacentHTML('beforeend',`<button type="button" class="btn-danger" data-action="remove-staff">Excluir da Comissão Técnica</button>`);
      staffIdentity();baseline();tab('identity');dialog().showModal();
    } catch(error){feedback(error.message);}
  }
  function staffIdentity() {const kind=dialog().querySelector('[data-field="kind"]').value;dialog().querySelectorAll('[data-staff-person]').forEach(el=>{el.hidden=el.dataset.staffPerson!==kind;});}
  function openClub(name) {
    try {
      ProfileData.requireAdmin();
      if (!Object.hasOwn(AppState.jet.rosters || {},name)) throw Error("Equipe não cadastrada na Jet League.");
      const raw=ProfileData.clubProfile(name);
      if (!setup("Editar equipe · " + name,"club",name,raw,{name})) return;
      document.getElementById("peForm").innerHTML=`<nav class="pe-tabs" role="tablist" aria-label="Categorias da equipe">${[["institution","Identidade"],["achievements","Competições"],["memory","Memória da equipe"]].map(([id,label])=>`<button type="button" role="tab" data-tab="${id}">${label}</button>`).join("")}</nav>
        <section data-pane="institution"><p class="pe-help">Cadastro institucional no Market. O nome e o elenco atual seguem a Jet League.</p><div class="pe-grid">${["crest","cover","founded","description"].map(key=>field(key,raw[key] || "",key==="description" ? "textarea":"text")).join("")}</div></section>
        <section data-pane="achievements" hidden><p class="pe-help">Informe somente títulos e resultados conhecidos. Nenhuma competição será criada ou calculada automaticamente.</p><div class="pe-grid">${["nacional","lji","mundial","eventoEspecial"].map(key=>field("title_"+key,raw.titles?.[key] || 0,"number","Títulos · "+({nacional:"Nacional",lji:"L.J.I",mundial:"Mundial",eventoEspecial:"Evento Especial"})[key])).join("")}</div><h3>Colocações por ciclo / competição</h3><div id="peClubPlacements">${Object.entries(raw.placements || {}).map(([id,row])=>clubRow("placements",id,row)).join("")}</div><button type="button" class="btn-gray" data-action="add-club-row" data-group="placements">Adicionar colocação</button></section>
        <section data-pane="memory" hidden><div class="pe-grid">${["bestEra","rivalries","legends","highlights"].map(key=>field(key,raw[key] || "","textarea")).join("")}</div><h3>Ex-membros · registros manuais</h3><p class="pe-help">Use para complementar períodos sem registros automáticos. Não modifica o elenco atual nem cria agentes.</p><div id="peClubFormerMembers">${Object.entries(raw.formerMembers || {}).map(([id,row])=>clubRow("formerMembers",id,row)).join("")}</div><button type="button" class="btn-gray" data-action="add-club-row" data-group="formerMembers">Adicionar ex-membro</button></section>`;
      baseline(); tab("institution"); dialog().showModal();
    } catch(error) { feedback(error.message); }
  }
  function showReview(changes, payload, title = "Revisar alterações") {
    if (!Object.keys(changes).length) return notice("Nenhuma alteração para salvar.");
    session.payload = payload;
    document.getElementById("peReview").innerHTML = `<h3>${e(title)}</h3><p class="pe-help">Confira o antes e depois. A gravação ocorre somente após confirmar.</p>${Object.entries(changes).map(([field,value]) => `<article class="pe-change"><strong>${e(labels[field] || field)}</strong><div><span>Antes</span><p>${e(summarize(field,session.raw[field]))}</p></div><div><span>Depois</span><p>${e(summarize(field,value))}</p></div></article>`).join("")}`;
    document.getElementById("peReview").hidden = false; document.getElementById("peForm").hidden = true;
    document.getElementById("peBack").hidden = false; document.getElementById("peSaveBtn").hidden = false; document.getElementById("peReviewBtn").hidden = true;
    notice("");
  }
  function review() {
    try {
      ProfileData.requireAdmin();
      const input = collect();
      if(session.type==='staff') {
        if(!session.raw.id)dialog().querySelectorAll('#peForm [data-field]').forEach(el=>{input[el.dataset.field]=fieldValue(el);});
        const kind=input.kind || session.raw.kind;
        if(kind==='linked') {
          [...StaffData.personal,'appearance'].forEach(name=>delete input[name]);
          if(session.raw.competitive===undefined)input.competitive=fieldValue(dialog().querySelector('[data-field="competitive"]'));
        } else {delete input.playerKey;delete input.competitive;}
        const rows=readHistory(), awards=readClubRows().staffAwards;
        if(JSON.stringify(rows)!==session.initialHistory)input.careerHistory=rows;
        if(JSON.stringify(awards)!==JSON.stringify(session.initialClubRows.staffAwards))input.achievements=awards;
        const next=StaffData.createRecord(session.key,session.raw,input,session.raw,StaffData.all(),'preview');
        const changes=Object.fromEntries(Object.entries(next).filter(([key,value])=>!['id','changeLog'].includes(key) && !Market.same(value,session.raw[key])));
        showReview(changes,{operation:'staff',input:ProfileData.clone(input)});return;
      }
      if (session.type === "club") {
        const groups=readClubRows();
        Object.keys(groups).forEach(group=>{if(JSON.stringify(groups[group])!==JSON.stringify(session.initialClubRows[group]))input[group]=groups[group];});
        const changes=ProfileData.prepareClub(session.raw,input);
        showReview(changes,{operation:"club",input:ProfileData.clone(input)});
        return;
      }
      const rows = readHistory();
      const achievements = readClubRows().achievements;
      if (JSON.stringify(achievements) !== JSON.stringify(session.initialClubRows.achievements)) input.achievements = achievements;
      const changedHistory = JSON.stringify(rows) !== session.initialHistory;
      const changes = ProfileData.prepareAgent(session.key, session.raw, input);
      if (changedHistory) changes.careerHistory = ProfileData.validateHistory(rows, session.raw.careerHistory, session.visible.id);
      showReview(changes, { operation: "agent", input: ProfileData.clone(input), historyRows: changedHistory ? rows : null });
    } catch (error) { notice(error.message, true); }
  }
  function reviewExit() {
    try {
      ProfileData.requireAdmin();
      if (changed()) throw Error("Salve ou cancele as alterações do cadastro antes de registrar uma saída.");
      const p = session.visible;
      if (!Object.hasOwn(AppState.jet.rosters || {}, p.club)) throw Error("O agente já está fora de uma equipe da liga.");
      const candidates = (AppState.jet.rosters[p.club] || []).filter(row => row.id || row.playerId ? (row.id || row.playerId) === p.id : `${p.club}_${row.n}` === session.key || row.n === p.name);
      const rosterName = candidates.length === 1 ? candidates[0].n : null;
      const payload = { operation: "exit", kind: document.getElementById("peExitKind").value, destination: document.getElementById("peExitTeam").value, note: document.getElementById("peExitNote").value, rosterName };
      const changes = ProfileData.prepareExit(session.key,p,payload.destination,payload.kind,payload.note,rosterName);
      showReview(changes,payload,"Confirmar saída efetiva · somente no Market");
    } catch (error) { notice(error.message,true); }
  }
  async function save() {
    if (!session || session.busy || !session.payload) return;
    session.busy = true; document.getElementById("peSaveBtn").disabled = true;
    const current = session;
    try {
      const payload = current.payload;
      const record = payload.operation === 'staff' ? await StaffData.save(current.key,payload.input,current.raw) : payload.operation === "club" ? await ProfileData.saveClub(current.key,payload.input,current.raw) : payload.operation === "exit"
        ? await ProfileData.saveExit(current.key,current.visible,payload.destination,payload.kind,payload.note,current.raw,payload.rosterName)
        : await ProfileData.saveAgent(current.key,payload.input,current.raw,payload.historyRows);
      if(payload.operation==='staff'){AppState.market.settings.staff ||= {};AppState.market.settings.staff[current.key]=record;}
      else if (payload.operation === "club") { AppState.market.settings.clubProfiles ||= {}; AppState.market.settings.clubProfiles[ProfileData.clubKey(current.key)]=record; }
      else AppState.market.players[current.key] = record;
      dialog().close(); session = null;
      window.AppRouter?.refresh();
      document.dispatchEvent(new CustomEvent("admin:record-saved"));
      feedback(payload.operation === "exit" ? "Saída salva no Market. A Jet League não foi alterada; a sincronização opcional está no perfil." : "Perfil salvo com sucesso.");
    } catch (error) { notice(error.message || "Não foi possível salvar. Seu rascunho foi preservado.",true); }
    finally { if (session === current) { current.busy = false; document.getElementById("peSaveBtn").disabled = false; } }
  }
  async function syncExit(key) {
    if (!confirm("Sincronizar esta saída na Jet League? Esta ação separada remove somente o agente do elenco de origem e não cria uma equipe externa na liga.")) return;
    try { await ProfileData.syncExit(key); feedback("Saída sincronizada na Jet League."); }
    catch (error) { feedback("O Market continua salvo. Jet League não alterada: " + error.message); }
  }
  async function removeStaff(id) {
    try {
      ProfileData.requireAdmin();
      if(session?.busy)return;
      const raw=ProfileData.clone(session?.type==='staff' && session.key===id ? session.raw : StaffData.all()[id]);
      if(!raw)throw Error('Cadastro não encontrado.');
      const linked=raw.kind==='linked';
      if(!confirm(`Excluir ${StaffData.identity(raw).name} da Comissão Técnica?${session?.key===id && changed()?' O rascunho será descartado.':''}\n${linked?'O personagem e seus históricos serão preservados. A elegibilidade de combate voltará a seguir o status do agente.':'O perfil exclusivo sairá das listagens públicas.'}\nO registro será preservado na auditoria administrativa.`))return;
      const current=session;
      if(current)current.busy=true;
      try {
        AppState.market.settings=await StaffData.remove(id,raw);
        if(current?.type==='staff' && current.key===id){dialog().close();session=null;}
        window.StaffViews?.close();window.AppRouter?.refresh();
        document.dispatchEvent(new CustomEvent('admin:record-saved'));
        feedback('Cadastro removido da Comissão Técnica.');
      } finally {if(session===current && current)current.busy=false;}
    } catch(error) {if(session)notice(error.message,true);else feedback(error.message);}
  }
  document.addEventListener("click", event => {
    if (!session || !event.target.closest("#profileEditorDialog")) return;
    const btn = event.target.closest("button");
    if (!btn || session.busy) return;
    if (btn.dataset.tab) return tab(btn.dataset.tab);
    const action = btn.dataset.action;
    if(action==='remove-staff')return removeStaff(session.key);
    if(action==='integrate-staff') {
      const key=session.key,club=Object.hasOwn(AppState.jet.rosters || {},session.visible.club) ? session.visible.club : '';
      if(!changed()){dialog().close();session=null;}
      return openStaff(null,club,key);
    }
    if (action === "close") close();
    if (action === "review") review();
    if (action === "save") save();
    if (action === "review-exit") reviewExit();
    if (action === "back") { document.getElementById("peReview").hidden = true; document.getElementById("peForm").hidden = false; btn.hidden = true; document.getElementById("peSaveBtn").hidden = true; document.getElementById("peReviewBtn").hidden = false; }
    if(action==='edit-linked'){if(changed())return notice('Salve ou descarte o rascunho antes de editar o combatente.',true);const key=session.raw.playerKey;dialog().close();session=null;openAgent(key);}
    if (action === "add-history") { const id = marketDb.ref((session.type==='staff'?'settings/staff/':'players/') + session.key + "/careerHistory").push().key; document.getElementById("peHistoryRows").insertAdjacentHTML("beforeend",historyRow(id)); }
    if (action === "remove-history" && confirm("Remover esta passagem do rascunho? A exclusão será aplicada somente ao confirmar a revisão.")) btn.closest(".pe-history-row").remove();
    if (action === "add-club-row") {
      const group=btn.dataset.group; const path=session.type==='staff' ? "settings/staff/"+session.key+"/achievements" : group==="achievements" ? "players/"+session.key+"/achievements" : "settings/clubProfiles/"+ProfileData.clubKey(session.key)+"/"+group; const id=marketDb.ref(path).push().key;
      document.getElementById(group==="staffAwards" ? "peStaffAwards" : group==="achievements" ? "peAchievements" : group==="placements" ? "peClubPlacements":"peClubFormerMembers").insertAdjacentHTML("beforeend",clubRow(group,id));
    }
    if (action === "remove-club-row" && confirm("Remover este registro do rascunho? A exclusão será aplicada somente após a revisão.")) btn.closest(".pe-record-row").remove();
  });
  document.addEventListener("change", event => {
    if(session?.type==='staff' && event.target.dataset.field==='kind'){staffIdentity();return;}
    if (session && event.target.dataset.recordField === "officialId" && event.target.closest('[data-group="achievements"],[data-group="staffAwards"]')) {
      const official = ProfileData.officialCompetitions().find(row=>row.id===event.target.value);
      if (official) {
        const row = event.target.closest('.pe-record-row');
        ["type","competitionName","season","result","teamName"].forEach(key=>{row.querySelector(`[data-record-field="${key}"]`).value=official[key];});
        row.querySelector('[data-record-field="teamKind"]').value=Object.hasOwn(AppState.jet.rosters || {},official.teamName) ? "league" : "external";
      }
      return;
    }
    if (!session || event.target.dataset.historyField !== "teamKind") return;
    const row = event.target.closest(".pe-history-row");
    row.querySelector(".pe-team-name").innerHTML = teamInput(event.target.value, row.querySelector('[data-history-field="teamName"]').value);
  });
  window.ProfileEditor = { openAgent, openClub, openStaff, removeStaff, syncExit, hasUnsavedChanges: () => !!session && !!changed() };
})();
