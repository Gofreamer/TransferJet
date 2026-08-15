/* Admin — Fotos dos agentes (URL global: Market, Cards, perfis)
   Base robusta do Grok + QoL do Claude: filtro por time e importação em massa. */
function renderAdminPhotos() {
  const el = document.getElementById("adminTabContent");
  if (!el) return;

  const players = (typeof getAllPlayersFlat === "function" ? getAllPlayersFlat() : [])
    .slice()
    .sort((a, b) => (a.club || "").localeCompare(b.club || "", "pt-BR") || (a.name || "").localeCompare(b.name || "", "pt-BR"));

  const hasValidPhoto = p => !!(p && p.photo && /^https?:\/\//i.test(String(p.photo).trim()));
  const withPhoto = players.filter(hasValidPhoto).length;
  const q = (window._adminPhotoQ || "").toLowerCase();
  const filter = window._adminPhotoFilter || "all"; // all | missing | has
  const clubFilter = window._adminPhotoClub || "";
  const clubs = [...new Set(players.map(p => p.club).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));

  let list = players;
  if (q) {
    list = list.filter(p =>
      (p.name || "").toLowerCase().includes(q) ||
      (p.club || "").toLowerCase().includes(q) ||
      (p.key || "").toLowerCase().includes(q)
    );
  }
  if (clubFilter) list = list.filter(p => (p.club || "") === clubFilter);
  if (filter === "missing") list = list.filter(p => !hasValidPhoto(p));
  if (filter === "has") list = list.filter(hasValidPhoto);

  el.innerHTML = `
    <h3 class="admin-section-title">Fotos dos agentes</h3>
    <p class="admin-sub">
      URL pública da imagem salva em <code>players/{key}.photo</code>.
      Vale para <strong>Market, perfis, Fantasy e Jet Cards</strong>.
      Use link direto (https://…jpg/png/webp). Se vazio, o site usa avatar gerado.
    </p>

    <details class="admin-bulk-photos">
      <summary>Colar várias URLs de uma vez</summary>
      <p class="admin-sub" style="margin:8px 0 0">
        Um agente por linha no formato <code>Nome do Agente; URL da imagem</code>.
        Também aceita tabulação ou <code>|</code> como separador.
      </p>
      <textarea id="bulkPhotoInput" rows="6" placeholder="João Silva; https://exemplo.com/joao.jpg\nMaria Souza; https://exemplo.com/maria.jpg"></textarea>
      <div class="admin-actions" style="margin-top:10px">
        <button class="btn-primary btn-sm" onclick="applyBulkPhotos(this)">Aplicar e salvar tudo</button>
      </div>
      <p id="bulkPhotoStatus" class="admin-photo-status" style="margin-top:8px"></p>
    </details>

    <div class="admin-photo-toolbar">
      <div class="admin-photo-stats">
        <span class="badge cyan">${withPhoto} com foto</span>
        <span class="badge">${players.length - withPhoto} sem foto</span>
        <span class="badge">${players.length} agentes</span>
      </div>
      <div class="admin-photo-filters">
        <input type="search" id="adminPhotoSearch" class="admin-input" placeholder="Buscar nome ou time…"
               value="${String(window._adminPhotoQ || "").replace(/"/g, "&quot;")}"
               oninput="window._adminPhotoQ=this.value;renderAdminPhotos()"/>
        <select id="adminPhotoClub" onchange="window._adminPhotoClub=this.value;renderAdminPhotos()">
          <option value="">Todos os times</option>
          ${clubs.map(c => `<option value="${String(c).replace(/"/g, "&quot;")}" ${clubFilter===c?"selected":""}>${c}</option>`).join("")}
        </select>
        <select id="adminPhotoFilter" onchange="window._adminPhotoFilter=this.value;renderAdminPhotos()">
          <option value="all" ${filter==="all"?"selected":""}>Todos</option>
          <option value="missing" ${filter==="missing"?"selected":""}>Sem foto</option>
          <option value="has" ${filter==="has"?"selected":""}>Com foto</option>
        </select>
      </div>
    </div>

    <div class="admin-photo-grid" id="adminPhotoGrid">
      ${list.map(p => {
        const has = hasValidPhoto(p);
        const url = has ? String(p.photo).trim() : "";
        const preview = typeof getPlayerPhoto === "function" ? getPlayerPhoto(p) : url;
        const safeKey = String(p.key || "").replace(/'/g, "\\'");
        return `
          <div class="admin-photo-card ${has ? "has-photo" : "no-photo"}" data-key="${p.key}">
            <div class="admin-photo-preview">
              <img src="${preview}" alt="" loading="lazy" onerror="this.style.opacity='0.3'"/>
            </div>
            <div class="admin-photo-body">
              <div class="admin-photo-name">${p.name || "—"}</div>
              <div class="admin-photo-meta">${p.club || "—"} · ${p.rank || "—"}</div>
              <input type="url" class="admin-input admin-photo-url" data-key="${p.key}"
                     placeholder="https://… imagem"
                     value="${url.replace(/"/g, "&quot;")}"
                     oninput="previewAdminPhoto('${safeKey}', this.value)"
                     onkeydown="if(event.key==='Enter'){event.preventDefault();adminSavePhoto('${safeKey}', this)}"/>
              <div class="admin-photo-actions">
                <button class="btn-primary btn-sm" onclick="adminSavePhoto('${safeKey}', this.closest('.admin-photo-card').querySelector('.admin-photo-url'))">Salvar</button>
                ${has ? `<button class="btn-gray btn-sm" onclick="adminClearPhoto('${safeKey}')">Limpar</button>` : ""}
              </div>
              <div class="admin-photo-status" data-status-for="${p.key}"></div>
            </div>
          </div>
        `;
      }).join("") || "<p class='admin-sub'>Nenhum agente encontrado.</p>"}
    </div>
  `;
}

function previewAdminPhoto(playerKey, url) {
  const card = document.querySelector('.admin-photo-card[data-key="' + String(playerKey).replace(/"/g, '') + '"]');
  const img = card?.querySelector(".admin-photo-preview img");
  if (!img) return;
  const player = (typeof getAllPlayersFlat === "function" ? getAllPlayersFlat() : []).find(p => p.key === playerKey) || { key: playerKey, name: "agent" };
  const trimmed = (url || "").trim();
  img.src = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : (typeof getPlayerPhoto === "function" ? getPlayerPhoto({ ...player, photo: "" }) : "");
  img.style.opacity = "1";
}

async function adminSavePhoto(playerKey, inputEl) {
  if (!playerKey || !window.marketDb) return;
  const input = typeof inputEl === "string" ? null : inputEl;
  const url = (input?.value || "").trim();
  const status = document.querySelector('[data-status-for="' + playerKey.replace(/"/g, '') + '"]');

  if (url && !/^https?:\/\//i.test(url)) {
    if (status) {
      status.textContent = "URL precisa começar com http:// ou https://";
      status.className = "admin-photo-status err";
    }
    return;
  }

  try {
    const ref = window.marketDb.ref("players/" + playerKey);
    const updatedAt = new Date().toISOString();
    if (url) {
      await ref.update({ photo: url, photoUpdatedAt: updatedAt });
    } else {
      await ref.update({ photo: null, photoUpdatedAt: updatedAt });
    }

    if (window.AppState?.market?.players) {
      if (!window.AppState.market.players[playerKey]) window.AppState.market.players[playerKey] = {};
      window.AppState.market.players[playerKey].photo = url || "";
      window.AppState.market.players[playerKey].photoUpdatedAt = updatedAt;
    }

    if (status) {
      status.textContent = url ? "✓ Foto salva — vale em todo o site" : "✓ Foto removida";
      status.className = "admin-photo-status ok";
    }
    if (typeof renderCurrentView === "function") {
      try { renderCurrentView(); } catch (_) {}
    }
    setTimeout(() => renderAdminPhotos(), 400);
  } catch (e) {
    if (status) {
      status.textContent = "Erro: " + (e.message || e);
      status.className = "admin-photo-status err";
    }
  }
}

async function adminClearPhoto(playerKey) {
  if (!confirm("Remover foto deste agente?")) return;
  await adminSavePhoto(playerKey, { value: "" });
}

async function applyBulkPhotos(buttonEl) {
  const raw = document.getElementById("bulkPhotoInput")?.value || "";
  const status = document.getElementById("bulkPhotoStatus");
  if (!raw.trim()) {
    if (status) {
      status.textContent = "Cole ao menos uma linha no formato Nome; URL.";
      status.className = "admin-photo-status err";
    }
    return;
  }
  if (!window.marketDb) return;

  const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const players = typeof getAllPlayersFlat === "function" ? getAllPlayersFlat() : [];
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const updates = {};
  const localChanges = [];
  const rejected = [];
  const ambiguous = [];
  const updatedAt = new Date().toISOString();

  lines.forEach(line => {
    const sepMatch = line.match(/[;\t|]/);
    if (!sepMatch) { rejected.push(line); return; }
    const idx = sepMatch.index;
    const name = line.slice(0, idx).trim();
    const url = line.slice(idx + 1).trim();
    if (!name || !/^https?:\/\//i.test(url)) { rejected.push(line); return; }

    let player = players.find(p => norm(p.name) === norm(name));
    if (!player) {
      const candidates = players.filter(p => norm(p.name).includes(norm(name)) || norm(name).includes(norm(p.name)));
      if (candidates.length === 1) player = candidates[0];
      else if (candidates.length > 1) { ambiguous.push(name); return; }
    }
    if (!player) { rejected.push(line); return; }

    updates[`players/${player.key}/photo`] = url;
    updates[`players/${player.key}/photoUpdatedAt`] = updatedAt;
    localChanges.push({ key: player.key, url });
  });

  if (!localChanges.length) {
    if (status) {
      status.textContent = "Nenhuma foto válida encontrada. Confira nomes e URLs.";
      status.className = "admin-photo-status err";
    }
    return;
  }

  if (buttonEl) buttonEl.disabled = true;
  if (status) {
    status.textContent = "Salvando…";
    status.className = "admin-photo-status";
  }

  try {
    await window.marketDb.ref().update(updates);

    if (window.AppState?.market?.players) {
      localChanges.forEach(({ key, url }) => {
        if (!window.AppState.market.players[key]) window.AppState.market.players[key] = {};
        window.AppState.market.players[key].photo = url;
        window.AppState.market.players[key].photoUpdatedAt = updatedAt;
      });
    }

    if (typeof renderCurrentView === "function") {
      try { renderCurrentView(); } catch (_) {}
    }

    if (status) {
      const issues = [];
      if (rejected.length) issues.push(`${rejected.length} linha(s) inválida(s)/não encontrada(s)`);
      if (ambiguous.length) issues.push(`${ambiguous.length} nome(s) ambíguo(s)`);
      status.textContent = `✓ ${localChanges.length} foto(s) salva(s).${issues.length ? " " + issues.join("; ") + "." : ""}`;
      status.className = "admin-photo-status ok";
    }

    window._adminPhotoFilter = "all";
    setTimeout(() => renderAdminPhotos(), 700);
  } catch (e) {
    if (status) {
      status.textContent = "Erro: " + (e.message || e);
      status.className = "admin-photo-status err";
    }
  } finally {
    if (buttonEl) buttonEl.disabled = false;
  }
}

window.renderAdminPhotos = renderAdminPhotos;
window.previewAdminPhoto = previewAdminPhoto;
window.adminSavePhoto = adminSavePhoto;
window.adminClearPhoto = adminClearPhoto;
window.applyBulkPhotos = applyBulkPhotos;
