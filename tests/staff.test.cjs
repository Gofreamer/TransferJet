const test=require('node:test');const assert=require('node:assert/strict');const {context,load}=require('./helpers.cjs');
function setup(){
  const c=load(context({isMarketAdmin:()=>true,getMarketAdminId:()=> 'admin-1',addEventListener(){}}),'js/core/state.js','js/utils/format.js','js/services/market.js','js/services/profile-data.js','js/services/staff.js','js/app.js','js/features/market/profile-views.js','js/features/market/staff-views.js');
  c.AppState.jet.rosters={Alpha:[{n:'Alice'}],Beta:[]};c.AppState.market.players={Alpha_Alice:{id:'alice-id',name:'Alice',marketValue:20000000,titles:{nacional:1},contractUntil:'C.4'}};
  let stored={},serial=0;const writes=[];
  c.marketDb={ref:path=>({once:async()=>({val:()=>structuredClone(stored)}),push:()=>({key:'event-'+(++serial)}),transaction:async callback=>{const next=callback(structuredClone(stored));if(next===undefined)return {committed:false};stored=next;writes.push({path});return {committed:true,snapshot:{val:()=>structuredClone(stored)}};}})};
  c.jetDb={ref(){throw Error('Jet não deve ser alterada');}};
  return {c,writes,stored:()=>stored,setStored:value=>{stored=value;}};
}
const exclusive={kind:'exclusive',name:'Manager independente',role:'Manager',teamKind:'league',teamName:'Alpha',status:'active',principal:'true',startCycle:'C.1',contractMode:'indefinite',appearance:'Descrição informada'};
test('manager exclusivo permanece fora dos combatentes e grava somente configurações com auditoria',async()=>{
  const {c,writes}=setup();const before=JSON.stringify(c.AppState);
  const row=await c.StaffData.save('staff-1',exclusive,{});
  assert.equal(row.id,'staff-1');assert.equal(row.contractMode,'indefinite');assert.equal(row.changeLog['event-1'].actor,'admin-1');
  assert.deepEqual(writes,[{path:'settings/staff'}]);assert.equal(JSON.stringify(c.AppState),before);assert.equal(c.getAllPlayersFlat().length,1);
  c.AppState.market.settings.staff={'staff-1':row};assert.equal(c.getAllPlayersFlat().length,1);
  assert.match(c.StaffViews.team('Alpha'),/staff-principal/);
});
test('combatente vinculado mantém identidade, contrato, títulos e preço sem criar outro jogador',async()=>{
  const {c}=setup();const before=JSON.stringify(c.AppState.market.players);
  const row=await c.StaffData.save('linked',{kind:'linked',playerKey:'Alpha_Alice',role:'Coach',teamKind:'league',teamName:'Alpha',principal:'false',status:'active',contractUntil:'C.8'},{});
  assert.equal(row.playerId,'alice-id');assert.equal(row.name,undefined);assert.equal(c.StaffData.identity(row).name,'Alice');
  assert.equal(JSON.stringify(c.AppState.market.players),before);assert.equal(row.contractUntil,'C.8');
  await assert.rejects(c.StaffData.save('second',{kind:'linked',playerKey:'Alpha_Alice',role:'Manager',teamKind:'league',teamName:'Beta',status:'active'},{}),/já possui/);
  assert.throws(()=>c.StaffData.prepare('linked',row,{name:'Cópia'}),/cadastro do combatente/);
});
test('principal único, identidade permanente e edições simultâneas são protegidos por transação',async()=>{
  const db=setup(),{c}=db;const first=await c.StaffData.save('first',exclusive,{});
  await assert.rejects(c.StaffData.save('second',{...exclusive,name:'Outra pessoa'},{}),/responsável principal/);
  db.setStored({...db.stored(),first:{...first,notes:'outra sessão'}});
  await assert.rejects(c.StaffData.save('first',{notes:'rascunho'},first),/outra sessão/);
  const saved=await c.StaffData.save('first',{photo:'https://example.invalid/p.png'},first);
  assert.equal(saved.notes,'outra sessão');assert.equal(saved.name,first.name);
  assert.throws(()=>c.StaffData.prepare('other',first,{notes:'x'}),/identidade permanente/);
});
test('saída e mudança de cargo preservam passagem profissional sem datas inventadas',async()=>{
  const {c}=setup();const first=await c.StaffData.save('one',exclusive,{});
  const ended=await c.StaffData.save('one',{status:'ended',endCycle:'C.3'},first);
  const past=Object.values(ended.careerHistory)[0];assert.equal(past.fromCycle,'C.1');assert.equal(past.toCycle,'C.3');assert.equal(past.toDate,'');assert.equal(ended.principal,false);
  c.AppState.market.settings.staff={one:ended};assert.match(c.StaffViews.team('Alpha'),/Ex-managers/);
  const returned=await c.StaffData.save('one',{status:'active',teamName:'Beta',startCycle:'C.4'},ended);
  const changed=await c.StaffData.save('one',{role:'Coach'},returned);
  assert.equal(changed.startCycle,'');assert.equal(Object.values(changed.careerHistory).length,2);
  assert.equal(c.AppState.market.players.Alpha_Alice.contractUntil,'C.4');
});
test('histórico e conquistas da comissão são independentes e aceitam equipes externas e prêmios individuais',async()=>{
  const {c}=setup();const first=await c.StaffData.save('one',exclusive,{});
  const input={careerHistory:[{id:'external',teamKind:'external',teamName:'Organização internacional',fromCycle:'C.0',toCycle:'C.1',binding:'Coach'}],achievements:[{id:'award',type:'individual',teamKind:'external',teamName:'Organização internacional',competitionName:'Prêmio de treinador',result:'Melhor coach',season:'C.1'}]};
  const saved=await c.StaffData.save('one',input,first);
  assert.equal(saved.teamName,'Alpha');assert.equal(saved.achievements.award.staffId,'one');assert.equal(saved.achievements.award.playerId,undefined);
  assert.equal(c.AppState.market.players.Alpha_Alice.titles.nacional,1);assert.equal(c.AppState.jet.rosters['Organização internacional'],undefined);
  const removed=await c.StaffData.save('one',{achievements:[]},saved);assert.equal(Object.keys(removed.achievements).length,0);
});
test('comissão recusa acesso não autenticado, datas, valores e referência ambígua ou alterada',async()=>{
  const {c,writes}=setup();for(const changes of [{photo:'javascript:evil'},{age:-1},{salary:-1},{startDate:'2026-02-30'},{marketValue:1},{teamName:'Equipe inventada'}])assert.throws(()=>c.StaffData.prepare('one',{}, {...exclusive,...changes}));
  c.isMarketAdmin=()=>false;await assert.rejects(c.StaffData.save('one',exclusive,{}),/administrador/);assert.equal(writes.length,0);
});


