# Jet Transfer

Mercado de agentes da **Jet League**.

Site separado que **só lê** os dados do Firebase do Jet League em tempo real e guarda seus próprios dados (valores de mercado, transferências, rumores) no projeto `transfermarkt-545f7`.

## Stack

- Cloudflare Pages + GitHub
- Firebase Realtime Database (dois projetos)
- HTML/CSS/JS vanilla (mesmo estilo do Jet League)

## Estrutura

```
jet-transfer/
├── index.html
├── css/styles.css
├── js/
│   ├── config/firebase-config.js   ← configs dos dois projetos
│   ├── core/state.js
│   ├── services/
│   │   ├── firebase.js             ← inicializa os dois apps
│   │   ├── jet-listeners.js        ← escuta o Jet League (read-only)
│   │   └── transfer-listeners.js   ← escuta o próprio banco
│   └── app.js
├── database.rules.json
└── README.md
```

## Conexão dual

- **Transfermarkt** (`transfermarkt-545f7`) → leitura + escrita
- **Jet League** (`teste-jet`) → **somente leitura**

O site nunca escreve no banco da Jet League.

## Como publicar

1. Crie um repositório no GitHub
2. Suba esta pasta
3. Conecte no Cloudflare Pages
4. Build command: (deixe vazio)
5. Output directory: `/`

## Próximos passos sugeridos

- [ ] Definir valores de mercado dos agentes
- [ ] Sistema de registro de transferências (admin)
- [ ] Ranking por valor de mercado
- [ ] Página individual do agente
- [ ] Rumores com IA (opcional)
