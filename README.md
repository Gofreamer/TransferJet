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

As regras Firebase e a fórmula de valorização permanecem inalteradas. Os testes validam o comportamento local; não validam permissões ou escritas nos projetos reais. As etapas seguintes detalham os históricos, as rodadas Fantasy e a revisão Gemini implementados.

## Etapa 2 — reformulação visual

Navegação lateral no desktop e menu acessível no celular; dashboard com indicadores e feed; estilos compartilhados de cards, perfis, filtros, tabelas e modais; temas claro/escuro, estados de conexão e fallback dos gráficos. Os blocos de valores atuais agora usam rótulos que não sugerem uma valorização histórica inexistente. As regras, os valores e os dados Firebase permanecem preservados.

Prévia local com dados fictícios, sem acesso aos bancos Firebase reais:

```sh
node scripts/preview.cjs
```

Abra `http://127.0.0.1:4173`. A prévia reutiliza o seed apenas em memória; não o envia a nenhum banco. A publicação estática continua usando o `index.html` e o Cloudflare Pages existentes. `SCREENSHOT_DIRECTORY` permite salvar capturas ao executar os testes de navegador.

## Etapa 3 — mercado

- Busca sem distinção de acentos; filtros combinados de equipe, rank exato, função, valor e status, incluindo livres, aposentados e suspensos.
- Comparação de até três agentes distintos, com empates destacados, contratos, salário, cláusula, status, transferências e última variação real. Rankings de altas/quedas usam registros reais, sem comparar com o pico como se fosse valorização de rodada.
- `players/CHAVE/valueEvents` acumula alterações reais com valor anterior, novo valor, temporada, rodada, data e origem. `changeLog` registra os campos alterados, incluindo contratos. O antigo `valueHistory` permanece intocado e aparece separado como histórico não verificado; a aplicação não cria mais gráficos sintéticos automaticamente.
- Edição manual revisada e salva por transação; importação/IA revisada/sync usam o mesmo registro de alterações. Importação e sync mantêm valores por padrão. Os lotes validam a revisão antes de gravar campos específicos e marcações de partidas em uma atualização atômica.
- A importação aceita uma coluna `ID` (ID permanente ou chave existente), conserva a chave ao mudar nome/equipe e recusa nomes ambíguos sem ID. Nenhum registro antigo é apagado na importação.
- Carreira considera somente transferências oficiais identificadas por ID/chave, com fallback por nome apenas se não houver homônimos. Não inventa datas de contratos ou início da carreira.
- Administração com filtros de status/temporada do registro, diagnóstico de duplicidades, backup JSON e restauração de um registro ausente por vez. Restaurar não sobrescreve registros existentes nem configurações; o backup do mercado não inclui o Fantasy.

A fórmula vigente continua limitada a US$ 12 milhões **apenas para sugestões/recalculo solicitado**. Foram corrigidos erros de interpretação de ranks em outras capitalizações; pesos e teto foram preservados. Valores existentes e edições manuais acima do teto permanecem válidos. Alterar o teto ou os pesos exige uma decisão explícita; nenhuma alteração é aplicada ao carregar o site. As etapas 4 e 5 estão descritas abaixo.

## Etapa 4 — Jet Fantasy

- Mercado com filtros de equipe, nome, rank, preço Fantasy e disponibilidade; saldo após compra/troca, custo líquido e motivo de bloqueio. Humanos e NPCs usam o mesmo pool elegível. Estratégia Caos repetível por temporada/rodada.
- Alterações de escalação usam transação sobre o participante remoto. Mantidos 5 titulares, 1 reserva, capitão ×1,5, orçamento padrão US$ 5M, máximo 2 por equipe e pontuação vigente. Reembolso continua pelo preço atual; agente removido do cadastro usa o valor de aquisição quando disponível.
- Fechar mercado salva `fantasy/rounds/ID/snapshot`: escalações, IDs, nomes, equipes, regras, preços e valores das equipes. O fechamento automático por horário bloqueia compras; o administrador precisa usar **Fechar mercado** para capturar a cópia oficial. A data exibida é a captura real, sem reconstrução retroativa. Rodadas antigas não são recalculadas nem recebem snapshots inventados.
- Processamento exige snapshot e séries concluídas com confrontos. Usa IDs explícitos quando presentes; nomes legados exigem correspondência única por equipe e prêmios ambíguos não são atribuídos. Escalações inválidas na captura ficam registradas com os erros e 0 pontos. Reserva continua sem substituição automática.
- Revisão compara dados novamente antes de publicar. Transação por rodada impede duas confirmações concorrentes; pontos, ranking por rodada e estado final são publicados juntos. Repetição não sobrescreve rodada processada. Falha de publicação tenta devolver a rodada a LOCKED; se a conexão também impedir essa recuperação, o token PROCESSING fica visível no registro para recuperação administrativa, sem liberação automática.
- Ranking geral e indicadores somam `scores` por rodada, evitando depender do cache agregado antigo; quando não existem scores, o cache legado continua visível. Não há migração ou reconstrução de pontuações ausentes. Histórico detalhado e evolução acumulada; análises opcionais são rascunhos editáveis com publicação manual.

Testes direcionados: `node --test tests/fantasy.test.cjs`. Para executar só os cenários Fantasy no Brave, defina `TEST_SCENARIO=Fantasy:` e execute `npm run test:browser`. Todos usam Firebase simulado e rede externa bloqueada.