test('elegibilidade preserva agente comum e legado; novo vínculo é somente comissão e pode voltar ao combate',async()=>{
  const {c}=setup();const player=c.getAllPlayersFlat()[0];
  const beforePlayers=JSON.stringify(c.AppState.market.players),beforeJet=JSON.stringify(c.AppState.jet);
  assert.equal(c.isCompetitivePlayer(player),true);
  const row=await c.StaffData.save('linked',{kind:'linked',playerKey:player.key,role:'Coach',teamKind:'league',teamName:'Alpha',status:'active'},{});
  assert.equal(row.competitive,false);
  c.AppState.market.settings.staff={linked:row};
  assert.equal(c.isCompetitivePlayer(player),false);
  assert.equal(c.getAllPlayersFlat().length,1);
  assert.equal(c.StaffData.identity(row).name,'Alice');
  assert.equal(c.getClubMarketValue('Alpha'),0);assert.equal(c.getTotalMarketValue(),0);
  assert.doesNotMatch(c.StaffViews.team('Alpha'),/Também combatente/);
  assert.equal(c.getCareerHistory(player.key,player.name,player.club).length,1);
  const returned=await c.StaffData.save('linked',{competitive:true},row);
  c.AppState.market.settings.staff.linked=returned;
  assert.equal(c.isCompetitivePlayer(player),true);assert.equal(c.getClubMarketValue('Alpha'),20000000);
  assert.match(c.StaffViews.team('Alpha'),/Também combatente/);
  assert.equal(JSON.stringify(c.AppState.market.players),beforePlayers);assert.equal(JSON.stringify(c.AppState.jet),beforeJet);
  assert.equal(Object.keys(c.AppState.market.settings.staff).length,1);
  assert.equal(Object.keys(c.AppState.market.players).length,1);
  delete c.AppState.market.settings.staff.linked.competitive;
  assert.equal(c.isCompetitivePlayer(player),true);
  const legacy=c.StaffData.prepare('linked',c.AppState.market.settings.staff.linked,{notes:'Edição antiga'});
  assert.equal(Object.hasOwn(legacy,'competitive'),false);
  c.AppState.market.settings.staff.linked.playerId='outro-id';
  assert.equal(c.isCompetitivePlayer(player),true,'Referência inválida não afeta outro personagem');
});

