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
      <button class="admin-tab ${tab==='import'?'active':''}" onclick="renderAdminPanel('import')">Importar Excel</button>
      <button class="admin-tab ${tab==='transfers'?'active':''}" onclick="renderAdminPanel('transfers')">Transferências</button>
      <button class="admin-tab ${tab==='rumors'?'active':''}" onclick="renderAdminPanel('rumors')">Rumores</button>
      <button class="admin-tab ${tab==='ai'?'active':''}" onclick="renderAdminPanel('ai')">IA</button>
    </div>
    <div id="adminTabContent"></div>
  `;

  if (tab === "values") renderAdminValues();
  if (tab === "import") renderAdminImport();
  if (tab === "transfers") renderAdminTransfers();
  if (tab === "rumors") renderAdminRumors();
  if (tab === "ai") renderAdminAI();
}

/* ========== IMPORT EXCEL ========== */
function renderAdminImport() {
  const el = document.getElementById("adminTabContent");
  const winOpen = !!(window.AppState.market.settings && window.AppState.market.settings.transferWindowOpen);
  el.innerHTML = `
    <h3 class="admin-section-title">Importar performance (Excel / CSV)</h3>
    <p class="admin-sub">
      Formato esperado:<br>
      <code>Equipe | Agente | Rank | Função | Troféu | P | V | D</code><br>
      Hierarquia de rank: <strong>Especial &gt; S &gt; A &gt; B &gt; C &gt; D &gt; E</strong> · Reserva &gt; Emergência
    </p>
    <div class="admin-form-grid">
      <div class="full">
        <label>Arquivo .xlsx ou .csv</label>
        <input type="file" id="importFile" accept=".xlsx,.xls,.csv">
      </div>
    </div>
    <div class="import-options">
      <label><input type="radio" name="importMode" value="full" checked> Atualizar stats + recalcular valor</label>
      <label><input type="radio" name="importMode" value="statsOnly"> Só atualizar stats (manter valores)</label>
    </div>
    <div class="admin-actions" style="margin-top:14px;gap:10px;display:flex;flex-wrap:wrap">
      <button class="btn-primary" onclick="processImportFile()">Importar e revisar</button>
      <button class="btn-ai" onclick="forceReseedFromCode()">Reaplicar seed (Rodada 12)</button>
    </div>
    <p id="importStatus" style="margin-top:12px;font-size:0.85rem;color:var(--text-muted)"></p>

    <h3 class="admin-section-title" style="margin-top:28px">Janela de transferências</h3>
    <p class="admin-sub">Quando fechada, não é possível registrar transferências com status OFICIAL.</p>
    <div class="admin-actions">
      <button class="btn-primary" onclick="setTransferWindow(true)">Abrir janela</button>
      <button class="btn-gray" onclick="setTransferWindow(false)">Fechar janela</button>
      <span class="window-badge ${winOpen ? "open" : "closed"}">${winOpen ? "ABERTA" : "FECHADA"}</span>
    </div>

    <h3 class="admin-section-title" style="margin-top:28px">Link Jet League</h3>
    <div class="admin-form-grid">
      <div class="full">
        <label>URL do site Jet League</label>
        <input type="text" id="jetLeagueUrlInput" value="${(window.AppState.market.settings && window.AppState.market.settings.jetLeagueUrl) || "https://teste-jet.pages.dev"}">
      </div>
    </div>
    <div class="admin-actions" style="margin-top:10px">
      <button class="btn-primary btn-sm" onclick="saveJetLeagueUrl()">Salvar URL</button>
    </div>
  `;
}

function setTransferWindow(open) {
  window.marketDb.ref("settings/transferWindowOpen").set(!!open)
    .then(() => {
      alert(open ? "Janela de transferências ABERTA" : "Janela FECHADA");
      renderAdminImport();
    })
    .catch(err => alert("Erro: " + err.message));
}

function saveJetLeagueUrl() {
  const url = document.getElementById("jetLeagueUrlInput").value.trim();
  window.marketDb.ref("settings/jetLeagueUrl").set(url || "https://teste-jet.pages.dev")
    .then(() => alert("URL salva!"))
    .catch(err => alert("Erro: " + err.message));
}

function forceReseedFromCode() {
  if (!confirm("Isso vai sobrescrever players/transfers/rumors com o seed da Rodada 12. Continuar?")) return;
  const status = document.getElementById("importStatus");
  status.textContent = "Aplicando seed...";
  window.marketDb.ref().update({
    players: window.SEED_MARKET_PLAYERS,
    transfers: window.SEED_TRANSFERS,
    rumors: window.SEED_RUMORS,
    settings: { currency: "USD", currencySymbol: "US$", seededAt: Date.now(), statsRound: "Rodada 12" }
  }).then(() => {
    status.textContent = "Seed da Rodada 12 aplicado com sucesso!";
  }).catch(err => {
    status.textContent = "Erro: " + err.message;
  });
}

function processImportFile() {
  const fileInput = document.getElementById("importFile");
  const status = document.getElementById("importStatus");
  const preview = document.getElementById("importPreview");
  if (!fileInput?.files?.length) {
    status.textContent = "Selecione um arquivo primeiro.";
    return;
  }
  if (typeof XLSX === "undefined") {
    status.textContent = "Biblioteca XLSX não carregou. Recarregue a página.";
    return;
  }

  const file = fileInput.files[0];
  status.textContent = "Lendo arquivo...";
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      const calculated = calculateValuesFromRows(rows);
      const mode = document.querySelector('input[name="importMode"]:checked')?.value || "full";
      window._importPreviewData = calculated;
      status.textContent = `${calculated.length} agentes processados. Revise e confirme.`;
      showImportReviewModal(calculated, mode);
    } catch (err) {
      console.error(err);
      status.textContent = "Erro ao ler arquivo: " + err.message;
    }
  };
  reader.readAsArrayBuffer(file);
}

function calculateValuesFromRows(rows) {
  const results = [];
  const unmatched = [];
  const knownKeys = new Set(getAllPlayersFlat().map(p => p.key));
  const knownNames = {};
  getAllPlayersFlat().forEach(p => {
    knownNames[(p.club + "|" + p.name).toLowerCase()] = p;
    knownNames[p.name.toLowerCase()] = knownNames[p.name.toLowerCase()] || p;
  });

  for (const row of rows) {
    const team = String(row["Equipe"] || row["equipe"] || row["Team"] || "").trim();
    const name = String(row["Agente"] || row["agente"] || row["Nome"] || row["name"] || "").trim();
    if (!team || !name) continue;

    const rank = String(row["Rank"] || row["rank"] || "").trim();
    const func = String(row["Função"] || row["Funcao"] || row["função"] || row["Function"] || "").trim();
    const trophyRaw = String(row["Troféu"] || row["Trofeu"] || row["troféu"] || "").trim();
    const trophy = trophyRaw ? 1 : 0;
    const P = Number(row["P"] || row["Partidas"] || 0) || 0;
    const V = Number(row["V"] || row["Vitórias"] || row["Vitorias"] || 0) || 0;
    const D = Number(row["D"] || row["Derrotas"] || 0) || 0;

    const key = team + "_" + name;
    const existing = window.AppState.market.players[key] || {};
    const matched = knownKeys.has(key) || knownNames[(team + "|" + name).toLowerCase()];

    const calc = window.VALUATION.calculate({
      rank, func, role: /emerg/i.test(func) ? "emergencia" : (/reserva/i.test(func) ? "reserva" : "titular"),
      trophy, P, V, D, team
    });

    if (!matched) {
      unmatched.push({ team, name, rank, P, V, D });
    }

    results.push({
      key, name, team, rank, func, trophy, P, V, D, wr: calc.wr,
      oldValue: existing.marketValue || null,
      newValue: calc.value,
      peak: calc.peak,
      matched: !!matched,
      nationality: existing.nationality || "Brasil",
      age: existing.age || 24,
      photo: existing.photo || "",
      salary: existing.salary ?? null,
      releaseClause: existing.releaseClause ?? null
    });
  }
  results._unmatched = unmatched;
  return results.sort((a, b) => b.newValue - a.newValue);
}

function showImportReviewModal(calculated, mode) {
  const overlay = document.getElementById("aiReviewOverlay");
  const body = document.getElementById("aiReviewBody");
  const title = document.getElementById("aiReviewTitle");
  const unmatched = calculated._unmatched || [];
  const statsOnly = mode === "statsOnly";

  let up = 0, down = 0, same = 0;
  calculated.forEach(r => {
    if (r.oldValue == null) return;
    if (r.newValue > r.oldValue) up++;
    else if (r.newValue < r.oldValue) down++;
    else same++;
  });

  window._aiReviewData = { action: "import-values", data: calculated, mode: mode || "full" };
  title.textContent = `Revisar importação · ${calculated.length} agentes`;

  body.innerHTML = `
    <div class="import-summary">
      <div class="kpi"><div class="kpi-label">Processados</div><div class="kpi-value">${calculated.length}</div></div>
      <div class="kpi"><div class="kpi-label">Subiram</div><div class="kpi-value" style="color:var(--green)">${up}</div></div>
      <div class="kpi"><div class="kpi-label">Desceram</div><div class="kpi-value" style="color:var(--red)">${down}</div></div>
      <div class="kpi"><div class="kpi-label">Não achados</div><div class="kpi-value" style="color:var(--orange)">${unmatched.length}</div></div>
    </div>
    ${statsOnly ? `<p style="font-size:0.85rem;color:var(--cyan);margin-bottom:10px">Modo: <strong>somente stats</strong> — valores de mercado não serão alterados.</p>` : ""}
    ${unmatched.length ? `
      <div class="rumor-card" style="border-color:var(--orange);margin-bottom:12px">
        <strong style="color:var(--orange)">⚠ Nomes não encontrados no elenco Jet League (${unmatched.length})</strong>
        <div style="font-size:0.8rem;margin-top:6px;color:var(--text-muted)">
          ${unmatched.slice(0, 12).map(u => `${u.team} · ${u.name}`).join(" · ")}
          ${unmatched.length > 12 ? "…" : ""}
        </div>
        <p style="font-size:0.75rem;margin-top:6px;color:var(--text-dim)">Serão salvos no Market mesmo assim (confira ortografia depois).</p>
      </div>
    ` : ""}
    <div class="admin-table-wrap" style="max-height:360px;overflow:auto">
      <table class="admin-table">
        <thead><tr><th></th><th>Agente</th><th>Time</th><th>Rank</th><th>P-V-D</th><th>Antigo</th><th>Novo</th></tr></thead>
        <tbody>
          ${calculated.map((r, i) => {
            const delta = r.oldValue != null ? r.newValue - r.oldValue : null;
            const flag = !r.matched ? "⚠" : (delta > 0 ? "▲" : delta < 0 ? "▼" : "·");
            return `<tr style="${!r.matched ? "opacity:0.75" : ""}">
              <td>${flag}</td>
              <td>${r.name}</td>
              <td>${r.team}</td>
              <td>${r.rank}</td>
              <td>${r.P}-${r.V}-${r.D}</td>
              <td style="color:var(--text-muted)">${r.oldValue ? formatUSD(r.oldValue, true) : "—"}</td>
              <td>${statsOnly
                ? (r.oldValue ? formatUSD(r.oldValue, true) : "—")
                : `<input type="number" class="admin-input imp-val" data-idx="${i}" value="${r.newValue}" style="width:120px">`}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
  overlay.classList.add("open");
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
            <th>Valor</th>
            <th>Pico</th>
            <th>Salário</th>
            <th>Cláusula</th>
            <th>Idade</th>
            <th>Nac.</th>
            <th>Foto</th>
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
              <td><input type="number" class="admin-input" data-field="salary" value="${p.salary || ""}" placeholder="—"></td>
              <td><input type="number" class="admin-input" data-field="releaseClause" value="${p.releaseClause || ""}" placeholder="—"></td>
              <td><input type="number" class="admin-input admin-input-sm" data-field="age" value="${p.age || ""}" placeholder="—"></td>
              <td><input type="text" class="admin-input admin-input-sm" data-field="nationality" value="${p.nationality || ""}" placeholder="—"></td>
              <td><input type="text" class="admin-input" data-field="photo" value="${p.photo || ""}" placeholder="url"></td>
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
    if (["marketValue", "peakValue", "age", "salary", "releaseClause"].includes(field)) {
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

  const status = document.getElementById("trStatus").value;
  if (status === "oficial" && !isTransferWindowOpen()) {
    return alert("Janela de transferências está FECHADA.\nAbra a janela em Admin → Importar Excel antes de registrar oficiais.");
  }

  const id = "t" + Date.now();
  const payload = {
    playerKey: opt.value,
    playerName: opt.dataset.name,
    from, to, fee,
    type: document.getElementById("trType").value,
    date: document.getElementById("trDate").value,
    season: document.getElementById("trSeason").value,
    status
  };

  window.marketDb.ref("transfers/" + id).set(payload)
    .then(() => {
      alert("Transferência registrada!");
      if (status === "oficial" && confirm("Aplicar também no elenco da Jet League?\n(Requer permissão de escrita no Firebase da liga)")) {
        syncTransferToJetLeague(payload);
      }
      renderAdminTransfers();
    })
    .catch(err => alert("Erro: " + err.message));
}

function syncTransferToJetLeague(t) {
  // Move player between rosters on Jet League DB (write)
  window.jetDb.ref("liga/rosters").once("value").then(snap => {
    const rosters = snap.val() || {};
    const fromList = rosters[t.from] || [];
    const idx = fromList.findIndex(p => p.n === t.playerName);
    if (idx < 0) {
      alert("Agente não encontrado no elenco de origem na Jet League.");
      return;
    }
    const player = fromList.splice(idx, 1)[0];
    if (!rosters[t.to]) rosters[t.to] = [];
    rosters[t.to].push(player);
    return window.jetDb.ref("liga/rosters").set(rosters);
  }).then(() => {
    if (arguments.length) alert("Elenco da Jet League atualizado!");
  }).catch(err => {
    alert("Não foi possível escrever na Jet League (regras de segurança).\n" + (err.message || ""));
    console.error(err);
  });
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
          <option value="team-targets">Sugestão de alvos por time</option>
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
    else if (action === "team-targets") result = await aiTeamTargets();

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


async function aiTeamTargets() {
  const club = document.getElementById("aiClub")?.value;
  if (!club) throw new Error("Selecione a equipe interessada (time que vai buscar reforços)");
  const players = getAllPlayersFlat().filter(p => !p.freeAgent && p.club !== club && p.marketValue);
  const top = [...players].sort((a,b)=>(b.marketValue||0)-(a.marketValue||0)).slice(0, 25);
  const list = top.map(p =>
    `${p.name} | ${p.club} | ${p.rank} | ${formatUSD(p.marketValue,true)} | WR ${p.stats?.P ? Math.round(p.stats.winRate*100)+"%" : "—"} | ${p.stats?.P||0}P`
  ).join("\n");
  const extra = document.getElementById("aiExtra")?.value || "";
  const prompt = `Você é scout da Jet League. O time ${club} precisa de reforços.
Com base nesta lista de agentes de OUTROS times, sugira EXATAMENTE 3 alvos prioritários.

LISTA:
${list}

INSTRUÇÃO EXTRA: ${extra || "Nenhuma"}

Responda em português, formato:
1. NOME (TIME) — motivo em 2 frases. Valor estimado e encaixe tático/rank.
2. ...
3. ...`;
  const raw = await window.marketGenerateWithAI(prompt);
  return { club, text: raw.trim() };
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
  } else if (action === "team-targets") {
    title.textContent = "Alvos sugeridos · " + (data.club || "");
    body.innerHTML = `
      <div class="review-field full">
        <label>Sugestões da IA</label>
        <textarea id="revTeamTargets" rows="12"></textarea>
      </div>
      <p style="font-size:0.8rem;color:var(--text-muted)">Conteúdo narrativo para revisão. Nada é gravado automaticamente no banco.</p>
    `;
    setTimeout(() => {
      const ta = document.getElementById("revTeamTargets");
      if (ta) ta.value = data.text || "";
    }, 0);
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

  if (action === "import-values") {
    const mode = window._aiReviewData.mode || "full";
    const statsOnly = mode === "statsOnly";
    const updates = {};
    const season = window.AppState.jet.currentSeason || "Temporada 1";
    const inputs = document.querySelectorAll(".imp-val");
    const valueByIdx = {};
    inputs.forEach(input => {
      valueByIdx[Number(input.dataset.idx)] = Number(input.value);
    });

    data.forEach((r, i) => {
      const existing = window.AppState.market.players[r.key] || {};
      const value = statsOnly
        ? (existing.marketValue ?? r.oldValue ?? r.newValue)
        : (valueByIdx[i] != null ? valueByIdx[i] : r.newValue);

      let history = existing.valueHistory || [];
      if (!Array.isArray(history)) history = [];
      if (!statsOnly) {
        const hIdx = history.findIndex(h => h.season === season);
        if (hIdx >= 0) history[hIdx].value = value;
        else history.push({ season, value });
      }

      updates[r.key] = {
        ...existing,
        marketValue: value,
        peakValue: statsOnly
          ? (existing.peakValue || value)
          : Math.max(existing.peakValue || 0, r.peak || value),
        rank: r.rank,
        functionRole: r.func,
        trophy: r.trophy,
        stats: { P: r.P, V: r.V, D: r.D, winRate: r.wr },
        statsRound: "Import " + new Date().toISOString().slice(0, 10),
        nationality: r.nationality || existing.nationality || "Brasil",
        age: r.age || existing.age || 24,
        photo: r.photo || existing.photo || "",
        salary: existing.salary ?? r.salary ?? null,
        releaseClause: existing.releaseClause ?? r.releaseClause ?? null,
        contractUntil: existing.contractUntil || "Temporada 4",
        status: existing.status || "ativo",
        valueHistory: history
      };
    });

    window.marketDb.ref("players").update(updates)
      .then(() => {
        alert(`${Object.keys(updates).length} agentes atualizados!`);
        closeAIReviewModal();
        if (isLogged) renderAdminImport();
      })
      .catch(err => alert("Erro: " + err.message));
  }

  if (action === "market-analysis") {
    const text = document.getElementById("revAnalysisText")?.value?.trim() || data.text;
    const box = document.getElementById("marketAnalysisBox");
    const el = document.getElementById("marketAnalysisText");
    if (box) box.style.display = "block";
    if (el) el.textContent = text;
    closeAIReviewModal();
  }

  if (action === "team-targets") {
    // Apenas fecha após revisão (conteúdo informativo)
    closeAIReviewModal();
    alert("Sugestões revisadas. Use como referência narrativa — nada foi gravado automaticamente.");
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
window.processImportFile = processImportFile;
window.forceReseedFromCode = forceReseedFromCode;
window.setTransferWindow = setTransferWindow;
window.saveJetLeagueUrl = saveJetLeagueUrl;
window.syncTransferToJetLeague = syncTransferToJetLeague;
window.renderCompare = typeof renderCompare !== "undefined" ? renderCompare : function(){};
window.closeAIReviewModal = closeAIReviewModal;
window.confirmAIReview = confirmAIReview;
window.initAuth = initAuth;
