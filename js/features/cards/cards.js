/* Jet Cards 2.0 — shell, carddex, packs sequenciais, detalhe */
window.CARDS = window.CARDS || {};

function enterCardsMode() {
  ensureCardsState();
  const c = window.AppState.cards;
  if (!c.session.ownerId && localStorage.getItem("fantasyParticipantId")) {
    setCardsSession(localStorage.getItem("fantasyParticipantId"), localStorage.getItem("fantasyDisplayName"));
  }
  c.active = true;
  document.body.classList.add("cards-mode");
  document.getElementById("cardsShell")?.classList.remove("hidden");
  document.querySelector("header")?.classList.add("jc-hide");
  document.querySelector(".hero")?.classList.add("jc-hide");
  document.querySelector("footer")?.classList.add("jc-hide");
  document.querySelector("main")?.classList.add("jc-hide-official");
  document.getElementById("fantasyShell")?.classList.add("hidden");
  if (window.AppState.fantasy) window.AppState.fantasy.active = false;
  document.body.classList.remove("fantasy-mode", "market-open", "market-locked", "round-processed");
  ensureCardsSeeded().catch(() => {});
  renderCardsShell();
}

function exitCardsMode() {
  ensureCardsState().active = false;
  document.body.classList.remove("cards-mode");
  document.getElementById("cardsShell")?.classList.add("hidden");
  document.getElementById("jcCardModal")?.remove();
  document.querySelector("header")?.classList.remove("jc-hide");
  document.querySelector(".hero")?.classList.remove("jc-hide");
  document.querySelector("footer")?.classList.remove("jc-hide");
  document.querySelector("main")?.classList.remove("jc-hide-official");
  if (typeof showView === "function") showView("home");
}

function showCardsView(view) {
  ensureCardsState().ui.view = view;
  renderCardsShell();
}

function renderCardsShell() {
  const shell = document.getElementById("cardsShell");
  if (!shell || !window.AppState.cards?.active) return;
  const view = window.AppState.cards.ui.view || "hub";
  const name = window.AppState.cards.session.displayName || "Colecionador";
  const primary = new Set(["hub", "packs", "inventory", "carddex"]);
  const moreActive = !primary.has(view);

  shell.innerHTML = `
    <div class="jc-app">
      <header class="jc-header">
        <div class="jc-brand">
          <div class="jc-logo">JET CARDS</div>
          <div class="jc-powered">Coleção oficial · Jet League</div>
        </div>
        <div class="jc-header-user">${name}</div>
        <button class="jc-btn ghost jc-exit-btn" type="button" onclick="exitCardsMode()">← TransferJet</button>
      </header>
      <nav class="jc-nav jc-nav-top" aria-label="Navegação Jet Cards">
        ${[
          ["hub", "Início"],
          ["packs", "Pacotes"],
          ["inventory", "Inventário"],
          ["carddex", "Coleção"],
          ["showcase", "Vitrine"],
          ["npcs", "Cenas"],
          ["redeem", "Código"]
        ].map(([v, l]) => `<button type="button" class="jc-nav-btn ${view===v?"active":""}" onclick="showCardsView('${v}')">${l}</button>`).join("")}
      </nav>
      <div class="jc-content" id="jcContent"></div>
      <nav class="jc-bottom-nav" aria-label="Menu principal">
        <button type="button" class="jc-bottom-btn ${view==="hub"?"active":""}" onclick="showCardsView('hub')"><span class="jc-bottom-ico">🏠</span><span>Início</span></button>
        <button type="button" class="jc-bottom-btn ${view==="packs"?"active":""}" onclick="showCardsView('packs')"><span class="jc-bottom-ico">📦</span><span>Packs</span></button>
        <button type="button" class="jc-bottom-btn ${view==="inventory"?"active":""}" onclick="showCardsView('inventory')"><span class="jc-bottom-ico">🃏</span><span>Inventário</span></button>
        <button type="button" class="jc-bottom-btn ${view==="carddex"?"active":""}" onclick="showCardsView('carddex')"><span class="jc-bottom-ico">📚</span><span>Coleção</span></button>
        <button type="button" class="jc-bottom-btn ${moreActive?"active":""}" onclick="cardsToggleMoreMenu(event)"><span class="jc-bottom-ico">⋯</span><span>Mais</span></button>
      </nav>
      <div id="jcMoreMenu" class="jc-more-menu hidden" role="menu">
        <button type="button" role="menuitem" class="${view==="showcase"?"active":""}" onclick="showCardsView('showcase')">Vitrine</button>
        <button type="button" role="menuitem" class="${view==="npcs"?"active":""}" onclick="showCardsView('npcs')">Cenas</button>
        <button type="button" role="menuitem" class="${view==="redeem"?"active":""}" onclick="showCardsView('redeem')">Código</button>
      </div>
    </div>
  `;
  const el = document.getElementById("jcContent");
  if (!getCardsOwnerId()) return renderCardsLogin(el);
  if (view === "hub") renderCardsHub(el);
  else if (view === "packs") renderCardsPacks(el);
  else if (view === "inventory") renderCardsInventory(el);
  else if (view === "carddex") renderCardsCarddex(el);
  else if (view === "showcase") renderCardsShowcase(el);
  else if (view === "npcs") renderCardsNpcs(el);
  else if (view === "redeem") renderCardsRedeem(el);
  // Tilt só em detalhe/reveal — grade não recebe listeners
}

function cardsToggleMoreMenu(ev) {
  ev?.stopPropagation?.();
  const menu = document.getElementById("jcMoreMenu");
  if (!menu) return;
  menu.classList.toggle("hidden");
  if (!menu.classList.contains("hidden")) {
    const close = (e) => {
      if (menu.contains(e.target)) return;
      menu.classList.add("hidden");
      document.removeEventListener("click", close);
    };
    setTimeout(() => document.addEventListener("click", close), 0);
  }
}

function renderCardsLogin(container) {
  container.innerHTML = `
    <div class="jc-login">
      <h2>Entrar em Jet Cards</h2>
      <p>Use o <strong>código/nick</strong> do Fantasy.</p>
      <input type="text" id="jcLoginInput" class="jc-input" placeholder="Código ou nick"/>
      <button class="jc-btn primary" onclick="cardsDoLogin()">Entrar</button>
    </div>
  `;
}

