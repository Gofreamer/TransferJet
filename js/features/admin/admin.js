/* Jet Market — Painel Administrativo */

let isLogged = false;
let currentUser = null;
let auth = null;

function initAuth() {
  try {
    // Usa o app principal (Market)
    const app = firebase.apps.find(a => a.name === "[DEFAULT]") || firebase.app();
    auth = firebase.auth(app);
    auth.onAuthStateChanged(user => {
      currentUser = user;
      isLogged = !!user;
      updateAdminButton();
    });
  } catch (e) {
    console.warn("Auth não disponível ainda", e);
  }
}

function updateAdminButton() {
  const btn = document.getElementById("adminBtn");
  if (!btn) return;
  btn.textContent = isLogged ? "Admin ✓" : "Admin";
  btn.classList.toggle("logged", isLogged);
}

function openAdmin() {
  const panel = document.getElementById("adminPanel");
  panel.classList.add("open");
  if (!isLogged) {
    renderAdminLogin();
  } else {
    renderAdminPanel("values");
  }
}

function closeAdmin() {
  document.getElementById("adminPanel").classList.remove("open");
}

function renderAdminLogin() {
  document.getElementById("adminBox").innerHTML = `
    <h2>Área do Administrador</h2>
    <p class="admin-sub">Jet Market · Gerencie valores, transferências e rumores</p>
    <div class="login-form">
      <input type="email" id="adminEmail" placeholder="E-mail" autocomplete="username">
      <input type="password" id="adminPass" placeholder="Senha" autocomplete="current-password"
             onkeydown="if(event.key==='Enter')tryAdminLogin()">
      <div class="admin-actions">
        <button class="btn-primary" onclick="tryAdminLogin()">Entrar</button>
        <button class="btn-gray" onclick="closeAdmin()">Cancelar</button>
      </div>
      <p id="loginError" class="login-error" style="display:none"></p>
    </div>
  `;
}

function tryAdminLogin() {
  const email = document.getElementById("adminEmail").value.trim();
  const pass = document.getElementById("adminPass").value;
  const errorEl = document.getElementById("loginError");

  if (!email || !pass) {
    errorEl.style.display = "block";
    errorEl.textContent = "Preencha e-mail e senha";
    return;
  }

  auth.signInWithEmailAndPassword(email, pass)
    .then(() => {
      isLogged = true;
      renderAdminPanel("values");
    })
    .catch(err => {
      errorEl.style.display = "block";
      errorEl.textContent = "E-mail ou senha incorretos";
      console.error(err);
    });
}

function logoutAdmin() {
  auth.signOut().then(() => {
    isLogged = false;
    currentUser = null;
    closeAdmin();
  });
}

/* ========== ADMIN TABS ========== */
function renderAdminPanel(tab = "values") {
  const box = document.getElementById("adminBox");
  box.innerHTML = `
    <div class="admin-header">
      <h2>Admin · Jet Market</h2>
      <div class="admin-header-actions">
        <button class="btn-gray btn-sm" onclick="logoutAdmin()">Sair</button>
        <button class="btn-gray btn-sm" onclick="closeAdmin()">Fechar</button>
      </div>
    </div>
    <div class="admin-tabs">
      <button class="admin-tab ${tab==='values'?'active':''}" onclick="renderAdminPanel('values')">Valores</button>
      <button class="admin-tab ${tab==='transfers'?'active':''}" onclick="renderAdminPanel('transfers')">Transferências</button>
      <button class="admin-tab ${tab==='rumors'?'active':''}" onclick="renderAdminPanel('rumors')">Rumores</button>
      <button class="admin-tab ${tab==='ai'?'active':''}" onclick="renderAdminPanel('ai')">IA</button>
    </div>
    <div id="adminTabContent"></div>
  `;

  if (tab === "values") renderAdminValues();
  if (tab === "transfers") renderAdminTransfers();
  if (tab === "rumors") renderAdminRumors();
  if (tab === "ai") renderAdminAI();
}