### Acesso Fantasy preservado

Por decisão do responsável pelo RP, a entrada por nick/código continua como está, sem novo login ou backend de autenticação. `database.rules.json` não foi alterado. Esse acesso oferece os controles atuais do cliente, sem autenticação de propriedade no servidor.

`database.fantasy.rules.proposed.json` permanece somente como estudo arquivado, fora da entrega de implantação. Não aplicar: exigiria custom claims e backend próprio e bloquearia os participantes atuais.

## Etapa 5 — otimização final

- As cinco leituras Fantasy começam na primeira abertura do módulo ou da aba Fantasy do administrador. Navegar no mercado não as inicia. Os listeners compartilham o mesmo controle de duplicação, desligamento e recuperação de erros; somente a leitura cancelada é inscrita novamente.
- Atualizações recebidas no mesmo quadro geram uma atualização da tela. Eventos Fantasy não redesenham o mercado quando o módulo está inativo. Filtros, rolagem, foco e seleção de texto são preservados; a atualização inicial do painel administrativo aguarda os dados e não apaga formulários em edição.
- Gemini: SDK importado uma vez, chamadas idênticas simultâneas compartilhadas, modelo padrão `gemini-3.6-flash` e fallback `gemini-3.5-flash`. Modelos antigos 2.x removidos das tentativas. Erros de modelo usam fallback; quota/permissão não repetem modelos do mesmo projeto. Pausa de 30 segundos por projeto indisponível e de 5 minutos por modelo inexistente, mantidas somente em memória. Projeto que responde é priorizado na próxima consulta.
- Prazo total de 25 segundos por consulta, incluindo carga do SDK; NPCs usam 18 segundos e análise narrativa usa 12 segundos. Ao expirar, o pedido é cancelado pelo AbortSignal e nenhuma tentativa posterior é iniciada; timers são liberados. Mensagens de falha são compreensíveis e a IA continua opcional. Publicação mantém revisão manual. Não há cache permanente de respostas: pedir nova geração após concluir faz uma nova consulta.
- Prévia local também simula a IA. O código publicado continua usando Firebase AI Logic; a simulação existe somente na resposta do servidor `scripts/preview.cjs`.

Modelos e SDK conferidos em 15/10/2026 na [lista oficial de modelos](https://firebase.google.com/docs/ai-logic/models) e nas [notas do SDK JavaScript](https://firebase.google.com/support/release-notes/js). O SDK AI 12.16.0 foi preservado. A presença de um modelo na lista não confirma a habilitação ou quota nos projetos particulares; a integração foi validada com SDK simulado, sem consultas pagas.

Validação final: **49 testes automatizados e 27 cenários no Brave aprovados**, abrangendo valores, transferências, navegação, histórico, filtros, gráficos/fallback, Fantasy, responsividade, falta de conexão, cancelamento de listeners e Gemini. Testes bloqueiam a rede externa e gravam somente no Firebase simulado. Nenhum seed, reset, regra ou dado de produção foi alterado. Para repetir somente os cenários novos, use `TEST_SCENARIO=Otimização:`.

As cinco etapas de código estão concluídas dentro do escopo acordado. A implantação continua estática, sem comando de build ou framework adicional: envie os arquivos ao GitHub e mantenha a configuração Cloudflare Pages existente. `tests/` deve ser versionado (também é usado pela prévia); `node_modules/` e `test-results/` continuam ignorados. A publicação e a verificação com os serviços reais ficam para o ambiente do responsável; não foi feito merge ou push nesta execução.

## Redesign premium

Nova direção em azul elétrico e marinho: navegação com ícones, conexão real na lateral, temporada/janela na barra superior e busca global por agentes e equipes (teclado, Enter, Escape e atalho `/`). Dashboard com composição decorativa em CSS, destaque pelo maior valor entre agentes em atividade, transferências com status explícito, ranking de valores, rumores separados e entrada para o Fantasy. Variações usam somente `valueEvents`; não há métricas ou personagens fictícios incluídos no código publicado.

`css/premium.css` aplica a mesma tipografia e materiais a cards, perfis, comparação, tabelas, Fantasy e administração. `js/features/market/premium-ui.js` concentra a apresentação do dashboard e a busca, reutilizando os serviços e fotos existentes. Sem foto cadastrada, o destaque usa iniciais. Cabeçalho feito em CSS; a imagem de referência não estava disponível e a fidelidade exata ao mockup continua pendente.

Barlow Condensed hospedada em `assets/fonts/`, com [licença OFL do projeto original](https://github.com/google/fonts/blob/main/ofl/barlowcondensed/OFL.txt) incluída. Envie também essa pasta ao publicar. Firebase, fórmulas, regras Fantasy, integração Gemini e History API foram preservados. Site continua estático, sem build.

Validação: **50 testes automatizados e 30 cenários Brave aprovados**, com rede externa bloqueada e Firebase simulado. Capturas em `test-results/premium/` (não versionadas); a prévia local também foi validada em desktop e celular. Não houve escrita em produção.

## Jet Cards

O módulo de cartinhas **não faz mais parte** deste repo.
O botão **Jet Cards** no menu abre o app externo (edite a URL em `index.html` se o domínio for outro).