function cardsDoLogin() {
  const raw = document.getElementById("jcLoginInput")?.value || "";
  let found = typeof findParticipantByInvite === "function" ? findParticipantByInvite(raw) : null;
  if (!found) {
    const parts = window.AppState.fantasy?.participants || {};
    const q = raw.trim().toLowerCase();
    for (const [id, p] of Object.entries(parts)) {
      if (p?.type === "npc") continue;
      if (id.toLowerCase() === q || (p.displayName || "").toLowerCase() === q || (p.inviteCode || "").toLowerCase() === q) {
        found = { id, ...p };
        break;
      }
    }
  }
  if (!found && raw.trim()) {
    setCardsSession("human_" + raw.trim().toLowerCase().replace(/\s+/g, "_"), raw.trim());
    if (typeof cardsRebindInventoryListener === "function") cardsRebindInventoryListener();
    renderCardsShell();
    return;
  }
  if (!found) return alert("Não encontrado.");
  setCardsSession(found.id, found.displayName);
  if (typeof cardsRebindInventoryListener === "function") cardsRebindInventoryListener();
  renderCardsShell();
}

function renderCardsHub(container) {
  const ownerId = getCardsOwnerId();
  const cards = inventoryList(ownerId);
  const counts = countByRarity(cards);
  const sealed = Object.values(window.AppState.cards.packs || {}).filter(p => p.ownerId === ownerId && p.status === "sealed");
  const dex = carddexEntries(ownerId);
  const discovered = dex.filter(e => e.discovered).length;
  const showcase = (window.AppState.cards.showcases || {})[ownerId];
  const byId = Object.fromEntries(cards.map(c => [c.cardId, c]));

  container.innerHTML = `
    <div class="jc-hub">
      <div class="jc-kicker">${cardsCycleLabel()} · Jet League Collection</div>
      <h1 class="jc-title">Sua coleção</h1>
      <div class="jc-kpi-grid">
        <div class="jc-kpi"><div class="jc-kpi-label">Álbum</div><div class="jc-kpi-value">${discovered}<small>/${dex.length || "—"}</small></div></div>
        <div class="jc-kpi"><div class="jc-kpi-label">Cartas</div><div class="jc-kpi-value">${cards.length}</div></div>
        <div class="jc-kpi"><div class="jc-kpi-label">Legend</div><div class="jc-kpi-value gold">${counts.legend}</div></div>
        <div class="jc-kpi"><div class="jc-kpi-label">Pacotes</div><div class="jc-kpi-value">${sealed.length}</div></div>
      </div>
      <div class="jc-actions-row jc-hub-actions">
        <button class="jc-btn primary" onclick="showCardsView('packs')">Abrir pacotes</button>
        <button class="jc-btn" onclick="showCardsView('inventory')">Inventário</button>
        <button class="jc-btn" onclick="showCardsView('carddex')">Álbum</button>
        <button class="jc-btn" onclick="showCardsView('showcase')">Editar vitrine</button>
        <button class="jc-btn" onclick="showCardsView('redeem')">Código</button>
      </div>
      <div class="jc-section">
        <div class="jc-section-head"><h2>Sua vitrine</h2><button class="jc-btn sm" onclick="showCardsView('showcase')">Editar</button></div>
        <div class="jc-showcase-row">
          ${((showcase?.slots) || []).filter(Boolean).slice(0, 6).map(id => {
            const c = byId[id];
            return c ? collectibleCardHTML(c, { small: true, onclick: `cardsOpenDetail('${c.cardId}')` }) : "";
          }).join("") || "<p class='jc-hint'>Monte a vitrine com suas melhores cartas.</p>"}
        </div>
      </div>
      <div class="jc-section jc-hall-section">
        <div class="jc-section-head"><h2>Hall de colecionadores</h2></div>
        <p class="jc-hint">Jogadores e personagens / NPCs.</p>
        ${renderHallCollectorsHTML(ownerId)}
      </div>
    </div>
  `;
}

/* ========== PACKS + abertura sequencial ========== */
function renderCardsPacks(container) {
  const ownerId = getCardsOwnerId();
  // Só lacrados — abertos somem da lista (cartas já estão no inventário)
  const packs = Object.entries(window.AppState.cards.packs || {})
    .filter(([, p]) => p.ownerId === ownerId && p.status === "sealed")
    .sort((a, b) => (b[1].grantedAt || "").localeCompare(a[1].grantedAt || ""));

  const batchBtn = packs.length >= 10
    ? `<button class="jc-btn primary" onclick="cardsOpenPacksBatch(10)">Abrir 10 packs</button>`
    : "";
  const allBtn = packs.length >= 2 && packs.length < 10
    ? `<button class="jc-btn" onclick="cardsOpenPacksBatch(${packs.length})">Abrir todos (${packs.length})</button>`
    : packs.length > 10
      ? `<button class="jc-btn" onclick="cardsOpenPacksBatch(${packs.length})">Abrir todos (${packs.length})</button>`
      : "";

  container.innerHTML = `
    <div class="jc-section">
      <h2>Pacotes ${packs.length ? `<span class="jc-hint" style="font-weight:400">· ${packs.length} lacrado${packs.length > 1 ? "s" : ""}</span>` : ""}</h2>
      <p class="jc-hint">Revelação carta a carta. Depois de abrir, o pack some daqui — as cartas ficam no inventário.</p>
      ${packs.length >= 2 ? `<div class="jc-actions-row" style="margin-bottom:12px">${batchBtn}${allBtn}</div>` : ""}
      <div class="jc-pack-list">
        ${packs.map(([id, p]) => `
          <div class="jc-pack-item status-sealed">
            <div class="jc-pack-visual">📦</div>
            <div class="jc-pack-info">
              <div class="jc-pack-title">${p.label || "Pacote Jet Cards"}</div>
              <div class="jc-pack-meta">Lacrado · ${p.source || ""}</div>
            </div>
            <button class="jc-btn primary sm" onclick="cardsOpenPack('${id}')">Abrir</button>
          </div>
        `).join("") || "<p class='jc-hint'>Nenhum pacote. Resgate um código ou peça ao Admin.</p>"}
      </div>
      <div id="jcPackStage" class="jc-pack-stage hidden"></div>
    </div>
  `;
}

