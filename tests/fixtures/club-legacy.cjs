// Dados fictícios exclusivos dos testes e da prévia local.
module.exports = function legacyFixture() {
  return {
    founded:'C.1', description:'DEMONSTRAÇÃO · Uma organização construída ao longo dos ciclos. Estes dados são fictícios e servem apenas para visualizar o novo perfil.',
    titles:{nacional:2,lji:0,mundial:0,eventoEspecial:0},
    placements:{third:{competition:'Nacional',cycle:'Temporada 3',place:'1º lugar',notes:'Campanha de demonstração.'},first:{competition:'Nacional',cycle:'Temporada 1',place:'10º lugar',notes:'Primeiros passos da organização.'},second:{competition:'Nacional',cycle:'Temporada 2',place:'1º lugar',notes:'Um novo capítulo competitivo.'}},
    bestEra:'Temporadas 2 e 3 · exemplo de fase histórica cadastrada pelo administrador.',
    rivalries:'Organização rival · exemplo fictício',
    legends:'Jenny\nJun\nÍdolo externo de demonstração', highlights:'Malenia Bianchi',
    formerMembers:{one:{name:'Jenny',fromCycle:'C.1',toCycle:'C.2',notes:'Passagem histórica de demonstração; não altera o elenco atual.'},two:{name:'Ex-integrante internacional',fromCycle:'C.1',toCycle:'C.3',binding:'Empréstimo',notes:'Nome livre, sem criação de personagem.'}}
  };
};