/* ========== VALORES ========== */
function renderAdminValues() {
  const players = getAllPlayersFlat().sort((a, b) => a.club.localeCompare(b.club) || a.name.localeCompare(b.name));
  const el = document.getElementById("adminTabContent");

  el.innerHTML = `
    <div class="admin-toolbar">
      <input type="text" id="adminValueSearch" placeholder="Buscar agente..." oninput="filterAdminValues()" style="flex:1">
      <select id="adminValueClub" onchange="filterAdminValues()">
        <option value="">Todos os times</option>
        ${[...new Set(players.map(p => p.club))].sort().map(c => `<option value="${c}">${c}</option>`).join("")}
      </select>
    </div>
    <div class="admin-table-wrap">
      <table class="admin-table" id="adminValuesTable">
        <thead>
          <tr>
            <th>Agente</th>
            <th>Equipe</th>
            <th>Valor atual (US$)</th>
            <th>Pico</th>
            <th>Idade</th>
            <th>Nacionalidade</th>
            <th>Foto URL</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${players.map(p => `
            <tr data-key="${p.key}" data-name="${p.name.toLowerCase()}" data-club="${p.club}">
              <td><strong>${p.name}</strong></td>
              <td>${p.club}</td>
              <td><input type="number" class="admin-input" data-field="marketValue" value="${p.marketValue || ""}" placeholder="0"></td>
              <td><input type="number" class="admin-input" data-field="peakValue" value="${p.peakValue || ""}" placeholder="0"></td>
              <td><input type="number" class="admin-input admin-input-sm" data-field="age" value="${p.age || ""}" placeholder="—"></td>
              <td><input type="text" class="admin-input" data-field="nationality" value="${p.nationality || ""}" placeholder="—"></td>
              <td><input type="text" class="admin-input" data-field="photo" value="${p.photo || ""}" placeholder="https://..."></td>
              <td><button class="btn-primary btn-sm" onclick="savePlayerRow(this)">Salvar</button></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function filterAdminValues() {
  const search = (document.getElementById("adminValueSearch")?.value || "").toLowerCase();
  const club = document.getElementById("adminValueClub")?.value || "";
  document.querySelectorAll("#adminValuesTable tbody tr").forEach(tr => {
    const matchName = !search || tr.dataset.name.includes(search);
    const matchClub = !club || tr.dataset.club === club;
    tr.style.display = matchName && matchClub ? "" : "none";
  });
}

function savePlayerRow(btn) {
  const tr = btn.closest("tr");
  const key = tr.dataset.key;
  const data = {};
  tr.querySelectorAll(".admin-input").forEach(input => {
    const field = input.dataset.field;
    let val = input.value.trim();
    if (field === "marketValue" || field === "peakValue" || field === "age") {
      val = val === "" ? null : Number(val);
    }
    if (val !== null && val !== "") data[field] = val;
  });

  // Mantém valueHistory se existir
  const existing = window.AppState.market.players[key] || {};
  const payload = { ...existing, ...data };

  // Atualiza histórico de valor da temporada atual se o valor mudou
  const season = window.AppState.jet.currentSeason || "Temporada 1";
  if (data.marketValue != null) {
    let history = payload.valueHistory || [];
    const idx = history.findIndex(h => h.season === season);
    if (idx >= 0) history[idx].value = data.marketValue;
    else history.push({ season, value: data.marketValue });
    payload.valueHistory = history;
    if (!payload.peakValue || data.marketValue > payload.peakValue) {
      payload.peakValue = data.marketValue;
    }
  }

  window.marketDb.ref("players/" + key).set(payload)
    .then(() => {
      btn.textContent = "✓";
      setTimeout(() => btn.textContent = "Salvar", 1200);
    })
    .catch(err => alert("Erro ao salvar: " + err.message));
}

/* ========== TRANSFERÊNCIAS ========== */
function renderAdminTransfers() {
  const players = getAllPlayersFlat().sort((a, b) => a.name.localeCompare(b.name));
  const clubs = Object.keys(window.AppState.jet.rosters || {}).sort();
  const el = document.getElementById("adminTabContent");

  el.innerHTML = `
    <h3 class="admin-section-title">Registrar Transferência</h3>
    <div class="admin-form-grid">
      <div>
        <label>Agente</label>
        <select id="trPlayer">
          <option value="">Selecione...</option>
          ${players.map(p => `<option value="${p.key}" data-name="${p.name}" data-club="${p.club}">${p.name} (${p.club})</option>`).join("")}
        </select>
      </div>
      <div>
        <label>Origem</label>
        <select id="trFrom">
          <option value="">—</option>
          ${clubs.map(c => `<option value="${c}">${c}</option>`).join("")}
        </select>
      </div>
      <div>
        <label>Destino</label>
        <select id="trTo">
          <option value="">—</option>
          ${clubs.map(c => `<option value="${c}">${c}</option>`).join("")}
        </select>
      </div>
      <div>
        <label>Valor (US$)</label>
        <input type="number" id="trFee" placeholder="32500000">
      </div>
      <div>
        <label>Tipo</label>
        <select id="trType">
          <option value="definitiva">Definitiva</option>
          <option value="emprestimo">Empréstimo</option>
          <option value="livre">Livre</option>
        </select>
      </div>
      <div>
        <label>Data</label>
        <input type="date" id="trDate" value="${new Date().toISOString().slice(0,10)}">
      </div>
      <div>
        <label>Temporada</label>
        <input type="text" id="trSeason" value="${window.AppState.jet.currentSeason || "Temporada 1"}">
      </div>
      <div>
        <label>Status</label>
        <select id="trStatus">
          <option value="oficial">OFICIAL</option>
          <option value="negociando">NEGOCIANDO</option>
          <option value="interesse">INTERESSE</option>
        </select>
      </div>
    </div>
    <div class="admin-actions" style="margin-top:14px">
      <button class="btn-primary" onclick="saveTransfer()">Registrar Transferência</button>
    </div>

    <h3 class="admin-section-title" style="margin-top:28px">Transferências registradas</h3>
    <div id="adminTransfersList"></div>
  `;

  // Auto-preenche origem ao escolher agente
  document.getElementById("trPlayer").addEventListener("change", function () {
    const opt = this.selectedOptions[0];
    if (opt?.dataset.club) document.getElementById("trFrom").value = opt.dataset.club;
  });

  renderAdminTransfersList();
}

function renderAdminTransfersList() {
  const transfers = Object.entries(window.AppState.market.transfers || {})
    .map(([id, t]) => ({ id, ...t }))
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const el = document.getElementById("adminTransfersList");
  if (!el) return;

  if (!transfers.length) {
    el.innerHTML = `<p class="empty-state" style="padding:20px">Nenhuma transferência.</p>`;
    return;
  }

  el.innerHTML = `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead><tr><th>Agente</th><th>De → Para</th><th>Valor</th><th>Data</th><th></th></tr></thead>
        <tbody>
          ${transfers.map(t => `
            <tr>
              <td>${t.playerName}</td>
              <td>${t.from} → ${t.to}</td>
              <td>${formatUSD(t.fee, true)}</td>
              <td>${t.date}</td>
              <td><button class="btn-danger btn-sm" onclick="deleteTransfer('${t.id}')">Excluir</button></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function saveTransfer() {
  const playerSelect = document.getElementById("trPlayer");
  const opt = playerSelect.selectedOptions[0];
  if (!opt || !opt.value) return alert("Selecione o agente");

  const from = document.getElementById("trFrom").value;
  const to = document.getElementById("trTo").value;
  const fee = Number(document.getElementById("trFee").value) || 0;
  if (!from || !to) return alert("Preencha origem e destino");

  const id = "t" + Date.now();
  const payload = {
    playerKey: opt.value,
    playerName: opt.dataset.name,
    from, to, fee,
    type: document.getElementById("trType").value,
    date: document.getElementById("trDate").value,
    season: document.getElementById("trSeason").value,
    status: document.getElementById("trStatus").value
  };

  window.marketDb.ref("transfers/" + id).set(payload)
    .then(() => {
      alert("Transferência registrada!");
      renderAdminTransfers();
    })
    .catch(err => alert("Erro: " + err.message));
}

function deleteTransfer(id) {
  if (!confirm("Excluir esta transferência?")) return;
  window.marketDb.ref("transfers/" + id).remove()
    .then(() => renderAdminTransfersList());
}

/* ========== RUMORES ========== */
function renderAdminRumors() {
  const players = getAllPlayersFlat().sort((a, b) => a.name.localeCompare(b.name));
  const clubs = Object.keys(window.AppState.jet.rosters || {}).sort();
  const el = document.getElementById("adminTabContent");

  el.innerHTML = `
    <h3 class="admin-section-title">Novo Rumor</h3>
    <div class="admin-form-grid">
      <div>
        <label>Agente</label>
        <select id="ruPlayer">
          <option value="">Selecione...</option>
          ${players.map(p => `<option value="${p.key}" data-name="${p.name}" data-club="${p.club}">${p.name} (${p.club})</option>`).join("")}
        </select>
      </div>
      <div>
        <label>Equipe interessada</label>
        <select id="ruInterested">
          <option value="">—</option>
          ${clubs.map(c => `<option value="${c}">${c}</option>`).join("")}
        </select>
      </div>
      <div>
        <label>Confiabilidade (%)</label>
        <input type="number" id="ruReliability" min="0" max="100" value="50">
      </div>
      <div>
        <label>Status</label>
        <select id="ruStatus">
          <option value="rumor">RUMOR</option>
          <option value="rumor_forte">RUMOR FORTE</option>
          <option value="interesse">INTERESSE</option>
          <option value="negociando">NEGOCIANDO</option>
          <option value="oficial">OFICIAL</option>
          <option value="encerrada">ENCERRADA</option>
        </select>
      </div>
      <div class="full">
        <label>Descrição</label>
        <textarea id="ruDescription" rows="3" placeholder="Fontes do mercado indicam..."></textarea>
      </div>
    </div>
    <div class="admin-actions" style="margin-top:14px;gap:10px;display:flex;flex-wrap:wrap">
      <button class="btn-primary" onclick="saveRumor()">Salvar Rumor</button>
      <button class="btn-ai" onclick="generateRumorWithAI()">✨ Gerar com IA</button>
    </div>

    <h3 class="admin-section-title" style="margin-top:28px">Rumores ativos</h3>
    <div id="adminRumorsList"></div>
  `;

  renderAdminRumorsList();
}

function renderAdminRumorsList() {
  const rumors = Object.entries(window.AppState.market.rumors || {})
    .map(([id, r]) => ({ id, ...r }))
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const el = document.getElementById("adminRumorsList");
  if (!el) return;

  if (!rumors.length) {
    el.innerHTML = `<p class="empty-state" style="padding:20px">Nenhum rumor.</p>`;
    return;
  }

  el.innerHTML = rumors.map(r => {
    const st = statusLabel(r.status);
    return `
      <div class="rumor-card" style="margin-bottom:10px">
        <div class="rumor-header">
          <div class="rumor-title">${r.playerName} · ${r.currentClub} → ${r.interestedClub}</div>
          <span class="status-badge" style="background:${st.color}22;color:${st.color}">${st.icon} ${st.label}</span>
        </div>
        <div class="rumor-desc">${r.description}</div>
        <div class="rumor-meta">
          <span>${r.reliability}%</span>
          <span>${r.date}</span>
          <button class="btn-danger btn-sm" onclick="deleteRumor('${r.id}')">Excluir</button>
        </div>
      </div>
    `;
  }).join("");
}

function saveRumor() {
  const playerSelect = document.getElementById("ruPlayer");
  const opt = playerSelect.selectedOptions[0];
  if (!opt || !opt.value) return alert("Selecione o agente");

  const interested = document.getElementById("ruInterested").value;
  if (!interested) return alert("Selecione a equipe interessada");

  const id = "r" + Date.now();
  const payload = {
    playerKey: opt.value,
    playerName: opt.dataset.name,
    currentClub: opt.dataset.club,
    interestedClub: interested,
    reliability: Number(document.getElementById("ruReliability").value) || 50,
    status: document.getElementById("ruStatus").value,
    description: document.getElementById("ruDescription").value.trim(),
    date: new Date().toISOString().slice(0, 10),
    season: window.AppState.jet.currentSeason || "Temporada 1"
  };

  if (!payload.description) return alert("Escreva a descrição do rumor");

  window.marketDb.ref("rumors/" + id).set(payload)
    .then(() => {
      alert("Rumor salvo!");
      renderAdminRumors();
    })
    .catch(err => alert("Erro: " + err.message));
}

function deleteRumor(id) {
  if (!confirm("Excluir este rumor?")) return;
  window.marketDb.ref("rumors/" + id).remove().then(() => renderAdminRumorsList());
}

/* ========== IA TAB ========== */
function renderAdminAI() {
  const el = document.getElementById("adminTabContent");
  el.innerHTML = `
    <h3 class="admin-section-title">Geração com Gemini 3.6 Flash</h3>
    <p class="admin-sub" style="margin-bottom:16px">
      A IA gera conteúdo baseado nos dados reais da Jet League. 
      <strong>Sempre revise no modal antes de publicar.</strong>
    </p>

    <div class="admin-form-grid">
      <div class="full">
        <label>O que gerar?</label>
        <select id="aiAction">
          <option value="rumor">Rumor de mercado</option>
          <option value="batch-rumors">Lote de 3 rumores</option>
          <option value="value-suggest">Sugestão de valor de mercado</option>
        </select>
      </div>
      <div>
        <label>Agente (opcional)</label>
        <select id="aiPlayer">
          <option value="">Aleatório / todos</option>
          ${getAllPlayersFlat().sort((a,b)=>a.name.localeCompare(b.name)).map(p =>
            `<option value="${p.key}" data-name="${p.name}" data-club="${p.club}">${p.name} (${p.club})</option>`
          ).join("")}
        </select>
      </div>
      <div>
        <label>Equipe interessada (opcional)</label>
        <select id="aiClub">
          <option value="">Sugerir automaticamente</option>
          ${Object.keys(window.AppState.jet.rosters||{}).sort().map(c => `<option value="${c}">${c}</option>`).join("")}
        </select>
      </div>
      <div class="full">
        <label>Instrução extra (opcional)</label>
        <textarea id="aiExtra" rows="2" placeholder="Ex: foque em rivalidade entre Salvatore e KOF 12"></textarea>
      </div>
    </div>
    <div class="admin-actions" style="margin-top:14px">
      <button class="btn-ai" id="aiGenerateBtn" onclick="runAIGeneration()">✨ Gerar com IA</button>
    </div>
    <p id="aiStatus" style="margin-top:12px;font-size:0.85rem;color:var(--text-muted)"></p>
  `;
}

/* ========== AI GENERATION + REVIEW MODAL ========== */
async function runAIGeneration() {
  const action = document.getElementById("aiAction").value;
  const status = document.getElementById("aiStatus");
  const btn = document.getElementById("aiGenerateBtn");
  btn.disabled = true;
  btn.textContent = "Gerando...";
  status.textContent = "Consultando Gemini 3.6 Flash...";

  try {
    let result;
    if (action === "rumor") result = await aiGenerateSingleRumor();
    else if (action === "batch-rumors") result = await aiGenerateBatchRumors();
    else if (action === "value-suggest") result = await aiSuggestValue();

    openAIReviewModal(action, result);
    status.textContent = "Gerado! Revise no modal.";
  } catch (err) {
    console.error(err);
    status.textContent = "Erro na IA: " + (err.message || "tente novamente");
    // Fallback local
    if (action === "rumor") {
      const fallback = localRumorFallback();
      openAIReviewModal(action, fallback);
      status.textContent = "IA indisponível — usado fallback local. Revise antes de publicar.";
    }
  } finally {
    btn.disabled = false;
    btn.textContent = "✨ Gerar com IA";
  }
}

async function generateRumorWithAI() {
  // Atalho a partir da aba Rumores
  const playerSelect = document.getElementById("ruPlayer");
  const opt = playerSelect?.selectedOptions[0];
  const interested = document.getElementById("ruInterested")?.value;

  const status = document.createElement("p");
  status.id = "ruAIStatus";
  status.style.cssText = "font-size:0.85rem;color:var(--text-muted);margin-top:8px";
  status.textContent = "Gerando rumor com IA...";
  document.querySelector("#adminTabContent .admin-actions")?.after(status);

  try {
    const result = await aiGenerateSingleRumor(
      opt?.value ? { key: opt.value, name: opt.dataset.name, club: opt.dataset.club } : null,
      interested || null
    );
    openAIReviewModal("rumor", result);
    status.textContent = "Revise no modal antes de salvar.";
  } catch (err) {
    const fallback = localRumorFallback(opt, interested);
    openAIReviewModal("rumor", fallback);
    status.textContent = "IA indisponível — fallback local. Revise antes de publicar.";
  }
}

async function aiGenerateSingleRumor(forcedPlayer = null, forcedClub = null) {
  const players = getAllPlayersFlat();
  const clubs = Object.keys(window.AppState.jet.rosters || {});
  const extra = document.getElementById("aiExtra")?.value || "";

  let player = forcedPlayer;
  if (!player) {
    const sel = document.getElementById("aiPlayer") || document.getElementById("ruPlayer");
    const opt = sel?.selectedOptions[0];
    if (opt?.value) player = { key: opt.value, name: opt.dataset.name, club: opt.dataset.club };
    else player = players[Math.floor(Math.random() * players.length)];
  }

  let interested = forcedClub || document.getElementById("aiClub")?.value || document.getElementById("ruInterested")?.value;
  if (!interested) {
    const others = clubs.filter(c => c !== player.club);
    interested = others[Math.floor(Math.random() * others.length)];
  }

  const topPlayers = players.filter(p => p.marketValue).sort((a,b)=>b.marketValue-a.marketValue).slice(0,8)
    .map(p => `${p.name} (${p.club}) — ${formatUSD(p.marketValue,true)}`).join("\n");

  const prompt = `Você é um jornalista de mercado de transferências da Jet League (liga competitiva de luta / e-sports in-world).
Escreva em português do Brasil, tom profissional de mercado esportivo.

AGENTE: ${player.name}
EQUIPE ATUAL: ${player.club}
EQUIPE INTERESSADA: ${interested}
VALOR DE MERCADO DO AGENTE: ${player.marketValue ? formatUSD(player.marketValue) : "não divulgado"}

TOP AGENTES DO MERCADO:
${topPlayers}

INSTRUÇÃO EXTRA: ${extra || "Nenhuma"}

Retorne EXATAMENTE neste formato (sem markdown extra):
CONFIABILIDADE: número de 15 a 85
STATUS: um de [rumor, rumor_forte, interesse, negociando]
DESCRICAO: 2 a 4 frases sobre o interesse, sem inventar fatos concretos de propostas se a confiabilidade for baixa. Use linguagem de mercado ("fontes indicam", "consultas iniciais", etc.).`;

  const raw = await window.marketGenerateWithAI(prompt);
  return parseRumorAIResponse(raw, player, interested);
}

function parseRumorAIResponse(raw, player, interested) {
  const reliabilityMatch = raw.match(/CONFIABILIDADE:\s*(\d+)/i);
  const statusMatch = raw.match(/STATUS:\s*(\w+)/i);
  const descMatch = raw.match(/DESCRICAO:\s*([\s\S]+)/i);

  return {
    playerKey: player.key || playerKey(player.club, player.name),
    playerName: player.name,
    currentClub: player.club,
    interestedClub: interested,
    reliability: reliabilityMatch ? Math.min(100, Number(reliabilityMatch[1])) : 45,
    status: (statusMatch?.[1] || "rumor").toLowerCase().replace(" ", "_"),
    description: (descMatch?.[1] || raw).trim().slice(0, 600),
    date: new Date().toISOString().slice(0, 10),
    season: window.AppState.jet.currentSeason || "Temporada 1"
  };
}

function localRumorFallback(opt = null, interested = null) {
  const players = getAllPlayersFlat();
  const clubs = Object.keys(window.AppState.jet.rosters || {});
  let player;
  if (opt?.value) player = { key: opt.value, name: opt.dataset.name, club: opt.dataset.club };
  else player = players[Math.floor(Math.random() * players.length)];

  if (!interested) {
    const others = clubs.filter(c => c !== player.club);
    interested = others[Math.floor(Math.random() * others.length)];
  }

  return {
    playerKey: player.key,
    playerName: player.name,
    currentClub: player.club,
    interestedClub: interested,
    reliability: 30 + Math.floor(Math.random() * 40),
    status: ["rumor", "interesse", "rumor_forte"][Math.floor(Math.random() * 3)],
    description: `Fontes do mercado apontam que o ${interested} avalia a situação de ${player.name}, atualmente no ${player.club}. Conversas ainda são preliminares e não há proposta formal confirmada.`,
    date: new Date().toISOString().slice(0, 10),
    season: window.AppState.jet.currentSeason || "Temporada 1"
  };
}

async function aiGenerateBatchRumors() {
  const results = [];
  for (let i = 0; i < 3; i++) {
    try {
      results.push(await aiGenerateSingleRumor());
    } catch {
      results.push(localRumorFallback());
    }
  }
  return results;
}

async function aiSuggestValue() {
  const sel = document.getElementById("aiPlayer");
  const opt = sel?.selectedOptions[0];
  if (!opt?.value) throw new Error("Selecione um agente para sugerir valor");

  const players = getAllPlayersFlat();
  const player = players.find(p => p.key === opt.value);
  const clubmates = players.filter(p => p.club === player.club && p.marketValue);
  const avgClub = clubmates.length ? clubmates.reduce((s,p)=>s+p.marketValue,0)/clubmates.length : 15000000;

  const prompt = `Você é um analista de mercado da Jet League.
Sugira um valor de mercado realista em dólares americanos para o agente:

NOME: ${player.name}
EQUIPE: ${player.club}
FUNÇÃO: ${player.role}
VALOR ATUAL: ${player.marketValue ? formatUSD(player.marketValue) : "não definido"}
MÉDIA DO ELENCO: ${formatUSD(avgClub, true)}

Responda EXATAMENTE:
VALOR: número inteiro (ex: 22500000)
JUSTIFICATIVA: 2 frases.`;

  const raw = await window.marketGenerateWithAI(prompt);
  const valueMatch = raw.match(/VALOR:\s*([\d.]+)/i);
  const justMatch = raw.match(/JUSTIFICATIVA:\s*([\s\S]+)/i);

  return {
    playerKey: player.key,
    playerName: player.name,
    suggestedValue: valueMatch ? Number(valueMatch[1].replace(/\./g, "")) : Math.round(avgClub),
    justification: (justMatch?.[1] || raw).trim(),
    currentValue: player.marketValue
  };
}

/* ========== REVIEW MODAL ========== */
function openAIReviewModal(action, data) {
  const overlay = document.getElementById("aiReviewOverlay");
  const body = document.getElementById("aiReviewBody");
  const title = document.getElementById("aiReviewTitle");

  window._aiReviewData = { action, data };

  if (action === "rumor") {
    title.textContent = "Revisar Rumor gerado pela IA";
    const r = data;
    body.innerHTML = `
      <div class="review-field"><label>Agente</label><input id="revPlayerName" value="${r.playerName}" readonly></div>
      <div class="review-field"><label>Equipe atual</label><input id="revCurrent" value="${r.currentClub}" readonly></div>
      <div class="review-field"><label>Equipe interessada</label><input id="revInterested" value="${r.interestedClub}"></div>
      <div class="review-field"><label>Confiabilidade (%)</label><input type="number" id="revReliability" value="${r.reliability}" min="0" max="100"></div>
      <div class="review-field"><label>Status</label>
        <select id="revStatus">
          ${["rumor","rumor_forte","interesse","negociando","oficial","encerrada"].map(s =>
            `<option value="${s}" ${s===r.status?"selected":""}>${s}</option>`
          ).join("")}
        </select>
      </div>
      <div class="review-field full"><label>Descrição</label><textarea id="revDescription" rows="4">${r.description}</textarea></div>
    `;
  } else if (action === "batch-rumors") {
    title.textContent = "Revisar lote de rumores";
    body.innerHTML = data.map((r, i) => `
      <div class="review-batch-item" data-idx="${i}">
        <h4>${r.playerName} → ${r.interestedClub}</h4>
        <div class="review-field"><label>Confiabilidade</label><input type="number" class="rev-rel" value="${r.reliability}"></div>
        <div class="review-field"><label>Status</label>
          <select class="rev-status">
            ${["rumor","rumor_forte","interesse","negociando"].map(s =>
              `<option value="${s}" ${s===r.status?"selected":""}>${s}</option>`
            ).join("")}
          </select>
        </div>
        <div class="review-field full"><label>Descrição</label><textarea class="rev-desc" rows="3">${r.description}</textarea></div>
      </div>
    `).join("<hr style='border-color:var(--border);margin:16px 0'>");
  } else if (action === "value-suggest") {
    title.textContent = "Sugestão de valor · " + data.playerName;
    body.innerHTML = `
      <div class="review-field"><label>Valor atual</label><input value="${data.currentValue ? formatUSD(data.currentValue) : "—"}" readonly></div>
      <div class="review-field"><label>Valor sugerido (US$)</label><input type="number" id="revSuggestedValue" value="${data.suggestedValue}"></div>
      <div class="review-field full"><label>Justificativa da IA</label><textarea id="revJustification" rows="3">${data.justification}</textarea></div>
      <p style="font-size:0.85rem;color:var(--text-muted);margin-top:8px">Ao confirmar, o valor será atualizado no agente.</p>
    `;
  }

  overlay.classList.add("open");
}

function closeAIReviewModal() {
  document.getElementById("aiReviewOverlay").classList.remove("open");
  window._aiReviewData = null;
}

function confirmAIReview() {
  const { action, data } = window._aiReviewData || {};
  if (!action) return;

  if (action === "rumor") {
    const payload = {
      playerKey: data.playerKey,
      playerName: data.playerName,
      currentClub: data.currentClub,
      interestedClub: document.getElementById("revInterested").value,
      reliability: Number(document.getElementById("revReliability").value),
      status: document.getElementById("revStatus").value,
      description: document.getElementById("revDescription").value.trim(),
      date: data.date || new Date().toISOString().slice(0, 10),
      season: data.season || window.AppState.jet.currentSeason || "Temporada 1"
    };
    const id = "r" + Date.now();
    window.marketDb.ref("rumors/" + id).set(payload)
      .then(() => { alert("Rumor publicado!"); closeAIReviewModal(); if (isLogged) renderAdminRumors(); })
      .catch(err => alert("Erro: " + err.message));
  }

  if (action === "batch-rumors") {
    const items = document.querySelectorAll(".review-batch-item");
    const updates = {};
    items.forEach((item, i) => {
      const r = data[i];
      const id = "r" + Date.now() + "_" + i;
      updates[id] = {
        playerKey: r.playerKey,
        playerName: r.playerName,
        currentClub: r.currentClub,
        interestedClub: r.interestedClub,
        reliability: Number(item.querySelector(".rev-rel").value),
        status: item.querySelector(".rev-status").value,
        description: item.querySelector(".rev-desc").value.trim(),
        date: r.date,
        season: r.season
      };
    });
    window.marketDb.ref("rumors").update(updates)
      .then(() => { alert("Rumores publicados!"); closeAIReviewModal(); if (isLogged) renderAdminRumors(); })
      .catch(err => alert("Erro: " + err.message));
  }

  if (action === "value-suggest") {
    const value = Number(document.getElementById("revSuggestedValue").value);
    const key = data.playerKey;
    const existing = window.AppState.market.players[key] || {};
    const season = window.AppState.jet.currentSeason || "Temporada 1";
    let history = existing.valueHistory || [];
    const idx = history.findIndex(h => h.season === season);
    if (idx >= 0) history[idx].value = value;
    else history.push({ season, value });

    const payload = {
      ...existing,
      marketValue: value,
      peakValue: Math.max(existing.peakValue || 0, value),
      valueHistory: history
    };
    window.marketDb.ref("players/" + key).set(payload)
      .then(() => { alert("Valor atualizado!"); closeAIReviewModal(); if (isLogged) renderAdminValues(); })
      .catch(err => alert("Erro: " + err.message));
  }
}

window.openAdmin = openAdmin;
window.closeAdmin = closeAdmin;
window.tryAdminLogin = tryAdminLogin;
window.logoutAdmin = logoutAdmin;
window.renderAdminPanel = renderAdminPanel;
window.filterAdminValues = filterAdminValues;
window.savePlayerRow = savePlayerRow;
window.saveTransfer = saveTransfer;
window.deleteTransfer = deleteTransfer;
window.saveRumor = saveRumor;
window.deleteRumor = deleteRumor;
window.generateRumorWithAI = generateRumorWithAI;
window.runAIGeneration = runAIGeneration;
window.closeAIReviewModal = closeAIReviewModal;
window.confirmAIReview = confirmAIReview;
window.initAuth = initAuth;