async function cardsOpenPack(packId) {
  const pack = (window.AppState.cards.packs || {})[packId];
  if (!pack || pack.status !== "sealed") return alert("Pacote indisponível");
  const ownerId = getCardsOwnerId();
  if (pack.ownerId !== ownerId) return alert("Pacote de outro colecionador");

  const before = discoveredDefIds(ownerId);
  const results = openPackResults(cardsSettings().packSize, cardsSettings().rates);

  results.forEach(r => {
    const defId = r.defId || catalogDefId(r.playerKey, r.edition || "BASE");
    r.isNewDiscovery = !before.has(defId);
  });

  const updates = {};
  results.forEach(r => {
    updates["cards/inventory/" + ownerId + "/" + r.cardId] = buildCardRecord(r, packId);
  });
  // Remove o pack do Firebase (cartas já estão no inventário — não mexe no que o jogador tem)
  updates["cards/packs/" + packId] = null;

  try {
    await window.marketDb.ref().update(updates);
  } catch (e) {
    return alert("Erro ao salvar: " + (e.message || e));
  }

  cardsRunRevealSequence(results, false);
}

/** Abre N packs de uma vez (ex.: 10). Junta todas as cartas e mostra o resultado. */
async function cardsOpenPacksBatch(n) {
  const ownerId = getCardsOwnerId();
  const sealed = Object.entries(window.AppState.cards.packs || {})
    .filter(([, p]) => p.ownerId === ownerId && p.status === "sealed")
    .sort((a, b) => (a[1].grantedAt || "").localeCompare(b[1].grantedAt || ""));

  const count = Math.min(Math.max(1, n || 10), sealed.length);
  if (count < 1) return alert("Nenhum pack lacrado");
  if (!confirm(`Abrir ${count} pack${count > 1 ? "s" : ""} de uma vez?`)) return;

  const before = discoveredDefIds(ownerId);
  const seen = new Set(before);
  const allResults = [];
  const updates = {};
  const now = new Date().toISOString();

  for (let i = 0; i < count; i++) {
    const [packId] = sealed[i];
    const results = openPackResults(cardsSettings().packSize, cardsSettings().rates);
    results.forEach(r => {
      const defId = r.defId || catalogDefId(r.playerKey, r.edition || "BASE");
      r.isNewDiscovery = !seen.has(defId);
      if (r.isNewDiscovery) seen.add(defId);
      allResults.push(r);
      updates["cards/inventory/" + ownerId + "/" + r.cardId] = buildCardRecord(r, packId);
    });
    updates["cards/packs/" + packId] = null;
  }

  try {
    await window.marketDb.ref().update(updates);
  } catch (e) {
    return alert("Erro ao salvar: " + (e.message || e));
  }

  cardsShowBatchResults(allResults, count);
}

function cardsBatchTally(results) {
  const counts = { common: 0, rare: 0, epic: 0, legend: 0, holo: 0, novo: 0 };
  results.forEach(r => {
    counts[r.rarity || "common"] = (counts[r.rarity || "common"] || 0) + 1;
    if (r.foil === "holo") counts.holo++;
    if (r.isNewDiscovery) counts.novo++;
  });
  return counts;
}

function cardsBatchBestRarity(results) {
  if (results.some(r => r.rarity === "legend")) return "legend";
  if (results.some(r => r.rarity === "epic")) return "epic";
  if (results.some(r => r.rarity === "rare")) return "rare";
  return "common";
}

function cardsBatchSorted(results) {
  const order = { legend: 0, epic: 1, rare: 2, common: 3 };
  return results.slice().sort((a, b) => {
    const ra = order[a.rarity] ?? 9;
    const rb = order[b.rarity] ?? 9;
    if (ra !== rb) return ra - rb;
    return (b.foil === "holo" ? 1 : 0) - (a.foil === "holo" ? 1 : 0);
  });
}

function cardsShowBatchResults(results, packCount) {
  const stage = document.getElementById("jcPackStage");
  if (!stage) return;
  stage.classList.remove("hidden");

  // limpa timers anteriores
  if (window._jcBatchTimers) {
    window._jcBatchTimers.forEach(clearTimeout);
  }
  window._jcBatchTimers = [];
  window._jcBatch = { results, packCount, skip: false };

  const packIcons = Array.from({ length: Math.min(packCount, 12) }, (_, i) =>
    `<span class="jc-batch-pack-icon" style="--i:${i}">📦</span>`
  ).join("");

  stage.innerHTML = `
    <div class="jc-batch-stage" id="jcBatchStage">
      <button type="button" class="jc-btn ghost sm jc-batch-skip" onclick="cardsSkipBatchAnim()">Pular</button>
      <div class="jc-batch-phase jc-batch-phase-charge" id="jcBatchPhase">
        <div class="jc-batch-packs">${packIcons}</div>
        <div class="jc-batch-charge-ring"></div>
        <p class="jc-batch-title">Abrindo ${packCount} pack${packCount > 1 ? "s" : ""}…</p>
        <div class="jc-batch-bar"><div class="jc-batch-bar-fill" id="jcBatchBar"></div></div>
      </div>
    </div>
  `;

  const t = (fn, ms) => {
    const id = setTimeout(() => {
      if (window._jcBatch?.skip) return;
      fn();
    }, ms);
    window._jcBatchTimers.push(id);
  };

  // progresso da barra
  t(() => {
    const bar = document.getElementById("jcBatchBar");
    if (bar) bar.style.width = "100%";
  }, 50);

  // fase shake
  t(() => cardsBatchPhaseShake(packCount), 1100);
  // burst
  t(() => cardsBatchPhaseBurst(), 2200);
  // tease
  t(() => cardsBatchPhaseTease(results), 3000);
  // reveal grid
  t(() => cardsBatchPhaseReveal(results, packCount), results.some(r => r.rarity === "legend") ? 4800 : 4200);
}

function cardsSkipBatchAnim() {
  if (!window._jcBatch) return;
  window._jcBatch.skip = true;
  if (window._jcBatchTimers) {
    window._jcBatchTimers.forEach(clearTimeout);
    window._jcBatchTimers = [];
  }
  cardsBatchPhaseReveal(window._jcBatch.results, window._jcBatch.packCount);
}

function cardsBatchPhaseShake(packCount) {
  const phase = document.getElementById("jcBatchPhase");
  if (!phase) return;
  phase.className = "jc-batch-phase jc-batch-phase-shake";
  phase.innerHTML = `
    <div class="jc-batch-packs shaking">${Array.from({ length: Math.min(packCount, 12) }, (_, i) =>
      `<span class="jc-batch-pack-icon" style="--i:${i}">📦</span>`
    ).join("")}</div>
    <p class="jc-batch-title">Concentrando energia…</p>
  `;
}

function cardsBatchPhaseBurst() {
  const phase = document.getElementById("jcBatchPhase");
  if (!phase) return;
  phase.className = "jc-batch-phase jc-batch-phase-burst";
  phase.innerHTML = `
    <div class="jc-batch-burst-flash"></div>
    <div class="jc-batch-particles">
      ${Array.from({ length: 18 }, (_, i) => `<span class="jc-batch-particle" style="--i:${i}"></span>`).join("")}
    </div>
    <p class="jc-batch-title jc-batch-title-burst">BOOM</p>
  `;
}

