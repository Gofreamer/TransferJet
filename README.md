# Jet Market

**Global Agent Database** da Jet League.

Plataforma oficial de mercado, scouting e valorização de agentes.

## Stack

- Cloudflare Pages + GitHub
- Firebase Realtime Database (dual)
  - `transfermarkt-545f7` → dados de mercado (valores, transferências, rumores)
  - `teste-jet` → elencos e dados da liga (somente leitura)

## Moeda

Todos os valores em **US$**.

## Funcionalidades

- Visão Geral (Dashboard com KPIs, movimentações, rankings rápidos, rumores)
- Agentes (lista + busca + filtros + ordenação)
- Perfil completo do Agente
- Equipes (valor do plantel + ranking)
- Perfil da Equipe
- Transferências (histórico + filtros)
- Rumores (com status e % de confiabilidade)
- Rankings (agentes, equipes, maiores transferências)

## Como publicar

1. Suba a pasta no GitHub
2. Conecte no Cloudflare Pages (projeto `transferjet`)
3. Framework: None
4. Build command: (vazio)
5. Output directory: `/`

## Regras do Firebase

Cole o conteúdo de `database.rules.json` no Firebase Console do projeto `transfermarkt-545f7`.

Abrir o site não grava seeds nem inicializa o Fantasy. Um banco vazio permanece vazio; seeds e resets continuam sendo ações manuais do administrador.

## Etapa 1 — correções estruturais

- History API para seções, perfis e páginas do Fantasy, com Voltar/Avançar, filtros e rolagem.
- Links estáticos: `?view=players`, `?player=CHAVE`, `?club=EQUIPE` e `?fantasy=market`. Links antigos de agentes continuam válidos.
- Transferências oficiais mantêm a chave do agente e gravam vínculo e histórico em uma atualização atômica no Market. O campo `team` indica a equipe atual; `id` é preservado, com fallback `legacy:CHAVE` para registros antigos. Nenhuma migração em massa é necessária.
- A sincronização opcional da Jet League usa uma transação e continua exigindo confirmação. Os dois bancos são independentes: falhas na liga são informadas, sem desfazer o registro já salvo no Market.
- Listeners podem ser iniciados novamente sem duplicação e desligados com `stopDataListeners()`. Falhas e desconexões aparecem no indicador de conexão.
- Sessão Fantasy restaurada após reload; cronômetro anterior cancelado ao trocar de tela. Escape de texto e atributos nos perfis, fotos e listagens principais.

### Testes locais

```sh
node --test tests/*.test.cjs
npm install
npx playwright install chromium
npm run test:browser
```

Os testes de navegador usam servidor local, Firebase simulado e bloqueiam toda a rede externa. Não executam seeds, resets ou escritas de produção. Para usar Brave/Edge instalado, defina `TEST_BROWSER_PATH` com o caminho do executável antes de executar `npm run test:browser`.

As regras Firebase e a fórmula de valorização permanecem inalteradas. Os testes validam o comportamento local; não validam permissões ou escritas nos projetos reais. Reformulação visual, evolução dos históricos, melhorias das regras/rodadas Fantasy e revisão Gemini ficam para as etapas seguintes.

## Jet Cards

O módulo de cartinhas **não faz mais parte** deste repo.
O botão **Jet Cards** no menu abre o app externo (edite a URL em `index.html` se o domínio for outro).
