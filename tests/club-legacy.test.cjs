const test=require('node:test');
const assert=require('node:assert/strict');
const {context,load}=require('./helpers.cjs');
const fixture=require('./fixtures/club-legacy.cjs');
function setup(profile=fixture()) {
  const c=load(context({isMarketAdmin:()=>false}),'js/core/state.js','js/utils/format.js','js/services/market.js','js/services/profile-data.js','js/app.js','js/features/market/profile-views.js','js/features/market/club-legacy.js');
  c.AppState.jet.rosters={'KOF 12':[{n:'Jenny'},{n:'Jun'}],Other:[{n:'Homônimo'}]};
  c.AppState.market.players={'KOF 12_Jenny':{id:'jenny-1',name:'Jenny',photo:'https://example.invalid/jenny.png'},'KOF 12_Jun':{name:'Jun'}};
  c.AppState.market.settings.clubProfiles={[c.ProfileData.clubKey('KOF 12')]:profile};
  return c;
}
test('legado renderiza campanhas em ordem natural e não inventa temporadas dos contadores',()=>{
  const c=setup();const before=JSON.stringify(c.AppState);
  const html=c.ClubLegacy.body('KOF 12');
  assert.ok(html.indexOf('Temporada 1')<html.lastIndexOf('Temporada 2'));
  const campaigns=c.ClubLegacy.sortedCampaigns({ten:{cycle:'C.10'},two:{cycle:'C.2'},unknown:{notes:'Preservar período desconhecido'}});
  assert.deepEqual(Array.from(campaigns,row=>row.cycle),['C.2','C.10',undefined]);
  assert.equal(c.ClubLegacy.sortedCampaigns({one:{cycle:'C.1'},two:{cycle:'C.2'}},'desc')[0].cycle,'C.2');
  const gallery=html.slice(html.indexOf('legacy-trophy-grid'),html.indexOf('legacy-story-grid'));
  assert.match(gallery,/Temporada 2 · Temporada 3/);assert.doesNotMatch(gallery,/Temporada 1/);
  assert.equal(c.ClubLegacy.medal('10º lugar'),'');assert.equal(c.ClubLegacy.medal('1º lugar'),'gold');assert.equal(c.ClubLegacy.medal('Vice-campeão'),'silver');
  assert.equal(JSON.stringify(c.AppState),before);
  const countsOnly=setup({titles:{nacional:3}}).ClubLegacy.body('KOF 12');
  assert.match(countsOnly,/Temporadas dos títulos não registradas/);assert.doesNotMatch(countsOnly,/legacy-campaigns/);
});
test('legado omite seções vazias e mantém todos os períodos e notas dos antigos membros',()=>{
  const c=setup({});assert.equal(c.ClubLegacy.body('KOF 12'),'<div class="club-institution legacy-grid"></div>');
  assert.doesNotMatch(c.ClubLegacy.header('KOF 12',2),/Fundação|Legado campeão/);
  c.AppState.market.settings.clubProfiles[c.ProfileData.clubKey('KOF 12')]={formerMembers:{one:{name:'Jenny',fromCycle:'C.1',toCycle:'C.2',fromDate:'2026-01-02',toDate:'2026-06-03',teamName:'KOF 12',binding:'Empréstimo',notes:'Linha 1\nLinha 2'}}};
  const html=c.ClubLegacy.body('KOF 12');
  for(const text of ['C.1','C.2','2026-01-02','2026-06-03','Empréstimo','Linha 1\nLinha 2'])assert.ok(html.includes(text));
  assert.match(html,/data-premium-player="KOF 12_Jenny"/);
});
test('ídolos usam apenas correspondências únicas, preservam vírgulas e não criam personagens',()=>{
  const c=setup({legends:'Jenny\nNome, sobrenome\nHomônimo'});
  c.AppState.jet.rosters.Duplicate=[{n:'Homônimo'}];
  assert.equal(c.ClubLegacy.personEntries('Nome, sobrenome').length,1);
  const players=[{key:'one',id:'p1',name:'Homônimo'},{key:'two',id:'p2',name:'Homônimo'}];
  assert.equal(c.ClubLegacy.resolvePerson({name:'Homônimo'},players),null);
  assert.equal(c.ClubLegacy.resolvePerson({name:'Homônimo',playerId:'p2'},players).key,'two');
  assert.equal(c.ClubLegacy.resolvePerson({name:'Homônimo',playerId:'missing'},players),null);
  const html=c.ClubLegacy.body('KOF 12');
  assert.match(html,/jenny.png/);assert.match(html,/Nome, sobrenome/);
  assert.equal((html.match(/data-premium-player=/g)||[]).length,1);
});
test('legado escapa dados e não mostra auditoria administrativa ao visitante',()=>{
  const c=setup({description:'<img onerror=evil>',cover:'javascript:evil()',legends:'<script>evil</script>',bestEra:'Texto preservado',changeLog:{x:{at:1,actor:'admin',changes:{founded:{after:'C.1'}}}}});
  assert.match(c.ClubLegacy.header('KOF 12',2),/&lt;img/);assert.doesNotMatch(c.ClubLegacy.header('KOF 12',2),/src="javascript:/);
  assert.match(c.ClubLegacy.body('KOF 12'),/&lt;script/);assert.doesNotMatch(c.ClubLegacy.body('KOF 12'),/club-profile-audit/);
  c.isMarketAdmin=()=>true;assert.doesNotMatch(c.ClubLegacy.body('KOF 12'),/club-profile-audit/);assert.equal(Object.keys(c.ProfileData.clubProfile('KOF 12').changeLog).length,1);
});
