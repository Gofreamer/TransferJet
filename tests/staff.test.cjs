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
