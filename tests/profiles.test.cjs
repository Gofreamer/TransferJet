const test = require('node:test');
const assert = require('node:assert/strict');
const { context, load } = require('./helpers.cjs');
function setup() {
  const c = load(context({ isMarketAdmin: () => true, getMarketAdminId: () => 'admin-1' }), 'js/core/state.js','js/utils/format.js','js/utils/valuation.js','js/services/market.js','js/services/profile-data.js','js/app.js');
  c.AppState.jet.rosters = { Alpha: [{ n:'Alice' }], Beta: [] };
  const raw = { id:'permanent-1',name:'Alice',team:'Alpha',status:'ativo',marketValue:20000000,contractUntil:'Temporada 4',stats:{P:10},custom:{preserved:true} };
  c.AppState.market.players = { Alpha_Alice: raw };
  let stored = structuredClone(raw); const writes=[];
  c.marketDb = { ref(path) { return {
    once: async () => ({val:()=>structuredClone(stored)}), push:()=>({key:'event-1'}),
    transaction:async cb => { const next=cb(structuredClone(stored)); if(next===undefined)return {committed:false}; stored=next;writes.push({path,next}); return {committed:true,snapshot:{val:()=>structuredClone(stored)}}; }
  }; } };
  return { c,raw,writes,stored:()=>stored,setStored:value=>{stored=value;} };
}
const passage = { id:'history-1',teamKind:'external',teamName:'FC Internacional',fromCycle:'C.1',toCycle:'C.2',fromDate:'',toDate:'',binding:'Empréstimo',notes:'Passagem informada pelo mestre' };
const achievement = { id:'glory-1',type:'nacional',competitionName:'Nacional C.1',result:'Campeão',teamKind:'external',teamName:'Antiga Organização',season:'C.1',date:'',notes:'Título antigo',legacySlot:'1',officialId:'' };

test('Hall da Glória associa título antigo sem alterar contadores ou outros domínios', async () => {
  const db=setup(); const {c}=db; const raw={...db.raw,titles:{nacional:2,lji:1},trophy:3}; db.setStored(raw);
  c.jetDb={ref(){throw Error('Jet não pode ser alterada');}};
  const state=JSON.stringify(c.AppState);
  const saved=await c.ProfileData.saveAgent('Alpha_Alice',{achievements:[achievement]},raw);
  assert.deepEqual(saved.titles,raw.titles);assert.equal(saved.trophy,3);
  assert.equal(saved.achievements['glory-1'].playerId,raw.id);
  assert.equal(saved.team,raw.team);assert.equal(saved.contractUntil,raw.contractUntil);assert.equal(saved.marketValue,raw.marketValue);
  assert.equal(JSON.stringify(c.AppState),state);
  assert.deepEqual(Object.keys(saved.changeLog['event-1'].changes),['achievements']);
});

test('Hall valida associações únicas, prêmios individuais, datas e equipes históricas', () => {
  const {c,raw}=setup(); const old={...raw,trophy:2};
  assert.equal(c.ProfileData.validateAchievements([achievement],old,'Alpha_Alice')['glory-1'].legacySlot,1);
  for(const rows of [
    [achievement,{...achievement,id:'two',competitionName:'Outra final'}],
    [{...achievement,legacySlot:3}], [{...achievement,type:'individual'}],
    [{...achievement,date:'2026-02-30'}], [{...achievement,teamKind:'league'}],
    [achievement,{...achievement,id:'two',legacySlot:''}]
  ]) assert.throws(()=>c.ProfileData.validateAchievements(rows,old,'Alpha_Alice'));
  const partial=c.ProfileData.validateAchievements([{id:'partial',type:'individual',teamKind:'external'}],raw,'Alpha_Alice');
  assert.equal(partial.partial.teamName,'');assert.equal(partial.partial.season,'');assert.equal(partial.partial.legacySlot,null);
  const historical={...achievement,teamKind:'league',teamKey:c.ProfileData.clubKey(achievement.teamName)};
  assert.throws(()=>c.ProfileData.prepareAgent('Alpha_Alice',{...old,achievements:{one:{...achievement,legacySlot:2}}},{titles:{nacional:1}}),/Desassocie/);
  assert.equal(c.ProfileData.validateAchievements([historical],{...old,achievements:{'glory-1':historical}},'Alpha_Alice')['glory-1'].teamKey,historical.teamKey);
});