test('somente comissão impede novas contratações e snapshots competitivos sem modificar Fantasy histórico',async()=>{
  const {c}=setup();load(c,'js/features/fantasy/fantasy-state.js','js/features/fantasy/fantasy-market.js','js/features/fantasy/fantasy-scoring.js','js/features/fantasy/fantasy-rounds.js');
  c.ensureFantasyState();c.AppState.fantasy.settings={...c.FANTASY.DEFAULTS,currentRoundId:'r1',seasonId:'T2'};
  for(const [team,names] of Object.entries({Beta:['B1','B2'],Gamma:['G1','G2'],Delta:['D1']})) {
    c.AppState.jet.rosters[team]=names.map(n=>({n}));
    names.forEach(name=>{c.AppState.market.players[team+'_'+name]={name,marketValue:1000000,status:'ativo'};});
  }
  const player=c.getAllPlayersFlat()[0];
  const participant={displayName:'Teste',budgetRemaining:5000000,squad:{starters:[player.key,'Beta_B1','Beta_B2','Gamma_G1','Gamma_G2'],bench:'Delta_D1',captainKey:player.key}};
  const snapshot=c.buildFantasySnapshot({human1:participant},c.getAllPlayersFlat(),c.fantasySettings(),'2026-10-16T00:00:00Z');
  const round={id:'old',seasonId:'T2',rodadaNumber:1,snapshot};
  const matches={official:{temporada:'T2',rodada:1,timeA:'Alpha',timeB:'Beta',scoreA:2,scoreB:0,fights:[{teamA:{agents:['Alice']},teamB:{agents:['B1']}}],seriesMvp:{agent:'Alice'}}};
  assert.equal(snapshot.participants.human1.valid,true);
  const historical=c.processFantasyRound(round,{}, {matches});
  assert.ok(historical.scores.human1.breakdown.find(row=>row.playerId===player.id).points>0);
  c.AppState.fantasy.rounds={old:round};c.AppState.fantasy.scores={old:historical};c.AppState.fantasy.participants={human1:participant};
  const before=JSON.stringify(c.AppState.fantasy);
  const row=await c.StaffData.save('linked',{kind:'linked',playerKey:player.key,role:'Manager',teamKind:'league',teamName:'Alpha',status:'active',competitive:false},{});
  c.AppState.market.settings.staff={linked:row};
  assert.equal(c.fantasyPlayerMap()[player.key],undefined);assert.equal(c.teamSquadValue('Alpha'),0);
  assert.equal(c.tryAddToSquad({budgetRemaining:5000000,squad:c.emptySquad()},player.key,0).ok,false);
  assert.equal(c.validateSquad(participant.squad,participant.budgetRemaining).ok,false);
  const next=c.buildFantasySnapshot({human1:participant},c.getAllPlayersFlat(),c.fantasySettings());
  assert.equal(next.participants.human1.valid,false);assert.equal(next.teamValues.Alpha,undefined);
  assert.equal(next.players[player.key].marketValue,20000000);
  assert.equal(JSON.stringify(c.processFantasyRound(round,{}, {matches})),JSON.stringify(historical));
  assert.equal(JSON.stringify(c.AppState.fantasy),before);
  c.AppState.market.settings.staff.linked={...row,competitive:true};
  assert.ok(c.fantasyPlayerMap()[player.key]);assert.equal(c.teamSquadValue('Alpha'),20000000);
  assert.equal(c.tryAddToSquad({budgetRemaining:5000000,squad:c.emptySquad()},player.key,0).ok,true);
  c.AppState.market.players.Alpha_Alice.status='aposentado';
  assert.equal(c.fantasyPlayerMap()[player.key],undefined);
  assert.equal(c.getAllPlayersFlat().find(p=>p.key===player.key).status,'aposentado');
});


