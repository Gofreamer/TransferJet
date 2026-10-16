/* Comissão técnica vive nas configurações do Market, separada dos combatentes. */
(function () {
  const personal=['name','photo','nationality','age','bio','description'];
  const contract=['contractMode','contractStart','contractStartDate','contractUntil','contractEndDate','salary','releaseClause'];
  const binding=['teamKind','teamName','role','principal','status','startCycle','startDate','endCycle','endDate'];
  const same=Market.same;
  function all() {return AppState.market.settings?.staff || {};}
  function forPlayer(player) {
    return Object.values(all()).find(row=>row.kind==='linked' && row.playerKey===player.key && row.playerId===(player.id || 'legacy:'+player.key));
  }
  function isCombatant(player) {return forPlayer(player)?.competitive !== false;}
  function identity(row) {
    if(row.kind!=='linked')return row;
    const player=getAllPlayersFlat().find(p=>p.key===row.playerKey && p.id===row.playerId);
    return player ? {...row,name:player.name,photo:player.photo,nationality:player.nationality,age:player.age,bio:player.bio,description:player.description} : {...row,name:'Combatente vinculado indisponível',photo:''};
  }
  function history(rows,original,id) {
    const result=ProfileData.validateHistory(rows,original,'staff:'+id);
    return Object.fromEntries(Object.entries(result).map(([key,row])=>{const {playerId,...rest}=row;return [key,{...rest,source:original?.[key]?.source || rest.source,staffId:id}];}));
  }
  function awards(rows,raw,id) {
    if(rows.some(row=>row.legacySlot))throw Error('Conquistas da comissão não se associam aos contadores de combatentes.');
    const result=ProfileData.validateAchievements(rows,{id:'staff:'+id,achievements:raw.achievements || {}},id);
    return Object.fromEntries(Object.entries(result).map(([key,row])=>{const {playerId,...rest}=row;return [key,{...rest,staffId:id}];}));
  }
  function prepare(id,raw,input) {
    if(!ProfileData.safeKey(id))throw Error('Identidade da comissão inválida.');
    if(raw.id && raw.id!==id)throw Error('A identidade permanente da comissão não pode ser alterada.');
    const allowed=[...personal,...contract,...binding,'appearance','notes','kind','playerKey','careerHistory','achievements','competitive'];
    if(Object.keys(input).some(key=>!allowed.includes(key)))throw Error('Campo protegido da comissão.');
    const proposedKind=input.kind || raw.kind || 'exclusive';
    if(!['exclusive','linked'].includes(proposedKind) || raw.kind && proposedKind!==raw.kind)throw Error('O tipo da pessoa não pode ser alterado.');
    const changes={};
    if(!raw.kind)changes.kind=proposedKind;
    if(proposedKind==='linked') {
      if(personal.some(key=>key in input) || 'appearance' in input)throw Error('Edite nome, foto e informações no cadastro do combatente vinculado.');
      const key=input.playerKey || raw.playerKey;
      const player=getAllPlayersFlat().find(p=>p.key===key);
      if(!player || raw.playerId && (raw.playerId!==player.id || raw.playerKey!==key))throw Error('Combatente ausente ou identidade alterada.');
      if(!raw.playerId){changes.playerId=player.id;changes.playerKey=player.key;}
      if('competitive' in input) {
        if(![true,false,'true','false'].includes(input.competitive))throw Error('Participação competitiva inválida.');
        changes.competitive=input.competitive===true || input.competitive==='true';
      } else if(!raw.id)changes.competitive=false;
    } else if(input.playerKey)throw Error('Cadastro exclusivo não pode copiar um combatente.');
    const base={};
    [...(proposedKind==='exclusive' ? personal:[]),...contract].forEach(key=>{if(key in input)base[key]=input[key];});
    Object.assign(changes,ProfileData.prepareAgent(id,raw,base));
    Object.entries(input).forEach(([key,value])=>{
      if(['appearance','notes',...binding].includes(key)) {
        const next=key==='principal' ? (value===true || value==='true') : key.endsWith('Date') ? ProfileData.date(value) : ProfileData.text(value);
        if(!same(next,raw[key]))changes[key]=next;
      }
    });
    if('careerHistory' in input)changes.careerHistory=history(input.careerHistory,raw.careerHistory,id);
    if('achievements' in input)changes.achievements=awards(input.achievements,raw,id);
    const next={...raw,...changes};
    if(raw.id && ['teamKind','teamName','role'].some(key=>key in changes))['startCycle','startDate','endCycle','endDate'].forEach(key=>{if(!(key in input)){changes[key]='';next[key]='';}});
    if(proposedKind==='exclusive' && !next.name?.trim())throw Error('Informe o nome do manager ou coach.');
    if(!['Manager','Coach'].includes(next.role))throw Error('Escolha Manager ou Coach.');
    if(!['active','ended'].includes(next.status))throw Error('Situação do vínculo inválida.');
    if(!['league','external','none'].includes(next.teamKind))throw Error('Tipo de organização inválido.');
    if(next.teamKind==='none') {next.teamName='';next.principal=false;}
    else if(!next.teamName?.trim())throw Error('Informe a organização atual.');
    if(next.teamKind==='league' && !Object.hasOwn(AppState.jet.rosters || {},next.teamName) && !(raw.teamKind==='league' && raw.teamName===next.teamName))throw Error('Equipe não cadastrada. Use organização externa.');
    if(next.status==='ended')next.principal=false;
    if(next.principal && next.teamKind!=='league')throw Error('O slot principal pertence a uma equipe cadastrada na liga.');
    if(next.startDate && next.endDate && next.startDate>next.endDate)throw Error('A saída não pode preceder a entrada.');
    ['teamName','principal'].forEach(key=>{if(!same(next[key],raw[key]))changes[key]=next[key];});
    Object.keys(changes).forEach(key=>{if(same(changes[key],raw[key]))delete changes[key];});
    return changes;
  }
  function createRecord(id,current,input,expected,collection,eventId) {
    current=current || {};
    if(expected.id ? current.id!==expected.id : Object.keys(current).length)throw Error('O cadastro foi alterado. Reabra o editor.');
    const changes=prepare(id,expected,input);
    for(const key of Object.keys(changes))if(!same(current[key],expected[key]))throw Error('A comissão foi alterada em outra sessão. Reabra o editor.');
    if(binding.some(key=>key in changes) && binding.some(key=>!same(current[key],expected[key])))throw Error('O vínculo mudou em outra sessão. Revise antes de salvar.');
    const next={...current,...changes,id};
    if(next.kind==='linked' && Object.entries(collection || {}).some(([key,row])=>key!==id && row.playerId===next.playerId))throw Error('Este combatente já possui cadastro na comissão. Edite o registro existente.');
    if(next.principal && Object.entries(collection || {}).some(([key,row])=>key!==id && row.status==='active' && row.principal && row.teamKind==='league' && row.teamName===next.teamName))throw Error('A equipe já tem um responsável principal. Encerre ou desmarque o vínculo anterior primeiro.');
    const moved=current.id && current.status==='active' && current.teamName && (next.status==='ended' || current.teamName!==next.teamName || current.teamKind!==next.teamKind || current.role!==next.role);
    if(moved)next.careerHistory={...(next.careerHistory || {}),[eventId+'-role']:{staffId:id,teamKind:current.teamKind,teamName:current.teamName,binding:current.role,fromCycle:current.startCycle || '',fromDate:current.startDate || '',toCycle:next.status==='ended' ? next.endCycle || '':current.endCycle || '',toDate:next.status==='ended' ? next.endDate || '':current.endDate || '',notes:(next.status==='ended'?next.notes:current.notes) || '',source:'staff-affiliation'}};
    const delta={};Object.keys(next).forEach(key=>{if(!['id','changeLog'].includes(key) && !same(next[key],current[key]))delta[key]={before:current[key] ?? null,after:next[key] ?? null};});
    if(!Object.keys(delta).length)return current;
    next.changeLog={...(current.changeLog || {}),[eventId]:{at:Date.now(),source:'staff-admin',actor:window.getMarketAdminId?.() || null,changes:delta}};
    return next;
  }
  async function save(id,input,expected={}) {
    ProfileData.requireAdmin();prepare(id,expected,input);
    const ref=marketDb.ref('settings/staff');await ref.once('value');const eventId=ref.push().key;let failure;
    const result=await ref.transaction(value=>{
      const current=value || {};
      try{return {...current,[id]:createRecord(id,current[id],input,expected,current,eventId)};}
      catch(error){failure=error;return;}
    },undefined,false);
    if(!result.committed)throw failure || Error('Não foi possível confirmar a gravação.');
    return result.snapshot.val()[id];
  }
  async function remove(id,expected) {
    ProfileData.requireAdmin();
    if(!ProfileData.safeKey(id) || !expected?.id || expected.id!==id)throw Error('Cadastro da comissão inválido.');
    const ref=marketDb.ref('settings');let failure;
    const deletedAt=Date.now(),actor=window.getMarketAdminId?.() || null;
    const result=await ref.transaction(value=>{
      if(!value?.staff?.[id] || !same(value.staff[id],expected)){failure=Error('O cadastro foi alterado em outra sessão. Reabra antes de excluir.');return;}
      const staff={...value.staff};delete staff[id];
      return {...value,staff,staffArchive:{...(value.staffArchive || {}),[id]:{record:value.staff[id],deletedAt,actor,source:'staff-admin-delete'}}};
    },undefined,false);
    if(!result.committed)throw failure || Error('Não foi possível confirmar a exclusão.');
    return result.snapshot.val();
  }
  window.StaffData={all,forPlayer,isCombatant,identity,prepare,createRecord,save,remove,personal,contract,binding};
})();