function cardsBatchPhaseTease(results) {
  const phase = document.getElementById("jcBatchPhase");
  if (!phase) return;
  const best = cardsBatchBestRarity(results);
  const labels = {
    legend: "LEGEND PULL",
    epic: "EPIC PULL",
    rare: "RARE HIT",
    common: "PACK OPEN"
  };
  phase.className = `jc-batch-phase jc-batch-phase-tease rarity-${best}`;
  phase.innerHTML = `
    <div class="jc-batch-tease-glow"></div>
    <div class="jc-batch-tease-badge">${labels[best] || "PACK OPEN"}</div>
    <p class="jc-batch-tease-sub">${best === "legend" ? "Algo lendário veio no lote" : best === "epic" ? "Energia épica detectada" : "Revelando cartas…"}</p>
  `;
}

function cardsBatchPhaseReveal(results, packCount) {
  const stage = document.getElementById("jcPackStage") || document.getElementById("jcBatchStage")?.parentElement;
  if (!stage) return;
  const counts = cardsBatchTally(results);
  const sorted = cardsBatchSorted(results);

  stage.classList.remove("hidden");
  stage.innerHTML = `
    <div class="jc-batch-stage jc-batch-done rarity-${cardsBatchBestRarity(results)}">
      <h3 class="jc-batch-done-title">Resultado · ${packCount} pack${packCount > 1 ? "s" : ""} · ${results.length} cartas</h3>
      <div class="jc-kpi-grid jc-batch-kpis">
        <div class="jc-kpi"><div class="jc-kpi-label">Legend</div><div class="jc-kpi-value gold">${counts.legend}</div></div>
        <div class="jc-kpi"><div class="jc-kpi-label">Epic</div><div class="jc-kpi-value">${counts.epic}</div></div>
        <div class="jc-kpi"><div class="jc-kpi-label">Rare</div><div class="jc-kpi-value">${counts.rare}</div></div>
        <div class="jc-kpi"><div class="jc-kpi-label">Common</div><div class="jc-kpi-value">${counts.common}</div></div>
        <div class="jc-kpi"><div class="jc-kpi-label">Holo</div><div class="jc-kpi-value">${counts.holo}</div></div>
        <div class="jc-kpi"><div class="jc-kpi-label">Novas</div><div class="jc-kpi-value">${counts.novo}</div></div>
      </div>
      <div class="jc-batch-grid" id="jcBatchGrid">
        ${sorted.map((r, i) => `
          <div class="jc-batch-card-wrap ${r.isNewDiscovery ? "is-new" : ""}" style="--delay:${Math.min(i * 0.05, 1.6)}s">
            ${collectibleCardHTML(r, { small: true })}
          </div>
        `).join("")}
      </div>
      <div class="jc-actions-row" style="margin-top:16px">
        <button class="jc-btn primary" onclick="showCardsView('inventory')">Inventário</button>
        <button class="jc-btn" onclick="showCardsView('carddex')">Álbum</button>
        <button class="jc-btn ghost" onclick="showCardsView('packs')">Voltar aos packs</button>
      </div>
    </div>
  `;
}

function cardsReplayPack(packId) {
  const pack = (window.AppState.cards.packs || {})[packId];
  if (!pack?.results) return;
  cardsRunRevealSequence(pack.results.map(r => ({ ...r, isNewDiscovery: false })), true);
}

function cardsRunRevealSequence(results, skipSave) {
  const stage = document.getElementById("jcPackStage");
  if (!stage) return;
  stage.classList.remove("hidden");
  window._jcReveal = { results, index: -1, skip: false, busy: false };
  stage.innerHTML = `
    <div class="jc-open-anim">
      <div class="jc-pack-box" id="jcPackBox" role="button" tabindex="0" onclick="cardsRevealNext()" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();cardsRevealNext();}">📦</div>
      <p class="jc-hint jc-pack-tap-hint" onclick="cardsRevealNext()">Toque no pacote para abrir</p>
      <button class="jc-btn primary" id="jcRevealBtn" type="button" onclick="cardsRevealNext()">Abrir pacote</button>
      <button class="jc-btn" type="button" onclick="cardsSkipReveal()">Pular tudo · ver cartas</button>
      <div id="jcRevealFocus" class="jc-reveal-focus"></div>
      <div id="jcRevealDone" class="jc-reveal-done hidden"></div>
    </div>
  `;
}

function cardsSkipReveal() {
  if (!window._jcReveal) return;
  window._jcReveal.skip = true;
  window._jcReveal.busy = false;
  window._jcReveal.index = window._jcReveal.results.length - 1;
  cardsRevealNext(true);
}