test('Hall edita e exclui mantendo metadados e recusa concorrência sem perder atualizações de valor', async () => {
  const db=setup();const {c}=db;const raw={...db.raw,titles:{nacional:1},achievements:{'glory-1':{...achievement,legacySlot:1,extra:'conservar'}}};
  db.setStored({...raw,marketValue:30000000});
  const saved=await c.ProfileData.saveAgent('Alpha_Alice',{achievements:[{...achievement,season:'C.2'}]},raw);
  assert.equal(saved.achievements['glory-1'].extra,'conservar');assert.equal(saved.marketValue,30000000);
  await assert.rejects(c.ProfileData.saveAgent('Alpha_Alice',{achievements:[]},raw),/outra sessão/);
  const removed=await c.ProfileData.saveAgent('Alpha_Alice',{achievements:[]},saved);
  assert.deepEqual(JSON.parse(JSON.stringify(removed.achievements)),{});assert.equal(removed.titles.nacional,1);
});

test('Hall relaciona somente campeonatos com dados explícitos suficientes', () => {
  const {c,raw}=setup();c.AppState.jet.hallOfFame={incomplete:{winner:'Alpha'},official:{type:'nacional',competitionName:'Nacional C.1',season:'C.1',result:'Campeão',teamName:'Alpha'}};
  assert.equal(c.ProfileData.officialCompetitions().length,1);
  const row={...achievement,teamKind:'league',teamName:'Alpha',officialId:'official',legacySlot:''};
  assert.equal(c.ProfileData.validateAchievements([row],raw,'Alpha_Alice')['glory-1'].officialId,'official');
  assert.throws(()=>c.ProfileData.validateAchievements([{...row,season:'C.9'}],raw,'Alpha_Alice'),/vínculo oficial/);
  assert.throws(()=>c.ProfileData.validateAchievements([{...row,officialId:'incomplete'}],raw,'Alpha_Alice'),/vínculo oficial/);
});

test('Hall projeta conquistas no clube somente por vínculo explícito, sem gravar títulos institucionais', () => {
  const {c,raw}=setup();load(c,'js/features/market/profile-views.js');
  c.AppState.market.players.Alpha_Alice={...raw,achievements:c.ProfileData.validateAchievements([{...achievement,teamKind:'league',teamName:'Beta',legacySlot:''}],raw,'Alpha_Alice')};
  const before=JSON.stringify(c.AppState);
  assert.match(c.ProfileViews.clubAchievements('Beta'),/Nacional C.1/);
  assert.equal(c.ProfileViews.clubAchievements('Alpha'),'');
  c.AppState.market.players.Alpha_Alice.achievements['glory-1'].teamKind='external';
  assert.equal(c.ProfileViews.clubAchievements('Beta'),'');
  c.AppState.market.players.Alpha_Alice.achievements['glory-1'].teamKind='league';
  assert.equal(JSON.stringify(c.AppState),before);
  const html=c.ProfileViews.achievements({...c.getAllPlayersFlat()[0],achievements:{one:{type:'individual',competitionName:'<img onerror=evil>'}}});
  assert.match(html,/&lt;img/);assert.match(html,/informação não registrada/);
});

test('histórico externo conserva vínculo, valor, contrato, Fantasy e banco da liga', async () => {
  const {c,raw,writes}=setup(); const original=JSON.stringify(c.AppState);
  c.jetDb={ref(){throw Error('Jet League não pode ser escrita');}};
  const saved=await c.ProfileData.saveAgent('Alpha_Alice',{},raw,[passage]);
  assert.equal(saved.team,'Alpha');assert.equal(saved.id,'permanent-1');assert.equal(saved.marketValue,20000000);
  assert.equal(saved.contractUntil,'Temporada 4');assert.equal(saved.careerHistory['history-1'].playerId,'permanent-1');
  assert.equal(saved.careerHistory['history-1'].source,'manual');assert.equal(writes.length,1);
  assert.equal(JSON.stringify(c.AppState),original,'sem alterações otimistas em memória');
  assert.equal(saved.changeLog['event-1'].actor,'admin-1');
});