test('exclusão da comissão é autenticada, preserva auditoria e outros dados e recusa revisão desatualizada',async()=>{
  const db=setup(),{c,writes}=db;
  const first=await c.StaffData.save('one',exclusive,{});
  const linked=await c.StaffData.save('linked',{kind:'linked',playerKey:'Alpha_Alice',role:'Coach',teamKind:'league',teamName:'Alpha',status:'active',competitive:false},{});
  const players=JSON.stringify(c.AppState.market.players),jet=JSON.stringify(c.AppState.jet);
  db.setStored({currency:'USD',staff:db.stored(),staffArchive:{older:{record:{id:'older',name:'Antigo'}}}});
  c.AppState.market.settings=db.stored();
  c.isMarketAdmin=()=>false;await assert.rejects(c.StaffData.remove('one',first),/administrador/);c.isMarketAdmin=()=>true;
  const changed={...first,notes:'outra sessão'};db.setStored({...db.stored(),staff:{...db.stored().staff,one:changed}});
  await assert.rejects(c.StaffData.remove('one',first),/outra sessão/);
  const result=await c.StaffData.remove('one',changed);
  assert.equal(result.staff.one,undefined);assert.equal(result.staff.linked.id,linked.id);assert.equal(result.currency,'USD');
  assert.equal(result.staffArchive.one.record.notes,'outra sessão');assert.ok(result.staffArchive.one.record.changeLog);assert.equal(result.staffArchive.one.actor,'admin-1');assert.ok(result.staffArchive.older);
  const removed=await c.StaffData.remove('linked',linked);c.AppState.market.settings=removed;
  assert.equal(c.isCompetitivePlayer(c.getAllPlayersFlat()[0]),true);
  assert.equal(JSON.stringify(c.AppState.market.players),players);assert.equal(JSON.stringify(c.AppState.jet),jet);
  assert.equal(writes.at(-1).path,'settings');
});

test('cadastro Market sem team sobrevive à remoção da Jet League com identidade, contrato e histórico',()=>{
  const {c}=setup();const key='Alpha_Alice';
  c.AppState.market.players[key].photo='https://example.invalid/alice.png';
  c.AppState.market.players[key].careerHistory={old:{teamKind:'external',teamName:'Internacional',fromCycle:'C.1'}};
  c.AppState.market.settings.staff={linked:{id:'linked',kind:'linked',playerId:'alice-id',playerKey:key,role:'Coach',competitive:false}};
  const before=JSON.stringify(c.AppState.market.players);
  c.AppState.jet.rosters.Alpha=[];
  const player=c.getAllPlayersFlat().find(p=>p.key===key);
  assert.equal(player.id,'alice-id');assert.equal(player.name,'Alice');assert.equal(player.club,'Fora da Jet League');assert.equal(player.status,'ativo');
  assert.equal(player.fantasyEligible,false);assert.equal(player.marketValue,20000000);assert.equal(player.contractUntil,'C.4');assert.equal(player.careerHistory.old.teamName,'Internacional');
  assert.equal(c.StaffData.identity(c.StaffData.all().linked).photo,player.photo);
  assert.equal(JSON.stringify(c.AppState.market.players),before);assert.equal(c.getAllPlayersFlat().length,1);
});