function cardsRevealNext(forceAll) {
  const st = window._jcReveal;
  if (!st) return;
  // Evita spam / double-tap pulando cartas no celular
  if (st.busy && !forceAll && !st.skip) return;

  const box = document.getElementById("jcPackBox");
  const focus = document.getElementById("jcRevealFocus");
  const btn = document.getElementById("jcRevealBtn");
  const done = document.getElementById("jcRevealDone");
  const hint = document.querySelector(".jc-pack-tap-hint");

  if (st.index < 0) {
    st.index = 0;
    box?.classList.add("opening");
    if (btn) {
      btn.textContent = "Revelar carta";
      btn.disabled = false;
    }
    if (hint) hint.style.display = "none";
  }

  if (forceAll || st.skip) {
    st.busy = false;
    if (focus) {
      focus.innerHTML = `<div class="jc-reveal-row revealed">${st.results.map(r => collectibleCardHTML(r, { tilt: false })).join("")}</div>`;
    }
    if (done) {
      done.classList.remove("hidden");
      done.innerHTML = `<button class="jc-btn primary" type="button" onclick="showCardsView('inventory')">Inventário</button>
        <button class="jc-btn" type="button" onclick="showCardsView('carddex')">Álbum</button>`;
    }
    if (btn) {
      btn.style.display = "none";
      btn.disabled = false;
    }
    box?.classList.add("opened");
    return;
  }

  if (st.index >= st.results.length) {
    st.busy = false;
    if (done) {
      done.classList.remove("hidden");
      done.innerHTML = `<button class="jc-btn primary" type="button" onclick="showCardsView('inventory')">Inventário</button>
        <button class="jc-btn" type="button" onclick="showCardsView('carddex')">Álbum</button>`;
    }
    if (btn) {
      btn.style.display = "none";
      btn.disabled = false;
    }
    return;
  }

  const card = st.results[st.index];
  const rarity = card.rarity || "common";
  const delays = { common: 400, rare: 700, epic: 1100, legend: 1600 };
  const delay = delays[rarity] || 500;

  st.busy = true;
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Revelando…";
  }
  if (box) box.style.pointerEvents = "none";

  if (focus) {
    focus.innerHTML = `
      <div class="jc-tease rarity-${rarity} ${card.foil === "holo" ? "holo" : ""}">
        <div class="jc-tease-glow"></div>
        <div class="jc-tease-label">${(window.CARDS.RARITY[rarity] || {}).label || rarity}${card.foil === "holo" ? " · HOLO" : ""}</div>
        <div class="jc-tease-particles"></div>
      </div>
    `;
  }

  setTimeout(() => {
    if (!window._jcReveal || window._jcReveal.skip) {
      if (window._jcReveal) window._jcReveal.busy = false;
      return;
    }
    if (focus) {
      focus.innerHTML = `
        <div class="jc-reveal-one ${card.isNewDiscovery ? "new-discovery" : ""}">
          ${card.isNewDiscovery ? `<div class="jc-new-badge">NOVA CARTA DESCOBERTA</div>` : ""}
          ${collectibleCardHTML(card, { tilt: true })}
          ${card.isNewDiscovery ? `<p class="jc-new-sub">Adicionada à coleção</p>` : ""}
        </div>
      `;
      if (typeof cardsBindTilt === "function") cardsBindTilt(focus);
    }
    st.index++;
    st.busy = false;
    if (box) box.style.pointerEvents = "";
    if (btn) {
      btn.disabled = false;
      btn.textContent = st.index >= st.results.length ? "Ver todas" : "Próxima carta";
      if (st.index >= st.results.length) {
        btn.onclick = () => cardsRevealNext(true);
      }
    }
  }, delay);
}

/* ========== INVENTÁRIO ========== */
function renderCardsInventory(container) {
  const grouped = inventoryGrouped(getCardsOwnerId());
  const rarity = window._jcInvRarity || "";
  const foil = window._jcInvFoil || "";
  const edition = window._jcInvEdition || "";
  let list = grouped;
  if (rarity) list = list.filter(c => c.rarity === rarity);
  if (foil === "holo") list = list.filter(c => c.foil === "holo");
  if (foil === "normal") list = list.filter(c => c.foil !== "holo");
  if (edition) list = list.filter(c => (c.edition || "BASE").toUpperCase() === edition);

  const editionKeys = Object.keys(window.CARDS.EDITIONS || { BASE: 1 });

  container.innerHTML = `
    <div class="jc-section">
      <div class="jc-section-head" style="flex-wrap:wrap;gap:8px">
        <h2>Inventário</h2>
        <div class="jc-inv-filters" style="display:flex;flex-wrap:wrap;gap:6px">
          <select onchange="window._jcInvRarity=this.value;renderCardsShell()" title="Raridade">
            <option value="">Raridade</option>
            ${["legend","epic","rare","common"].map(r =>
              `<option value="${r}" ${rarity===r?"selected":""}>${(window.CARDS.RARITY[r]||{}).label||r}</option>`
            ).join("")}
          </select>
          <select onchange="window._jcInvFoil=this.value;renderCardsShell()" title="Foil">
            <option value="">Foil</option>
            <option value="holo" ${foil==="holo"?"selected":""}>Holo</option>
            <option value="normal" ${foil==="normal"?"selected":""}>Normal</option>
          </select>
          <select onchange="window._jcInvEdition=this.value;renderCardsShell()" title="Edição">
            <option value="">Edição</option>
            ${editionKeys.map(ed =>
              `<option value="${ed}" ${edition===ed?"selected":""}>${(window.CARDS.EDITIONS[ed]||{}).label||ed}</option>`
            ).join("")}
          </select>
        </div>
      </div>
      <p class="jc-hint">${list.length} tipo${list.length!==1?"s":""} · duplicatas como ×N. Toque para detalhes.</p>
      <div class="jc-grid tc-grid">
        ${list.map(c => collectibleCardHTML(c, {
          showCount: true,
          count: c.count,
          onclick: `cardsOpenDetail('${c.copies[0]}')`
        })).join("") || "<p class='jc-hint'>Sem cartas com esses filtros.</p>"}
      </div>
    </div>
  `;
}

/* ========== CARDDEX ========== */
function renderCardsCarddex(container) {
  const ownerId = getCardsOwnerId();
  const entries = carddexEntries(ownerId);
  const found = entries.filter(e => e.discovered).length;
  const filter = window._jcDexFilter || "all";
  let list = entries;
  if (filter === "missing") list = entries.filter(e => !e.discovered);
  if (filter === "owned") list = entries.filter(e => e.discovered);
  if (filter === "special") list = entries.filter(e => e.kind === "special");

  const ownedByDef = {};
  inventoryList(ownerId).forEach(c => {
    const d = c.defId || catalogDefId(c.playerKey, c.edition || "BASE");
    ownedByDef[d] = (ownedByDef[d] || 0) + 1;
  });

  container.innerHTML = `
    <div class="jc-section">
      <div class="jc-section-head">
        <div>
          <h2>JET CARDS COLLECTION</h2>
          <p class="jc-album-progress">${found} / ${entries.length} descobertas</p>
        </div>
        <select onchange="window._jcDexFilter=this.value;renderCardsShell()">
          <option value="all" ${filter==="all"?"selected":""}>Todas</option>
          <option value="owned" ${filter==="owned"?"selected":""}>Descobertas</option>
          <option value="missing" ${filter==="missing"?"selected":""}>Faltando</option>
          <option value="special" ${filter==="special"?"selected":""}>Edições especiais</option>
        </select>
      </div>
      <div class="jc-grid tc-grid">
        ${list.map(e => {
          if (!e.discovered) {
            return collectibleCardHTML({ ...e, rarity: "legend" }, { locked: true });
          }
          // mostra uma versão owned (melhor raridade se tiver)
          const copies = inventoryList(ownerId).filter(c =>
            (c.defId || catalogDefId(c.playerKey, c.edition || "BASE")) === e.defId
          );
          const best = copies.sort((a, b) =>
            (window.CARDS.RARITY[b.rarity]?.order || 0) - (window.CARDS.RARITY[a.rarity]?.order || 0)
          )[0] || e;
          return collectibleCardHTML(best, {
            showCount: true,
            count: ownedByDef[e.defId] || 1,
            onclick: `cardsOpenDetail('${best.cardId || ""}')`
          });
        }).join("") || "<p class='jc-hint'>Catálogo vazio — Admin: Seed / Sync catálogo.</p>"}
      </div>
    </div>
  `;
}