test('contratos aceitam ciclos, prazo indeterminado e datas opcionais sem conversão', () => {
  const {c,raw}=setup();
  const changes=c.ProfileData.prepareAgent('Alpha_Alice',raw,{contractStart:'C.2',contractUntil:'C.4',contractMode:'fixed'});
  assert.equal(changes.contractUntil,'C.4');assert.equal(changes.contractStartDate,undefined);
  assert.equal(c.ProfileData.contractLabel(raw),'Até Temporada 4');
  assert.equal(c.ProfileData.contractLabel({...raw,contractMode:'indefinite'}),'Contrato indeterminado');
  assert.equal(c.ProfileData.contractLabel({...raw,contractMode:'none'}),'Sem contrato');
  assert.throws(()=>c.ProfileData.prepareAgent('Alpha_Alice',raw,{contractStartDate:'2026-12-01',contractEndDate:'2026-01-01'}),/preceder/);
  assert.throws(()=>c.ProfileData.prepareAgent('Alpha_Alice',raw,{contractEndDate:'2026-02-30'}),/Data inválida/);
});

test('valida campos, números, fotos e duplicatas sem criar equipe internacional', () => {
  const {c,raw}=setup();
  for(const input of [{team:'Beta'},{marketValue:100},{name:''},{photo:'javascript:alert(1)'},{salary:-1},{age:2.5}]) assert.throws(()=>c.ProfileData.prepareAgent('Alpha_Alice',raw,input));
  assert.throws(()=>c.ProfileData.validateHistory([passage,{...passage,id:'other'}],{},raw.id),/equivalente/);
  assert.throws(()=>c.ProfileData.validateHistory([{...passage,teamKind:'league'}],{},raw.id),/equipe externa/);
  const free=c.ProfileData.validateHistory([{...passage,teamKind:'free',teamName:''}],{},raw.id);
  assert.equal(free['history-1'].teamName,'Livre');assert.equal(Object.keys(c.AppState.jet.rosters).length,2);
});

test('alteração histórica preserva atualização paralela de valor e recusa histórico desatualizado', async () => {
  const db=setup();const {c,raw}=db;
  db.setStored({...raw,marketValue:25000000,stats:{P:20}});
  const saved=await c.ProfileData.saveAgent('Alpha_Alice',{},raw,[passage]);
  assert.equal(saved.marketValue,25000000);assert.equal(saved.stats.P,20);
  const count=db.writes.length;
  await assert.rejects(c.ProfileData.saveAgent('Alpha_Alice',{},raw,[{...passage,toCycle:'C.3'}]),/outra sessão/);
  assert.equal(db.writes.length,count);
  db.setStored({...raw,id:'changed-identity'});
  await assert.rejects(c.ProfileData.saveAgent('Alpha_Alice',{nationality:'Brasil'},raw),/identidade/);
});

test('edita e exclui passagens individualmente conservando propriedades e registros oficiais', async () => {
  const db=setup();const {c}=db;
  const raw={...db.raw,careerHistory:{'history-1':{...passage,extra:'manter'},old:{...passage,id:'old',teamName:'Outra equipe'}}};
  db.setStored(raw);
  const saved=await c.ProfileData.saveAgent('Alpha_Alice',{},raw,[{...passage,toCycle:'C.3'}]);
  assert.equal(saved.careerHistory.old,undefined);assert.equal(saved.careerHistory['history-1'].extra,'manter');
  assert.equal(saved.careerHistory['history-1'].toCycle,'C.3');assert.equal(saved.team,'Alpha');
  assert.deepEqual(Object.keys(saved.changeLog['event-1'].changes),['careerHistory']);
});

test('visualização reúne passagem equivalente e mantém origem oficial e manual', () => {
  const {c}=setup();
  const rows=c.ProfileData.careerRows({careerHistory:{one:{...passage,teamName:'Beta',fromCycle:'C.1',toCycle:'C.2'}}},[{club:'Beta',from:'C.1',to:'C.2',fee:100}]);
  assert.equal(rows.length,1);assert.equal(rows[0].fee,100);
  assert.deepEqual(Array.from(rows[0].origins),['official','manual']);
});

test('saída efetiva altera só o vínculo Market e mantém chave, histórico e valor', async () => {
  const {c,raw,writes}=setup(); const player=c.getAllPlayersFlat()[0];
  c.jetDb={ref(){throw Error('Não sincronizar automaticamente');}};
  const saved=await c.ProfileData.saveExit('Alpha_Alice',player,'Internacional FC','external','Saída confirmada',raw,'Alice');
  assert.equal(saved.team,'Internacional FC');assert.equal(saved.status,'fora-liga');assert.equal(saved.marketValue,raw.marketValue);
  assert.equal(saved.id,raw.id);assert.equal(saved.leagueExit.rosterName,'Alice');assert.equal(writes[0].path,'players/Alpha_Alice');
  c.AppState.market.players.Alpha_Alice=saved;
  assert.equal(c.getAllPlayersFlat().length,1);assert.equal(c.getAllPlayersFlat()[0].fantasyEligible,false);
});

