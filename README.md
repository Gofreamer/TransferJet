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

Na primeira carga o site aplica automaticamente os valores fictícios de seed (caso o banco esteja vazio).

## Jet Cards

O módulo de cartinhas **não faz mais parte** deste repo.
O botão **Jet Cards** no menu abre o app externo (edite a URL em `index.html` se o domínio for outro).
