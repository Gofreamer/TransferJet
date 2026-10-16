const test=require('node:test');
const assert=require('node:assert/strict');
const {context,load}=require('./helpers.cjs');
function setup() {
  const c=load(context({addEventListener(){}}),'js/core/state.js','js/utils/format.js','js/services/market.js','js/services/profile-data.js','js/app.js','js/features/market/premium-ui.js','js/features/admin/admin-control.js');
  c.AppState.jet.rosters={'Águias':[{n:'Álice'}],Beta:[{n:'Bob'}]};
  c.AppState.market.players={'Águias_Álice':{name:'Álice',rank:'Rank A',status:'ativo',statsSeason:'C.2',careerHistory:{one:{fromCycle:'C.1'}},achievements:{one:{season:'C.3'}}},Beta_Bob:{name:'Bob',rank:'Rank B',status:'suspenso'}};
  return c;
}
test('pesquisa administrativa reutiliza busca sem acentos e conserva a chave permanente',()=>{
  const c=setup();assert.equal(c.AdminControl.searchResults('alice')[0].key,'Águias_Álice');
  assert.equal(c.AdminControl.searchResults('AGUIAS')[0].kind,'club');
  assert.equal(c.AdminControl.searchResults('   ').length,0);
});
test('filtros administrativos combinam equipe, status, rank e ciclos realmente registrados',()=>{
  const c=setup(),players=c.getAllPlayersFlat();
  assert.equal(c.AdminControl.filterPlayers(players,{query:'ALICE',club:'Águias',rank:'A',status:'ativo',season:'C.1'}).length,1);
  assert.equal(c.AdminControl.filterPlayers(players,{status:'suspenso',season:'C.1'}).length,0);
  assert.deepEqual(Array.from(c.AdminControl.seasons(players[0])),['C.2','C.1','C.3']);
  assert.equal(c.AdminControl.filterPlayers(players,{season:'C.99'}).length,0);
});
test('central oferece as ferramentas existentes e bloqueia editor sem autenticação',()=>{
  const c=setup();for(const id of ['home','agents','clubs','transfers','history','rumors','fantasy','import','ai','backup','photos','values'])assert.ok(c.AdminControl.tasks.some(row=>row[0]===id));
  const before=JSON.stringify(c.AppState);
  assert.throws(()=>c.AdminControl.openEditor('player','Águias_Álice','career'),/administrador/);
  assert.equal(JSON.stringify(c.AppState),before);
});