test('acesso não autenticado bloqueia salvamento antes de qualquer leitura ou escrita', async () => {
  const {c,raw,writes}=setup(); c.isMarketAdmin=()=>false;
  await assert.rejects(c.ProfileData.saveAgent('Alpha_Alice',{name:'Outro'},raw),/administrador/);
  assert.equal(writes.length,0);
});

test('títulos editados conservam títulos legados e não recalculam valor', () => {
  const {c}=setup();
  const delta=c.ProfileData.prepareAgent('Alpha_Alice',{trophy:3,marketValue:10000000},{titles:{lji:1}});
  assert.equal(delta.titles.nacional,3);assert.equal(delta.trophy,4);assert.equal(delta.marketValue,undefined);
});

test('sincronização opcional de saída remove somente a origem e recusa repetição/ambiguidade', async () => {
  const db=setup(); const {c,raw}=db;
  const saved=await c.ProfileData.saveExit('Alpha_Alice',c.getAllPlayersFlat()[0],'FC Externo','external','',raw,'Alice');
  db.setStored(saved);
  let rosters={Alpha:[{n:'Alice'},{n:'Outro'}],Beta:[{n:'Bob'}]};let writes=0;
  c.jetDb={ref(path){assert.equal(path,'liga/rosters');return {once:async()=>({val:()=>rosters}),transaction:async cb=>{const next=cb(rosters);if(!next)return {committed:false};rosters=next;writes++;return {committed:true};}};}};
  await c.ProfileData.syncExit('Alpha_Alice');
  assert.equal(rosters.Alpha.length,1);assert.equal(rosters.Beta[0].n,'Bob');assert.equal(rosters['FC Externo'],undefined);assert.equal(writes,1);
  await assert.rejects(c.ProfileData.syncExit('Alpha_Alice'),/Nenhum elenco/);
  assert.equal(writes,1);
});

test('dados institucionais usam configurações do Market, preservando metadados e edições paralelas', async () => {
  const {c}=setup();let current={description:'Antes',custom:{keep:true}};const expected=structuredClone(current);const paths=[];
  current={...current,cover:'https://example.invalid/new.jpg'};
  c.marketDb={ref(path){paths.push(path);return {once:async()=>({val:()=>current}),push:()=>({key:'club-event'}),transaction:async cb=>{const next=cb(structuredClone(current));if(!next)return {committed:false};current=next;return {committed:true,snapshot:{val:()=>current}};}};}};
  const saved=await c.ProfileData.saveClub('Alpha',{description:'Nova descrição',titles:{mundial:2},placements:[{id:'p1',competition:'Mundial',cycle:'C.2',place:'Finalista',notes:''}]},expected);
  assert.equal(saved.cover,'https://example.invalid/new.jpg');assert.equal(saved.custom.keep,true);assert.equal(saved.titles.mundial,2);
  assert.equal(saved.placements.p1.cycle,'C.2');assert.equal(saved.changeLog['club-event'].actor,'admin-1');
  assert.equal(paths.every(p=>p.startsWith('settings/clubProfiles/')),true);
  await assert.rejects(c.ProfileData.saveClub('Alpha',{description:'Desatualizada'},expected),/outra sessão/);
});

test('equipes mantêm nomes completos, não criam organizações e recusam números e linhas inválidas', async () => {
  const {c}=setup();
  assert.notEqual(c.ProfileData.clubKey('Á/b.c'),c.ProfileData.clubKey('A/b.c'));
  assert.equal(c.ProfileData.safeKey(c.ProfileData.clubKey('Á/b.c')),true);
  assert.throws(()=>c.ProfileData.prepareClub({}, {rosters:{}}),/protegido/);
  assert.throws(()=>c.ProfileData.prepareClub({}, {titles:{mundial:-1}}),/número/);
  assert.throws(()=>c.ProfileData.prepareClub({}, {placements:[{id:'a',competition:''}]}),/Preencha/);
  await assert.rejects(c.ProfileData.saveClub('Internacional FC',{description:'teste'},{}),/cadastrada/);
});