/* ========== DETALHE (viewer mobile-friendly + tilt) ========== */
function cardsOpenDetail(cardId) {
  if (!cardId) return;
  const ownerId = getCardsOwnerId();
  const list = inventoryList(ownerId);
  const card = list.find(c => c.cardId === cardId);
  if (!card) return;
  const defId = card.defId || catalogDefId(card.playerKey, card.edition || "BASE");
  const count = list.filter(c => (c.defId || catalogDefId(c.playerKey, c.edition || "BASE")) === defId
    && c.rarity === card.rarity && (c.foil || "normal") === (card.foil || "normal")).length;
  const resolved = resolveCardDef(card);
  const edition = (card.edition || "BASE").toUpperCase();
  const editionLabel = (window.CARDS.EDITIONS[edition] || {}).label || edition;

  document.getElementById("jcCardModal")?.remove();
  const modal = document.createElement("div");
  modal.id = "jcCardModal";
  modal.className = "jc-modal-overlay";
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  modal.innerHTML = `
    <div class="jc-modal jc-modal-viewer" role="dialog" aria-modal="true">
      <button type="button" class="jc-modal-close" aria-label="Fechar" onclick="document.getElementById('jcCardModal').remove()">×</button>
      <div class="jc-modal-card">
        ${collectibleCardHTML(card, { tilt: true })}
      </div>
      <div class="jc-modal-info">
        <h2>${card.customName || resolved.playerName}</h2>
        <p class="jc-modal-ed">${editionLabel}${card.foil === "holo" ? " · HOLO" : ""}</p>
        <p><strong>${(window.CARDS.RARITY[card.rarity] || {}).label || card.rarity}</strong></p>
        <p>${resolved.team} · ${resolved.rank}</p>
        <p>${resolved.cycle} · ${resolved.cardNumber}</p>
        <p class="jc-hint">Possui ×${count} desta variante</p>
        ${resolved.description ? `<p class="jc-desc">${resolved.description}</p>` : ""}
        ${(card.achievements || resolved.achievements || []).length
          ? `<div class="jc-achievements"><h3>Conquistas</h3><ul>${(card.achievements || resolved.achievements).map(a => `<li>${a}</li>`).join("")}</ul></div>`
          : ""}
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  if (typeof cardsBindTilt === "function") cardsBindTilt(modal);
}

/* ========== VITRINE (edição) — Hall fica no Início ========== */
function renderCardsShowcase(container) {
  const ownerId = getCardsOwnerId();
  const sc = (window.AppState.cards.showcases || {})[ownerId] || { slots: [], title: "Minha vitrine" };
  const slots = Array.from({ length: cardsSettings().showcaseSlots || 6 }, (_, i) => sc.slots?.[i] || null);
  const byId = Object.fromEntries(inventoryList(ownerId).map(c => [c.cardId, c]));
  if (!window._jcShowcaseDraft) window._jcShowcaseDraft = slots.slice();

  const rarity = window._jcVitRarity || "";
  const foil = window._jcVitFoil || "";
  const edition = window._jcVitEdition || "";
  const q = (window._jcVitSearch || "").trim().toLowerCase();
  let list = inventoryGrouped(ownerId);
  if (rarity) list = list.filter(c => c.rarity === rarity);
  if (foil === "holo") list = list.filter(c => c.foil === "holo");
  if (foil === "normal") list = list.filter(c => c.foil !== "holo");
  if (edition) list = list.filter(c => (c.edition || "BASE").toUpperCase() === edition);
  if (q) list = list.filter(c =>
    (c.playerName || "").toLowerCase().includes(q) ||
    (c.team || "").toLowerCase().includes(q) ||
    (c.edition || "").toLowerCase().includes(q)
  );
  const editionKeys = Object.keys(window.CARDS.EDITIONS || { BASE: 1 });

  container.innerHTML = `
    <div class="jc-section jc-vitrine-edit">
      <div class="jc-vitrine-sticky">
        <div class="jc-section-head">
          <div>
            <h2 style="margin:0">Sua vitrine</h2>
            <p class="jc-hint" style="margin:4px 0 0">Toque no slot, depois na carta. Hall dos colecionadores está no <strong>Início</strong>.</p>
          </div>
          <button class="jc-btn primary" onclick="cardsSaveShowcase()">Salvar vitrine</button>
        </div>
      </div>
      <div class="jc-showcase-row">
        ${(window._jcShowcaseDraft || slots).map((id, i) => {
          const c = id && byId[id];
          return `<div class="jc-showcase-slot ${window._jcSlot===i?"picking":""}" onclick="cardsPickSlot(${i})">
            ${c ? collectibleCardHTML(c, { small: true }) : "<div class='jc-slot-empty'>Slot " + (i+1) + "</div>"}
          </div>`;
        }).join("")}
      </div>
      <div class="jc-vitrine-picker">
        <div class="jc-section-head" style="margin-top:14px">
          <h3 style="margin:0;font-size:0.95rem">Escolher cartas</h3>
        </div>
        <div class="jc-inv-filters jc-vit-filters">
          <input type="search" class="jc-input jc-filter-search" id="jcVitSearchInput" placeholder="Buscar nome / time…"
            value="${(window._jcVitSearch || "").replace(/"/g, "&quot;")}"
            oninput="cardsVitSearchDebounced(this.value)"/>
          <select onchange="window._jcVitRarity=this.value;cardsRefreshShowcaseOnly()">
            <option value="">Raridade</option>
            ${["legend","epic","rare","common"].map(r =>
              `<option value="${r}" ${rarity===r?"selected":""}>${(window.CARDS.RARITY[r]||{}).label||r}</option>`
            ).join("")}
          </select>
          <select onchange="window._jcVitFoil=this.value;cardsRefreshShowcaseOnly()">
            <option value="">Foil</option>
            <option value="holo" ${foil==="holo"?"selected":""}>Holo</option>
            <option value="normal" ${foil==="normal"?"selected":""}>Normal</option>
          </select>
          <select onchange="window._jcVitEdition=this.value;cardsRefreshShowcaseOnly()">
            <option value="">Edição</option>
            ${editionKeys.map(ed =>
              `<option value="${ed}" ${edition===ed?"selected":""}>${(window.CARDS.EDITIONS[ed]||{}).label||ed}</option>`
            ).join("")}
          </select>
        </div>
        <p class="jc-hint">${list.length} carta${list.length!==1?"s":""} · ${window._jcSlot!=null ? "slot "+(window._jcSlot+1)+" selecionado" : "escolha um slot acima"}</p>
        <div class="jc-grid tc-grid" id="jcVitPickerGrid">
          ${list.map(c => collectibleCardHTML(c, {
            showCount: true, count: c.count,
            selected: (window._jcShowcaseDraft || []).includes(c.copies[0]),
            onclick: `cardsAssignToSlot('${c.copies[0]}')`
          })).join("") || "<p class='jc-hint'>Nenhuma carta com esses filtros.</p>"}
        </div>
        <div class="jc-vitrine-save-bottom">
          <button class="jc-btn primary" type="button" onclick="cardsSaveShowcase()">Salvar vitrine</button>
        </div>
      </div>
    </div>
  `;
}

/** Atualiza só o conteúdo da vitrine (não destrói shell/nav/input focus). */
function cardsRefreshShowcaseOnly() {
  const el = document.getElementById("jcContent");
  if (!el || (window.AppState.cards?.ui?.view !== "showcase")) return;
  const search = document.getElementById("jcVitSearchInput");
  const start = search?.selectionStart;
  const end = search?.selectionEnd;
  const hadFocus = document.activeElement === search;
  renderCardsShowcase(el);
  const again = document.getElementById("jcVitSearchInput");
  if (again && hadFocus) {
    again.focus();
    if (typeof start === "number") {
      try { again.setSelectionRange(start, end ?? start); } catch (_) {}
    }
  }
}

function cardsVitSearchDebounced(val) {
  window._jcVitSearch = val;
  clearTimeout(window._jcVitSearchT);
  window._jcVitSearchT = setTimeout(() => cardsRefreshShowcaseOnly(), 200);
}

/** Prestígio da vitrine: legend×10 + epic×4 + rare×2 + holo×1 + slots preenchidos */
function cardsShowcasePrestige(sid, s) {
  const inv = (window.AppState.cards.inventory || {})[sid] || {};
  let score = 0;
  let filled = 0;
  (s.slots || []).filter(Boolean).forEach(slot => {
    const c = typeof slot === "object" && slot?.playerKey ? slot : inv[slot];
    if (!c) return;
    filled++;
    const r = c.rarity || "common";
    if (r === "legend") score += 10;
    else if (r === "epic") score += 4;
    else if (r === "rare") score += 2;
    else score += 1;
    if (c.foil === "holo") score += 1;
  });
  return score + filled * 0.1;
}

/** Monta HTML do hall: humanos (por prestígio) + NPCs/personagens */
function renderHallCollectorsHTML(excludeOwnerId) {
  const all = Object.entries(window.AppState.cards.showcases || {});
  let humans = all.filter(([id, s]) => s && s.type !== "npc" && id !== excludeOwnerId);
  const npcs = all.filter(([, s]) => s && s.type === "npc");

  // busca inventários faltantes dos outros (listener escopado só traz o seu)
  humans.forEach(([id]) => {
    if (!(window.AppState.cards.inventory || {})[id] && typeof cardsFetchInventoryOnce === "function") {
      cardsFetchInventoryOnce(id);
    }
  });

  humans = humans.slice().sort((a, b) => cardsShowcasePrestige(b[0], b[1]) - cardsShowcasePrestige(a[0], a[1]));

  const resolveHumanSlots = (sid, s) => {
    const inv = (window.AppState.cards.inventory || {})[sid] || {};
    return (s.slots || []).filter(Boolean).map(slot => {
      if (typeof slot === "object" && slot?.playerKey) return collectibleCardHTML(slot, { small: true });
      const c = inv[slot];
      if (c) return collectibleCardHTML({ cardId: slot, ...c }, { small: true });
      return "";
    }).filter(Boolean).join("") || "<span class='jc-hint'>Vitrine vazia</span>";
  };

  const resolveNpcSlots = (s) => {
    return (s.slots || []).map(slot => {
      if (typeof slot === "object" && slot?.playerKey) return collectibleCardHTML(slot, { small: true });
      return "";
    }).filter(Boolean).join("") || "<span class='jc-hint'>Em montagem</span>";
  };

  let html = "";

  if (humans.length) {
    html += `<h3 class="jc-hall-subtitle">Jogadores · por prestígio</h3>`;
    html += humans.map(([id, s]) => {
      const prest = Math.floor(cardsShowcasePrestige(id, s));
      return `
      <div class="jc-npc-vitrine jc-human-vitrine">
        <div class="jc-npc-head">👤 <strong>${s.name || "Colecionador"}</strong>${s.title ? " · " + s.title : ""} <span class="jc-hint">· prestígio ${prest}</span></div>
        <div class="jc-showcase-row">${resolveHumanSlots(id, s)}</div>
      </div>`;
    }).join("");
  } else {
    html += `<p class="jc-hint">Nenhum outro colecionador com vitrine ainda.</p>`;
  }

  if (npcs.length) {
    html += `<h3 class="jc-hall-subtitle" style="margin-top:18px">Personagens & NPCs</h3>`;
    html += npcs.map(([, s]) => `
      <div class="jc-npc-vitrine">
        <div class="jc-npc-head">${s.avatar || "🎴"} <strong>${s.name || "NPC"}</strong>${s.title ? " · " + s.title : ""}</div>
        <div class="jc-showcase-row">${resolveNpcSlots(s)}</div>
      </div>
    `).join("");
  }

  return html;
}

function cardsPickSlot(i) {
  window._jcSlot = i;
  const n = cardsSettings().showcaseSlots || 6;
  window._jcShowcaseDraft = window._jcShowcaseDraft || [];
  while (window._jcShowcaseDraft.length < n) window._jcShowcaseDraft.push(null);
  renderCardsShell();
}

function cardsAssignToSlot(cardId) {
  if (window._jcSlot == null) window._jcSlot = 0;
  const n = cardsSettings().showcaseSlots || 6;
  window._jcShowcaseDraft = window._jcShowcaseDraft || [];
  while (window._jcShowcaseDraft.length < n) window._jcShowcaseDraft.push(null);
  window._jcShowcaseDraft = window._jcShowcaseDraft.map(id => id === cardId ? null : id);
  window._jcShowcaseDraft[window._jcSlot] = cardId;
  renderCardsShell();
}

async function cardsSaveShowcase() {
  const ownerId = getCardsOwnerId();
  const slots = (window._jcShowcaseDraft || []).slice(0, cardsSettings().showcaseSlots || 6);
  await window.marketDb.ref("cards/showcases/" + ownerId).update({
    type: "human",
    name: window.AppState.cards.session.displayName || "Colecionador",
    title: "Minha vitrine",
    slots,
    updatedAt: new Date().toISOString()
  });
  alert("Vitrine salva!");
}

function renderCardsNpcs(container) {
  const offers = Object.entries(window.AppState.cards.offers || {})
    .filter(([, o]) => o.active !== false)
    .sort((a, b) => (b[1].createdAt || "").localeCompare(a[1].createdAt || ""));
  container.innerHTML = `
    <div class="jc-section">
      <h2>Cenas · NPCs</h2>
      <div class="jc-offers">
        ${offers.map(([id, o]) => `
          <div class="jc-offer">
            <div class="jc-offer-npc">${o.npcAvatar || "🎭"} <strong>${o.npcName || "NPC"}</strong></div>
            <p class="jc-offer-text">${o.sceneText || ""}</p>
            <div class="jc-offer-card-preview">
              ${o.playerKey ? collectibleCardHTML({
                playerKey: o.playerKey, playerName: o.playerName, team: o.team,
                rarity: o.rarity || "rare", foil: o.foil || "normal",
                edition: o.edition || "BASE", specialImageUrl: o.specialImageUrl
              }, { small: true }) : ""}
            </div>
            <div class="jc-offer-meta">${o.claimedBy ? "Adquirida" : "Disponível"}</div>
            ${!o.claimedBy ? `<button class="jc-btn primary sm" onclick="cardsClaimOffer('${id}')">Adquirir</button>` : ""}
          </div>
        `).join("") || "<p class='jc-hint'>Nenhuma cena ativa.</p>"}
      </div>
    </div>
  `;
}

async function cardsClaimOffer(offerId) {
  const o = (window.AppState.cards.offers || {})[offerId];
  if (!o || o.claimedBy) return alert("Indisponível");
  const ownerId = getCardsOwnerId();
  if (o.ownerId && o.ownerId !== ownerId) return alert("Oferta de outro colecionador");
  const cardId = newCardId();
  const record = buildCardRecord({
    playerKey: o.playerKey, playerName: o.playerName, team: o.team,
    rarity: o.rarity || "rare", foil: o.foil || "normal",
    edition: o.edition || "BASE", specialImageUrl: o.specialImageUrl,
    description: o.description, source: "npc_offer"
  });
  await window.marketDb.ref().update({
    ["cards/inventory/" + ownerId + "/" + cardId]: record,
    ["cards/offers/" + offerId + "/claimedBy"]: ownerId,
    ["cards/offers/" + offerId + "/claimedAt"]: new Date().toISOString()
  });
  alert("Carta adquirida!");
  showCardsView("inventory");
}

function renderCardsRedeem(container) {
  container.innerHTML = `
    <div class="jc-section jc-redeem">
      <h2>Resgatar código</h2>
      <input type="text" id="jcCodeInput" class="jc-input" placeholder="JET-CARD-XXXX"/>
      <button class="jc-btn primary" onclick="cardsRedeemCode()">Resgatar</button>
      <div id="jcRedeemStatus" class="jc-hint"></div>
    </div>
  `;
}

async function cardsRedeemCode() {
  const raw = (document.getElementById("jcCodeInput")?.value || "").trim().toUpperCase();
  const status = document.getElementById("jcRedeemStatus");
  if (!raw) return;
  const codes = window.AppState.cards.codes || {};
  let entry = null, codeId = null;
  for (const [id, c] of Object.entries(codes)) {
    if ((c.code || id).toUpperCase() === raw) { entry = c; codeId = id; break; }
  }
  if (!entry) { if (status) status.textContent = "Código não encontrado"; return; }
  const v = validateCodePayload(entry);
  if (!v.ok) { if (status) status.textContent = v.error; return; }
  const ownerId = getCardsOwnerId();
  const updates = {
    ["cards/codes/" + codeId + "/used"]: true,
    ["cards/codes/" + codeId + "/usedBy"]: ownerId,
    ["cards/codes/" + codeId + "/usedAt"]: new Date().toISOString()
  };
  if (entry.type === "pack" || !entry.type) {
    const packId = newPackId();
    updates["cards/packs/" + packId] = {
      ownerId, status: "sealed", label: entry.label || "Pack código",
      source: "code", codeId, grantedAt: new Date().toISOString()
    };
    await window.marketDb.ref().update(updates);
    if (status) status.textContent = "Pack adicionado!";
    showCardsView("packs");
    return;
  }
  if (entry.type === "card") {
    const cardId = newCardId();
    updates["cards/inventory/" + ownerId + "/" + cardId] = buildCardRecord({
      playerKey: entry.playerKey, playerName: entry.playerName, team: entry.team,
      rarity: entry.rarity || "rare", foil: entry.foil || "normal",
      edition: entry.edition || "BASE", specialImageUrl: entry.specialImageUrl,
      description: entry.description, source: "code"
    });
    await window.marketDb.ref().update(updates);
    if (status) status.textContent = "Carta adicionada!";
    showCardsView("inventory");
    return;
  }
  if (status) status.textContent = "Tipo desconhecido";
}

window.enterCardsMode = enterCardsMode;
window.exitCardsMode = exitCardsMode;
window.showCardsView = showCardsView;
window.renderCardsShell = renderCardsShell;
window.cardsDoLogin = cardsDoLogin;
window.cardsOpenPack = cardsOpenPack;
window.cardsOpenPacksBatch = cardsOpenPacksBatch;
window.cardsShowBatchResults = cardsShowBatchResults;
window.cardsSkipBatchAnim = cardsSkipBatchAnim;
window.cardsBatchPhaseReveal = cardsBatchPhaseReveal;
window.cardsReplayPack = cardsReplayPack;
window.cardsRevealNext = cardsRevealNext;
window.cardsSkipReveal = cardsSkipReveal;
window.cardsOpenDetail = cardsOpenDetail;
window.cardsPickSlot = cardsPickSlot;
window.cardsAssignToSlot = cardsAssignToSlot;
window.cardsSaveShowcase = cardsSaveShowcase;
window.cardsClaimOffer = cardsClaimOffer;
window.cardsRedeemCode = cardsRedeemCode;
window.cardsToggleMoreMenu = cardsToggleMoreMenu;
window.cardsRefreshShowcaseOnly = cardsRefreshShowcaseOnly;
window.cardsVitSearchDebounced = cardsVitSearchDebounced;
