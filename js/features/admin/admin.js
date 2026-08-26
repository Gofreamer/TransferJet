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
      <button class="admin-tab ${tab==='photos'?'active':''}" onclick="renderAdminPanel('photos')">Fotos</button>
      <button class="admin-tab ${tab==='import'?'active':''}" onclick="renderAdminPanel('import')">Importar Excel</button>
      <button class="admin-tab ${tab==='transfers'?'active':''}" onclick="renderAdminPanel('transfers')">Transferências</button>
      <button class="admin-tab ${tab==='rumors'?'active':''}" onclick="renderAdminPanel('rumors')">Rumores</button>
      <button class="admin-tab ${tab==='ai'?'active':''}" onclick="renderAdminPanel('ai')">IA</button>
      <button class="admin-tab ${tab==='fantasy'?'active':''}" onclick="renderAdminPanel('fantasy')">Fantasy</button>
    </div>
    <div id="adminTabContent"></div>
  `;

  if (tab === "values") renderAdminValues();
  if (tab === "photos" && typeof renderAdminPhotos === "function") renderAdminPhotos();
  if (tab === "import") renderAdminImport();
  if (tab === "transfers") renderAdminTransfers();
  if (tab === "rumors") renderAdminRumors();
  if (tab === "ai") renderAdminAI();
  if (tab === "fantasy" && typeof renderFantasyAdmin === "function") renderFantasyAdmin();
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
      <span style="font-size:0.8rem;color:var(--text-muted)">Match por <strong>nome</strong> (migra time automaticamente). Célula Troféu vazia <strong>não apaga</strong> títulos do perfil. Títulos detalhados (🥇🥈🏆🏅) se editam em Admin → Valores.</span><br>
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

    <h3 class="admin-section-title" style="margin-top:32px">Sincronizar stats da Jet League</h3>
    <p class="admin-sub">
      Lê as partidas oficiais (<code>liga/matches</code>), identifica quem lutou pelo <strong>nome</strong>, soma P / V / D e registra MVP da série / Destaque da Rodada.
      Sempre passa por <strong>revisão</strong> antes de gravar. Partidas já sincronizadas aparecem marcadas (não somam de novo, salvo se forçar).
    </p>
    <div class="admin-form-grid">
      <div>
        <label>Temporada</label>
        <select id="syncSeason" onchange="refreshSyncRoundOptions()"></select>
      </div>
      <div>
        <label>Rodada</label>
        <select id="syncRound"></select>
      </div>
    </div>
    <div class="import-options" style="margin-top:10px">
      <label><input type="radio" name="syncMode" value="full" checked> Atualizar stats + recalcular valor</label>
      <label><input type="radio" name="syncMode" value="statsOnly"> Só atualizar stats (manter valores)</label>
    </div>
    <label style="display:flex;align-items:center;gap:8px;margin-top:10px;font-size:0.85rem;color:var(--text-muted)">
      <input type="checkbox" id="syncForceResync"> Forçar reprocessar partidas já sincronizadas
    </label>
    <label style="display:flex;align-items:center;gap:8px;margin-top:8px;font-size:0.85rem;color:var(--text-muted)">
      <input type="checkbox" id="syncIgnoreAwards"> Ignorar bônus de MVP / Destaque nesta sync
    </label>
    <div class="admin-actions" style="margin-top:14px;gap:10px;display:flex;flex-wrap:wrap">
      <button class="btn-primary" onclick="previewJetLeagueSync()">Analisar rodada e revisar</button>
      <button class="btn-gray" onclick="exportMarketSnapshot()">Exportar snapshot (planilha)</button>
    </div>
    <p id="syncStatus" style="margin-top:12px;font-size:0.85rem;color:var(--text-muted)"></p>
    <div id="syncMatchList" style="margin-top:8px;font-size:0.8rem;color:var(--text-muted)"></div>

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
  populateSyncSelectors();
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
  const migrations = [];
  const allPlayers = getAllPlayersFlat();
  const marketPlayers = window.AppState.market.players || {};

  // Índice por nome (primeiro match) e por key
  const byName = {};
  allPlayers.forEach(p => {
    const n = p.name.toLowerCase();
    if (!byName[n]) byName[n] = p;
  });
  // Também varre market keys que possam não estar no elenco Jet
  Object.entries(marketPlayers).forEach(([key, m]) => {
    const name = (m.name || key.split("_").slice(1).join("_") || "").toLowerCase();
    if (name && !byName[name]) {
      byName[name] = { key, name: m.name || name, club: key.split("_")[0], ...m };
    }
  });

  for (const row of rows) {
    const team = String(row["Equipe"] || row["equipe"] || row["Team"] || "").trim();
    const name = String(row["Agente"] || row["agente"] || row["Nome"] || row["name"] || "").trim();
    if (!team || !name) continue;

    const rank = String(row["Rank"] || row["rank"] || "").trim();
    const func = String(row["Função"] || row["Funcao"] || row["função"] || row["Function"] || "").trim();
    const trophyRaw = String(row["Troféu"] || row["Trofeu"] || row["troféu"] || "").trim();
    const P = Number(row["P"] || row["Partidas"] || 0) || 0;
    const V = Number(row["V"] || row["Vitórias"] || row["Vitorias"] || 0) || 0;
    const D = Number(row["D"] || row["Derrotas"] || 0) || 0;

    const newKey = team + "_" + name;
    const nameKey = name.toLowerCase();
    const found = byName[nameKey];

    let existing = marketPlayers[newKey] || {};
    let oldKey = null;
    let migrated = false;

    // Match por nome: se time mudou, migra o registro antigo
    if (found) {
      const foundKey = found.key;
      if (foundKey !== newKey && marketPlayers[foundKey]) {
        existing = { ...marketPlayers[foundKey] };
        oldKey = foundKey;
        migrated = true;
        migrations.push({ name, from: found.club || foundKey.split("_")[0], to: team });
      } else if (marketPlayers[foundKey]) {
        existing = { ...marketPlayers[foundKey] };
      }
    }

    // Títulos: célula vazia NÃO apaga o que já está salvo
    const prevTitles = normalizeTitlesAdmin(existing);
    let titles = { ...prevTitles };
    let trophyNum = window.VALUATION.totalTitles(titles);

    if (trophyRaw !== "") {
      // Planilha trouxe número → atualiza total legado (não zera tipos específicos do Admin)
      const n = parseInt(trophyRaw, 10);
      if (!isNaN(n) && n >= 0) {
        trophyNum = n;
        // Se não havia titles estruturados, assume Nacional
        if (!existing.titles) {
          titles = { nacional: n, lji: 0, mundial: 0, eventoEspecial: 0 };
        }
      } else if (trophyRaw) {
        // Qualquer texto não-vazio conta como pelo menos 1 (compat)
        trophyNum = Math.max(trophyNum, 1);
        if (!existing.titles) titles.nacional = Math.max(titles.nacional, 1);
      }
    }

    const calc = window.VALUATION.calculate({
      rank, func,
      role: /emerg/i.test(func) ? "emergencia" : (/reserva/i.test(func) ? "reserva" : "titular"),
      trophy: trophyNum,
      titles,
      P, V, D, team
    });

    const matched = !!(found || marketPlayers[newKey]);
    if (!matched) {
      unmatched.push({ team, name, rank, P, V, D });
    }

    results.push({
      key: newKey,
      oldKey,
      migrated,
      name, team, rank, func,
      trophy: trophyNum,
      titles,
      P, V, D, wr: calc.wr,
      oldValue: existing.marketValue || null,
      newValue: calc.value,
      peak: calc.peak,
      matched,
      nationality: existing.nationality || "Brasil",
      age: existing.age || 24,
      photo: existing.photo || "",
      salary: existing.salary ?? null,
      releaseClause: existing.releaseClause ?? null,
      // dados a preservar na migração
      _existing: existing
    });
  }
  results._unmatched = unmatched;
  results._migrations = migrations;
  return results.sort((a, b) => b.newValue - a.newValue);
}

function normalizeTitlesAdmin(m) {
  const t = (m && m.titles) || {};
  const titles = {
    nacional: Number(t.nacional) || 0,
    lji: Number(t.lji) || 0,
    mundial: Number(t.mundial) || 0,
    eventoEspecial: Number(t.eventoEspecial) || 0
  };
  if (!m?.titles && (m?.trophy > 0)) {
    titles.nacional = Number(m.trophy) || 0;
  }
  return titles;
}

function showImportReviewModal(calculated, mode) {
  const overlay = document.getElementById("aiReviewOverlay");
  const body = document.getElementById("aiReviewBody");
  const title = document.getElementById("aiReviewTitle");
  const unmatched = calculated._unmatched || [];
  const migrations = calculated._migrations || [];
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
    ${migrations.length ? `
      <div class="rumor-card" style="border-color:var(--cyan);margin-bottom:12px">
        <strong style="color:var(--cyan)">🔄 Trocas de time detectadas (${migrations.length})</strong>
        <div style="font-size:0.8rem;margin-top:6px;color:var(--text-muted)">
          ${migrations.slice(0, 10).map(m => `${m.name}: ${m.from} → ${m.to}`).join(" · ")}
          ${migrations.length > 10 ? "…" : ""}
        </div>
        <p style="font-size:0.75rem;margin-top:6px;color:var(--text-dim)">Histórico, valor e títulos serão migrados para o novo clube.</p>
      </div>
    ` : ""}
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
    <p style="font-size:0.8rem;color:var(--text-muted);margin:0 0 10px">
      Títulos: 🥇 Nacional · 🥈 L.J.I · 🏆 Mundial · 🏅 Evento — edite e clique Salvar. Célula vazia no Excel <strong>não apaga</strong> títulos.
    </p>
    <div class="admin-table-wrap">
      <table class="admin-table" id="adminValuesTable">
        <thead>
          <tr>
            <th>Agente</th>
            <th>Equipe</th>
            <th>Valor</th>
            <th>Pico</th>
            <th>Títulos</th>
            <th>Salário</th>
            <th>Cláusula</th>
            <th>Idade</th>
            <th>Nac.</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${players.map(p => {
            const t = p.titles || {};
            return `
            <tr data-key="${p.key}" data-name="${p.name.toLowerCase()}" data-club="${p.club}">
              <td><strong>${p.name}</strong></td>
              <td>${p.club}</td>
              <td><input type="number" class="admin-input" data-field="marketValue" value="${p.marketValue || ""}" placeholder="0"></td>
              <td><input type="number" class="admin-input" data-field="peakValue" value="${p.peakValue || ""}" placeholder="0"></td>
              <td>
                <div class="admin-titles-cell">
                  <label title="Nacional">🥇<input type="number" class="admin-input admin-title" data-title="nacional" min="0" value="${t.nacional || 0}"></label>
                  <label title="L.J.I">🥈<input type="number" class="admin-input admin-title" data-title="lji" min="0" value="${t.lji || 0}"></label>
                  <label title="Mundial">🏆<input type="number" class="admin-input admin-title" data-title="mundial" min="0" value="${t.mundial || 0}"></label>
                  <label title="Evento Especial">🏅<input type="number" class="admin-input admin-title" data-title="eventoEspecial" min="0" value="${t.eventoEspecial || 0}"></label>
                </div>
              </td>
              <td><input type="number" class="admin-input" data-field="salary" value="${p.salary || ""}" placeholder="—"></td>
              <td><input type="number" class="admin-input" data-field="releaseClause" value="${p.releaseClause || ""}" placeholder="—"></td>
              <td><input type="number" class="admin-input admin-input-sm" data-field="age" value="${p.age || ""}" placeholder="—"></td>
              <td><input type="text" class="admin-input admin-input-sm" data-field="nationality" value="${p.nationality || ""}" placeholder="—"></td>
              <td><button class="btn-primary btn-sm" onclick="savePlayerRow(this)">Salvar</button></td>
            </tr>`;
          }).join("")}
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
  tr.querySelectorAll(".admin-input:not(.admin-title)").forEach(input => {
    const field = input.dataset.field;
    if (!field) return;
    let val = input.value.trim();
    if (["marketValue", "peakValue", "age", "salary", "releaseClause"].includes(field)) {
      val = val === "" ? null : Number(val);
    }
    if (val !== null && val !== "") data[field] = val;
  });

  // Títulos por tipo
  const titles = { nacional: 0, lji: 0, mundial: 0, eventoEspecial: 0 };
  tr.querySelectorAll(".admin-title").forEach(input => {
    const type = input.dataset.title;
    if (type) titles[type] = Math.max(0, Number(input.value) || 0);
  });
  data.titles = titles;
  data.trophy = (titles.nacional || 0) + (titles.lji || 0) + (titles.mundial || 0) + (titles.eventoEspecial || 0);

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
      // Migra registro do Market (valor, títulos, histórico) para a nova key
      if (status === "oficial") {
        migrateMarketPlayerOnTransfer(opt.value, opt.dataset.name, from, to);
      }
      alert("Transferência registrada!");
      if (status === "oficial" && confirm("Aplicar também no elenco da Jet League?\n(Requer permissão de escrita no Firebase da liga)")) {
        syncTransferToJetLeague(payload);
      }
      renderAdminTransfers();
    })
    .catch(err => alert("Erro: " + err.message));
}

/** Move o registro do Market quando o agente troca de time (preserva valor, títulos, histórico). */
function migrateMarketPlayerOnTransfer(oldKey, playerName, fromClub, toClub) {
  const newKey = toClub + "_" + playerName;
  if (oldKey === newKey) return Promise.resolve();

  const existing = window.AppState.market.players[oldKey];
  if (!existing) {
    // Tenta achar por nome em qualquer key
    const found = Object.entries(window.AppState.market.players || {}).find(([k, m]) => {
      const n = (m.name || k.split("_").slice(1).join("_") || "").toLowerCase();
      return n === playerName.toLowerCase();
    });
    if (!found) return Promise.resolve();
    const [foundKey, foundData] = found;
    if (foundKey === newKey) return Promise.resolve();
    const payload = { ...foundData, name: playerName, team: toClub };
    return window.marketDb.ref("players/" + newKey).set(payload)
      .then(() => window.marketDb.ref("players/" + foundKey).remove());
  }

  const payload = { ...existing, name: playerName, team: toClub };
  return window.marketDb.ref("players/" + newKey).set(payload)
    .then(() => window.marketDb.ref("players/" + oldKey).remove())
    .catch(err => console.warn("Migração Market falhou:", err));
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
    console.error("[AI]", err);
    const msg = err?.message || String(err);
    status.textContent = "Erro na IA: " + msg;
    // Fallback local só para rumor simples
    if (action === "rumor") {
      try {
        const fallback = localRumorFallback();
        openAIReviewModal(action, fallback);
        status.textContent = "IA falhou (" + msg.slice(0, 80) + ") — fallback local. Revise antes de publicar.";
      } catch (_) {}
    } else {
      alert("IA indisponível:\n" + msg + "\n\nConfira se o Firebase AI Logic está ativo no projeto Jet League (teste-jet) ou no Market.");
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
  const overlay = document.getElementById("aiReviewOverlay");
  overlay.classList.remove("open");
  const primaryAction = overlay.querySelector(".review-actions .btn-primary");
  if (primaryAction) primaryAction.style.display = "";
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
    const deletes = [];
    const season = window.AppState.jet.currentSeason || "Temporada 1";
    const inputs = document.querySelectorAll(".imp-val");
    const valueByIdx = {};
    inputs.forEach(input => {
      valueByIdx[Number(input.dataset.idx)] = Number(input.value);
    });

    data.forEach((r, i) => {
      // Fonte: registro migrado (oldKey) ou o da nova key
      const existing = r._existing || window.AppState.market.players[r.oldKey] || window.AppState.market.players[r.key] || {};
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

      const titles = r.titles || normalizeTitlesAdmin(existing);
      const trophyTotal = window.VALUATION.totalTitles(titles, r.trophy);

      updates[r.key] = {
        ...existing,
        name: r.name,
        team: r.team,
        marketValue: value,
        peakValue: statsOnly
          ? (existing.peakValue || value)
          : Math.max(existing.peakValue || 0, r.peak || value),
        rank: r.rank,
        functionRole: r.func,
        trophy: trophyTotal,
        titles,
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

      // Remove key antiga se houve migração de time
      if (r.oldKey && r.oldKey !== r.key) {
        deletes.push(r.oldKey);
        updates[r.oldKey] = null; // Firebase update com null = remove
      }
    });

    window.marketDb.ref("players").update(updates)
      .then(() => {
        const migMsg = deletes.length ? ` (${deletes.length} migrados de time)` : "";
        alert(`${Object.keys(updates).filter(k => updates[k] != null).length} agentes atualizados!${migMsg}`);
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

  if (action === "fantasy-process-round") {
    if (typeof confirmFantasyProcessRound === "function") {
      confirmFantasyProcessRound();
    }
    return;
  }

  if (action === "sync-jet-stats") {
    const mode = window._aiReviewData.mode || "full";
    const statsOnly = mode === "statsOnly";
    const matchIds = window._aiReviewData.matchIdsToMark || [];
    const season = window._aiReviewData.season || "";
    const round = window._aiReviewData.round;
    const ignoreAwards = !!window._aiReviewData.ignoreAwards;
    const updates = {};
    const seasonLabel = window.AppState.jet.currentSeason || season || "Temporada 1";
    const inputs = document.querySelectorAll(".sync-val");
    const valueByIdx = {};
    inputs.forEach(input => {
      valueByIdx[Number(input.dataset.idx)] = Number(input.value);
    });

    data.forEach((r, i) => {
      const existing = r._existing || window.AppState.market.players[r.key] || {};
      const value = statsOnly
        ? (existing.marketValue ?? r.oldValue ?? null)
        : (valueByIdx[i] != null ? valueByIdx[i] : r.newValue);

      let history = existing.valueHistory || [];
      if (!Array.isArray(history)) history = [];
      if (!statsOnly && value != null) {
        const hIdx = history.findIndex(h => h.season === seasonLabel);
        if (hIdx >= 0) history[hIdx].value = value;
        else history.push({ season: seasonLabel, value });
      }

      const titles = r.titles || normalizeTitlesAdmin(existing);
      const trophyTotal = window.VALUATION.totalTitles
        ? window.VALUATION.totalTitles(titles, r.trophy)
        : (r.trophy || 0);

      // Contadores de prêmios: só sobem se não estiver ignorando
      const mvpCount = ignoreAwards
        ? (Number(existing.mvpCount) || 0)
        : (r.mvpCount != null ? r.mvpCount : (Number(existing.mvpCount) || 0));
      const destaqueCount = ignoreAwards
        ? (Number(existing.destaqueCount) || 0)
        : (r.destaqueCount != null ? r.destaqueCount : (Number(existing.destaqueCount) || 0));

      const payload = {
        ...existing,
        name: r.name,
        team: r.team,
        rank: r.rank || existing.rank,
        functionRole: r.func || existing.functionRole,
        trophy: trophyTotal,
        titles,
        stats: { P: r.P, V: r.V, D: r.D, winRate: r.wr },
        mvpCount,
        destaqueCount,
        statsRound: `Sync Jet · ${season} · Rodada ${round}`,
        nationality: r.nationality || existing.nationality || "Brasil",
        age: r.age || existing.age || 24,
        photo: r.photo || existing.photo || "",
        salary: existing.salary ?? null,
        releaseClause: existing.releaseClause ?? null,
        contractUntil: existing.contractUntil || "Temporada 4",
        status: existing.status || "ativo",
        valueHistory: history
      };

      if (value != null) {
        payload.marketValue = value;
        payload.peakValue = statsOnly
          ? (existing.peakValue || value)
          : Math.max(existing.peakValue || 0, r.peak || value);
      }

      updates["players/" + r.key] = payload;
    });

    // Marca partidas como sincronizadas
    matchIds.filter(Boolean).forEach(id => {
      updates["settings/syncedMatches/" + id] = {
        at: new Date().toISOString(),
        season,
        round,
        mode
      };
    });

    window.marketDb.ref().update(updates)
      .then(() => {
        alert(`${data.length} agentes atualizados · ${matchIds.length} partida(s) marcada(s) como sincronizada(s).`);
        closeAIReviewModal();
        if (isLogged) renderAdminImport();
      })
      .catch(err => alert("Erro: " + err.message));
  }

  if (action === "team-targets") {
    // Apenas fecha após revisão (conteúdo informativo)
    closeAIReviewModal();
    alert("Sugestões revisadas. Use como referência narrativa — nada foi gravado automaticamente.");
  }
}


/* ========== SYNC STATS DA JET LEAGUE ========== */

function normalizeAgentName(n) {
  return String(n || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function getSyncedMatchMap() {
  return (window.AppState.market.settings && window.AppState.market.settings.syncedMatches) || {};
}

function listMatchesGrouped() {
  const matches = window.AppState.jet.matches || [];
  const list = Array.isArray(matches) ? matches : Object.values(matches);
  const bySeason = {};
  list.forEach(m => {
    if (!m || !m.timeA || !m.timeB) return;
    const season = m.temporada || window.AppState.jet.currentSeason || "Temporada ?";
    const round = Number(m.rodada) || 0;
    if (!bySeason[season]) bySeason[season] = {};
    if (!bySeason[season][round]) bySeason[season][round] = [];
    bySeason[season][round].push(m);
  });
  return bySeason;
}

function populateSyncSelectors() {
  const seasonEl = document.getElementById("syncSeason");
  const roundEl = document.getElementById("syncRound");
  if (!seasonEl || !roundEl) return;

  const grouped = listMatchesGrouped();
  const seasons = Object.keys(grouped).sort();
  const current = window.AppState.jet.currentSeason || "";

  seasonEl.innerHTML = seasons.length
    ? seasons.map(s => `<option value="${s}" ${s === current ? "selected" : ""}>${s}</option>`).join("")
    : `<option value="">Nenhuma partida no Firebase</option>`;

  refreshSyncRoundOptions();
}

function refreshSyncRoundOptions() {
  const seasonEl = document.getElementById("syncSeason");
  const roundEl = document.getElementById("syncRound");
  const listEl = document.getElementById("syncMatchList");
  if (!seasonEl || !roundEl) return;

  const grouped = listMatchesGrouped();
  const season = seasonEl.value;
  const rounds = Object.keys(grouped[season] || {}).map(Number).sort((a, b) => a - b);
  const synced = getSyncedMatchMap();

  // Guarda a seleção atual para não resetar ao reconstruir as opções
  const prevValue = roundEl.value;

  roundEl.innerHTML = rounds.length
    ? rounds.map(r => {
        const ms = grouped[season][r] || [];
        const allSynced = ms.length && ms.every(m => m.id && synced[m.id]);
        const label = r === 0 ? "Sem rodada (0)" : `Rodada ${r}`;
        return `<option value="${r}">${label} · ${ms.length} partida(s)${allSynced ? " · já sync" : ""}</option>`;
      }).join("")
    : `<option value="">—</option>`;

  // Restaura a seleção se ainda existir na lista
  if (prevValue !== "" && rounds.includes(Number(prevValue))) {
    roundEl.value = prevValue;
  }

  // Atualiza só a lista de partidas (sem reconstruir o select)
  function updateMatchList() {
    if (!listEl) return;
    const r = Number(roundEl.value);
    const ms = (grouped[season] && grouped[season][r]) || [];
    listEl.innerHTML = ms.length
      ? `<strong>Partidas nesta rodada:</strong><br>` + ms.map(m => {
          const done = m.id && synced[m.id];
          const fights = Array.isArray(m.fights) ? m.fights.length : 0;
          return `• ${m.timeA} ${m.scoreA}×${m.scoreB} ${m.timeB} · ${fights} luta(s)${done ? " · <span style='color:var(--green)'>já sincronizada</span>" : ""}`;
        }).join("<br>")
      : "Nenhuma partida encontrada para esta combinação.";
  }

  updateMatchList();

  // onchange da rodada só atualiza a lista, não reconstrói opções
  roundEl.onchange = updateMatchList;
}

/** Extrai participantes de uma partida (por nome + time da série). */
function extractMatchParticipants(m) {
  const participants = new Map(); // nameKey -> { name, team, played }
  const fights = Array.isArray(m.fights) ? m.fights : [];

  fights.forEach(f => {
    const agentsA = f.teamA?.agents || (Array.isArray(f.teamA) ? f.teamA : []) || [];
    const agentsB = f.teamB?.agents || (Array.isArray(f.teamB) ? f.teamB : []) || [];
    agentsA.filter(Boolean).forEach(name => {
      const k = normalizeAgentName(name);
      if (!participants.has(k)) participants.set(k, { name: String(name).trim(), team: m.timeA, played: true });
    });
    agentsB.filter(Boolean).forEach(name => {
      const k = normalizeAgentName(name);
      if (!participants.has(k)) participants.set(k, { name: String(name).trim(), team: m.timeB, played: true });
    });
  });

  return { participants, hasFights: fights.length > 0 };
}

function buildNameIndex() {
  const byName = {};
  getAllPlayersFlat().forEach(p => {
    const k = normalizeAgentName(p.name);
    if (!byName[k]) byName[k] = p;
  });
  // Market-only keys
  Object.entries(window.AppState.market.players || {}).forEach(([key, m]) => {
    const name = m.name || key.split("_").slice(1).join("_");
    const k = normalizeAgentName(name);
    if (k && !byName[k]) {
      byName[k] = { key, name, club: key.split("_")[0], rank: m.rank, functionRole: m.functionRole, ...m };
    }
  });
  return byName;
}

function previewJetLeagueSync() {
  const status = document.getElementById("syncStatus");
  const season = document.getElementById("syncSeason")?.value;
  const round = Number(document.getElementById("syncRound")?.value);
  const mode = document.querySelector('input[name="syncMode"]:checked')?.value || "full";
  const force = !!document.getElementById("syncForceResync")?.checked;
  const ignoreAwards = !!document.getElementById("syncIgnoreAwards")?.checked;

  if (!season && season !== "") {
    if (status) status.textContent = "Selecione temporada e rodada.";
    return;
  }

  const grouped = listMatchesGrouped();
  const matches = (grouped[season] && grouped[season][round]) || [];
  if (!matches.length) {
    if (status) status.textContent = "Nenhuma partida nesta rodada.";
    return;
  }

  const synced = getSyncedMatchMap();
  const byName = buildNameIndex();

  // Agrega deltas por agente
  const agentMap = {}; // key -> row
  const unmatched = [];
  const matchSummaries = [];
  const matchIdsToMark = [];
  let skippedSynced = 0;
  let matchesWithoutFights = 0;

  matches.forEach(m => {
    const already = m.id && synced[m.id];
    if (already && !force) {
      skippedSynced++;
      matchSummaries.push({
        id: m.id,
        label: `${m.timeA} ${m.scoreA}×${m.scoreB} ${m.timeB}`,
        status: "skipped",
        reason: "já sincronizada"
      });
      return;
    }

    const { participants, hasFights } = extractMatchParticipants(m);
    if (!hasFights) {
      matchesWithoutFights++;
      matchSummaries.push({
        id: m.id,
        label: `${m.timeA} ${m.scoreA}×${m.scoreB} ${m.timeB}`,
        status: "warn",
        reason: "sem lutas (fights) — ignorada"
      });
      return;
    }

    const winnerTeam = (Number(m.scoreA) > Number(m.scoreB)) ? m.timeA
      : (Number(m.scoreB) > Number(m.scoreA)) ? m.timeB : null;

    // MVP da série e Destaque da Rodada (campos já gravados na Jet League)
    const mvpName = (m.seriesMvp && m.seriesMvp.agent) || m.mvp || "";
    const destaqueName = m.destaqueRodada || "";
    const mvpKey = mvpName ? normalizeAgentName(mvpName) : "";
    const destaqueKey = destaqueName ? normalizeAgentName(destaqueName) : "";

    const awardBits = [];
    if (mvpName) awardBits.push(`⭐ MVP: ${mvpName}`);
    if (destaqueName) awardBits.push(`🌟 Destaque: ${destaqueName}`);

    matchIdsToMark.push(m.id);
    matchSummaries.push({
      id: m.id,
      label: `${m.timeA} ${m.scoreA}×${m.scoreB} ${m.timeB}`,
      status: already ? "resync" : "ok",
      reason: `${participants.size} agente(s)${awardBits.length ? " · " + awardBits.join(" · ") : ""}`,
      already
    });

    participants.forEach((info, nameKey) => {
      const found = byName[nameKey];
      if (!found) {
        unmatched.push({ name: info.name, team: info.team, match: matchSummaries[matchSummaries.length - 1].label });
        return;
      }

      const key = found.key;
      if (!agentMap[key]) {
        const existing = window.AppState.market.players[key] || {};
        const st = existing.stats || {};
        agentMap[key] = {
          key,
          name: found.name,
          team: found.club || info.team,
          rank: existing.rank || found.rank || "—",
          func: existing.functionRole || found.functionRole || "",
          titles: (typeof normalizeTitlesAdmin === "function" ? normalizeTitlesAdmin(existing) : (existing.titles || {})),
          trophy: existing.trophy || 0,
          oldP: Number(st.P) || 0,
          oldV: Number(st.V) || 0,
          oldD: Number(st.D) || 0,
          oldMvp: Number(existing.mvpCount) || 0,
          oldDestaque: Number(existing.destaqueCount) || 0,
          addP: 0,
          addV: 0,
          addD: 0,
          addMvp: 0,
          addDestaque: 0,
          matches: [],
          oldValue: existing.marketValue ?? null,
          nationality: existing.nationality || "Brasil",
          age: existing.age || 24,
          photo: existing.photo || "",
          _existing: existing
        };
      }

      const row = agentMap[key];
      row.addP += 1;
      if (winnerTeam && info.team === winnerTeam) row.addV += 1;
      else if (winnerTeam) row.addD += 1;
      // empate de série (raro na liga) → só P
      row.matches.push(m.id || matchSummaries[matchSummaries.length - 1].label);

      if (mvpKey && nameKey === mvpKey) row.addMvp += 1;
      if (destaqueKey && nameKey === destaqueKey) row.addDestaque += 1;
    });
  });

  const rows = Object.values(agentMap).map(r => {
    const P = r.oldP + r.addP;
    const V = r.oldV + r.addV;
    const D = r.oldD + r.addD;
    // Se ignorar prêmios: não incrementa contadores nem aplica bônus novo
    const mvpCount = ignoreAwards ? r.oldMvp : (r.oldMvp + r.addMvp);
    const destaqueCount = ignoreAwards ? r.oldDestaque : (r.oldDestaque + r.addDestaque);
    const calc = window.VALUATION.calculate({
      rank: r.rank,
      func: r.func,
      role: /emerg/i.test(r.func) ? "emergencia" : (/reserva/i.test(r.func) ? "reserva" : "titular"),
      trophy: r.trophy,
      titles: r.titles,
      P, V, D,
      team: r.team,
      mvpCount,
      destaqueCount
    });
    return {
      ...r,
      P, V, D,
      mvpCount,
      destaqueCount,
      applyAwards: !ignoreAwards,
      wr: calc.wr,
      newValue: calc.value,
      peak: calc.peak
    };
  }).sort((a, b) => b.addP - a.addP || a.name.localeCompare(b.name));

  if (status) {
    const awardsNote = ignoreAwards ? " · prêmios ignorados" : "";
    status.textContent = `${rows.length} agentes com delta · ${matchIdsToMark.length} partida(s) a sincronizar · ${skippedSynced} já sync ignorada(s)${awardsNote}`;
  }

  showSyncReviewModal({
    rows,
    unmatched,
    matchSummaries,
    matchIdsToMark,
    mode,
    season,
    round,
    force,
    ignoreAwards
  });
}

function showSyncReviewModal(payload) {
  const { rows, unmatched, matchSummaries, matchIdsToMark, mode, season, round, ignoreAwards } = payload;
  const overlay = document.getElementById("aiReviewOverlay");
  const body = document.getElementById("aiReviewBody");
  const title = document.getElementById("aiReviewTitle");
  const statsOnly = mode === "statsOnly";

  window._aiReviewData = {
    action: "sync-jet-stats",
    data: rows,
    mode,
    matchIdsToMark,
    season,
    round,
    ignoreAwards: !!ignoreAwards
  };

  title.textContent = `Revisar sync Jet League · ${season} · Rodada ${round}`;

  const mvpTotal = rows.reduce((s, r) => s + (r.addMvp || 0), 0);
  const destTotal = rows.reduce((s, r) => s + (r.addDestaque || 0), 0);

  body.innerHTML = `
    <div class="import-summary">
      <div class="kpi"><div class="kpi-label">Agentes</div><div class="kpi-value">${rows.length}</div></div>
      <div class="kpi"><div class="kpi-label">Partidas OK</div><div class="kpi-value" style="color:var(--green)">${matchIdsToMark.length}</div></div>
      <div class="kpi"><div class="kpi-label">Sem luta / skip</div><div class="kpi-value" style="color:var(--orange)">${matchSummaries.filter(m => m.status !== "ok" && m.status !== "resync").length}</div></div>
      <div class="kpi"><div class="kpi-label">Não achados</div><div class="kpi-value" style="color:var(--red)">${unmatched.length}</div></div>
    </div>
    <p style="font-size:0.85rem;color:var(--cyan);margin-bottom:10px">
      Modo: <strong>${statsOnly ? "somente stats" : "stats + recalcular valor"}</strong>.
      P/V/D são <strong>somados</strong> ao que já está no perfil (não substituem a temporada inteira).
      ${ignoreAwards
        ? `<br><span style="color:var(--orange)">Bônus de MVP/Destaque <strong>ignorados</strong> nesta sync (contadores não sobem).</span>`
        : `<br>Prêmios detectados nesta rodada: <strong>⭐ ${mvpTotal} MVP</strong> · <strong>🌟 ${destTotal} Destaque</strong> (+4% / +7% no valor).`
      }
    </p>
    <div class="rumor-card" style="margin-bottom:12px">
      <strong>Partidas</strong>
      <div style="font-size:0.8rem;margin-top:6px;color:var(--text-muted)">
        ${matchSummaries.map(m => {
          const color = m.status === "ok" ? "var(--green)" : m.status === "resync" ? "var(--cyan)" : "var(--orange)";
          return `<div style="color:${color}">• ${m.label} — ${m.reason}</div>`;
        }).join("") || "—"}
      </div>
    </div>
    ${unmatched.length ? `
      <div class="rumor-card" style="border-color:var(--orange);margin-bottom:12px">
        <strong style="color:var(--orange)">⚠ Nomes nas lutas sem match no Market (${unmatched.length})</strong>
        <div style="font-size:0.8rem;margin-top:6px;color:var(--text-muted)">
          ${unmatched.slice(0, 20).map(u => `${u.name} (${u.team})`).join(" · ")}
          ${unmatched.length > 20 ? "…" : ""}
        </div>
        <p style="font-size:0.75rem;margin-top:6px">Confira ortografia no elenco / Market. Esses não serão atualizados.</p>
      </div>
    ` : ""}
    <div class="admin-table-wrap" style="max-height:360px;overflow:auto">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Agente</th><th>Time</th>
            <th>ΔP</th><th>ΔV</th><th>ΔD</th>
            <th>⭐</th><th>🌟</th>
            <th>P-V-D final</th>
            <th>Valor atual</th>
            <th>Novo valor</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r, i) => `
            <tr>
              <td><strong>${r.name}</strong></td>
              <td>${r.team}</td>
              <td style="color:var(--cyan)">+${r.addP}</td>
              <td style="color:var(--green)">+${r.addV}</td>
              <td style="color:var(--red)">+${r.addD}</td>
              <td style="color:var(--cyan)">${r.addMvp ? "+" + r.addMvp : "—"}</td>
              <td style="color:var(--cyan)">${r.addDestaque ? "+" + r.addDestaque : "—"}</td>
              <td>${r.P}-${r.V}-${r.D}</td>
              <td style="color:var(--text-muted)">${r.oldValue != null ? formatUSD(r.oldValue, true) : "—"}</td>
              <td>${statsOnly
                ? (r.oldValue != null ? formatUSD(r.oldValue, true) : "—")
                : `<input type="number" class="admin-input sync-val" data-idx="${i}" value="${r.newValue}" style="width:120px">`
              }</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
  overlay.classList.add("open");
}


/** Exporta snapshot atual do Market (P/V/D, valores, prêmios) em planilha .xlsx */
function exportMarketSnapshot() {
  if (typeof XLSX === "undefined") {
    alert("Biblioteca XLSX não carregada. Recarregue a página e tente de novo.");
    return;
  }
  const players = window.AppState.market.players || {};
  const rows = Object.entries(players).map(([key, p]) => {
    const st = p.stats || {};
    return {
      key,
      name: p.name || key.split("_").slice(1).join("_"),
      team: p.team || key.split("_")[0] || "",
      rank: p.rank || "",
      functionRole: p.functionRole || "",
      P: Number(st.P) || 0,
      V: Number(st.V) || 0,
      D: Number(st.D) || 0,
      winRate: st.winRate != null ? st.winRate : (st.P > 0 ? +(st.V / st.P).toFixed(3) : ""),
      marketValue: p.marketValue ?? "",
      peakValue: p.peakValue ?? "",
      mvpCount: Number(p.mvpCount) || 0,
      destaqueCount: Number(p.destaqueCount) || 0,
      trophy: p.trophy ?? "",
      statsRound: p.statsRound || "",
      nationality: p.nationality || "",
      age: p.age ?? "",
      status: p.status || "",
      contractUntil: p.contractUntil || ""
    };
  }).sort((a, b) => String(a.team).localeCompare(String(b.team)) || String(a.name).localeCompare(String(b.name)));

  if (!rows.length) {
    alert("Nenhum agente no Market para exportar.");
    return;
  }

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Market Snapshot");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  XLSX.writeFile(wb, `jet-market-snapshot-${stamp}.xlsx`);
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
window.populateSyncSelectors = populateSyncSelectors;
window.refreshSyncRoundOptions = refreshSyncRoundOptions;
window.previewJetLeagueSync = previewJetLeagueSync;
window.exportMarketSnapshot = exportMarketSnapshot;

window.forceReseedFromCode = forceReseedFromCode;
window.setTransferWindow = setTransferWindow;
window.saveJetLeagueUrl = saveJetLeagueUrl;
window.syncTransferToJetLeague = syncTransferToJetLeague;
window.renderCompare = typeof renderCompare !== "undefined" ? renderCompare : function(){};
window.closeAIReviewModal = closeAIReviewModal;
window.confirmAIReview = confirmAIReview;
window.initAuth = initAuth;
