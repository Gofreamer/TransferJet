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

  shell.innerHTML = `
    <div class="jc-app">
      <header class="jc-header">
        <div class="jc-brand">
          <div class="jc-logo">JET CARDS</div>
          <div class="jc-powered">Coleção oficial · Jet League</div>
        </div>
        <div class="jc-header-user">${name}</div>
        <button class="jc-btn ghost" onclick="exitCardsMode()">← TransferJet</button>
      </header>
      <nav class="jc-nav">
        ${[
          ["hub", "Início"],
          ["packs", "Pacotes"],
          ["inventory", "Inventário"],
          ["carddex", "Coleção"],
          ["showcase", "Vitrine"],
          ["npcs", "Cenas"],
          ["redeem", "Código"]
        ].map(([v, l]) => `<button class="jc-nav-btn ${view===v?"active":""}" onclick="showCardsView('${v}')">${l}</button>`).join("")}
      </nav>
      <div class="jc-content" id="jcContent"></div>
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
    renderCardsShell();
    return;
  }
  if (!found) return alert("Não encontrado.");
  setCardsSession(found.id, found.displayName);
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
      <div class="jc-section">
        <div class="jc-section-head"><h2>Vitrine</h2><button class="jc-btn sm" onclick="showCardsView('showcase')">Editar</button></div>
        <div class="jc-showcase-row">
          ${((showcase?.slots) || []).filter(Boolean).slice(0, 6).map(id => {
            const c = byId[id];
            return c ? collectibleCardHTML(c, { small: true, onclick: `cardsOpenDetail('${c.cardId}')` }) : "";
          }).join("") || "<p class='jc-hint'>Monte a vitrine com suas melhores cartas.</p>"}
        </div>
      </div>
      <div class="jc-actions-row">
        <button class="jc-btn primary" onclick="showCardsView('packs')">Abrir pacotes</button>
        <button class="jc-btn" onclick="showCardsView('carddex')">Álbum</button>
        <button class="jc-btn" onclick="showCardsView('redeem')">Código</button>
      </div>
    </div>
  `;
}

/* ========== PACKS + abertura sequencial ========== */
function renderCardsPacks(container) {
  const ownerId = getCardsOwnerId();
  const packs = Object.entries(window.AppState.cards.packs || {})
    .filter(([, p]) => p.ownerId === ownerId)
    .sort((a, b) => (b[1].grantedAt || "").localeCompare(a[1].grantedAt || ""));

  container.innerHTML = `
    <div class="jc-section">
      <h2>Pacotes</h2>
      <p class="jc-hint">Revelação carta a carta. Animações só no dispositivo — Firebase salva o resultado uma vez.</p>
      <div class="jc-pack-list">
        ${packs.map(([id, p]) => `
          <div class="jc-pack-item status-${p.status}">
            <div class="jc-pack-visual">📦</div>
            <div class="jc-pack-info">
              <div class="jc-pack-title">${p.label || "Pacote Jet Cards"}</div>
              <div class="jc-pack-meta">${p.status === "sealed" ? "Lacrado" : "Aberto"} · ${p.source || ""}</div>
            </div>
            ${p.status === "sealed"
              ? `<button class="jc-btn primary sm" onclick="cardsOpenPack('${id}')">Abrir</button>`
              : `<button class="jc-btn ghost sm" onclick="cardsReplayPack('${id}')">Rever</button>`}
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

  // marca descobertas novas (client)
  results.forEach(r => {
    const defId = r.defId || catalogDefId(r.playerKey, r.edition || "BASE");
    r.isNewDiscovery = !before.has(defId);
  });

  const invUpdates = {};
  results.forEach(r => {
    invUpdates[r.cardId] = buildCardRecord(r, packId);
  });
  const updates = {};
  updates["cards/packs/" + packId + "/status"] = "opened";
  updates["cards/packs/" + packId + "/openedAt"] = new Date().toISOString();
  updates["cards/packs/" + packId + "/results"] = results.map(r => {
    const { isNewDiscovery, ...rest } = r;
    return rest;
  });
  Object.entries(invUpdates).forEach(([cid, data]) => {
    updates["cards/inventory/" + ownerId + "/" + cid] = data;
  });

  try {
    await window.marketDb.ref().update(updates);
  } catch (e) {
    return alert("Erro ao salvar: " + (e.message || e));
  }

  cardsRunRevealSequence(results, false);
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
  window._jcReveal = { results, index: -1, skip: false };
  stage.innerHTML = `
    <div class="jc-open-anim">
      <div class="jc-pack-box" id="jcPackBox">📦</div>
      <p class="jc-hint">Toque para abrir</p>
      <button class="jc-btn primary" id="jcRevealBtn" onclick="cardsRevealNext()">Abrir pacote</button>
      <button class="jc-btn ghost sm" onclick="cardsSkipReveal()">Pular animação</button>
      <div id="jcRevealFocus" class="jc-reveal-focus"></div>
      <div id="jcRevealDone" class="jc-reveal-done hidden"></div>
    </div>
  `;
}

function cardsSkipReveal() {
  if (!window._jcReveal) return;
  window._jcReveal.skip = true;
  window._jcReveal.index = window._jcReveal.results.length - 1;
  cardsRevealNext(true);
}

function cardsRevealNext(forceAll) {
  const st = window._jcReveal;
  if (!st) return;
  const box = document.getElementById("jcPackBox");
  const focus = document.getElementById("jcRevealFocus");
  const btn = document.getElementById("jcRevealBtn");
  const done = document.getElementById("jcRevealDone");

  if (st.index < 0) {
    st.index = 0;
    box?.classList.add("opening");
    if (btn) btn.textContent = "Revelar carta";
  }

  if (forceAll || st.skip) {
    if (focus) {
      focus.innerHTML = `<div class="jc-reveal-row revealed">${st.results.map(r => collectibleCardHTML(r)).join("")}</div>`;
    }
    if (done) {
      done.classList.remove("hidden");
      done.innerHTML = `<button class="jc-btn primary" onclick="showCardsView('inventory')">Inventário</button>
        <button class="jc-btn" onclick="showCardsView('carddex')">Álbum</button>`;
    }
    if (btn) btn.style.display = "none";
    box?.classList.add("opened");
    return;
  }

  if (st.index >= st.results.length) {
    if (done) {
      done.classList.remove("hidden");
      done.innerHTML = `<button class="jc-btn primary" onclick="showCardsView('inventory')">Inventário</button>
        <button class="jc-btn" onclick="showCardsView('carddex')">Álbum</button>`;
    }
    if (btn) btn.style.display = "none";
    return;
  }

  const card = st.results[st.index];
  const rarity = card.rarity || "common";
  const delays = { common: 400, rare: 700, epic: 1100, legend: 1600 };
  const delay = delays[rarity] || 500;

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
    if (!window._jcReveal || window._jcReveal.skip) return;
    if (focus) {
      focus.innerHTML = `
        <div class="jc-reveal-one ${card.isNewDiscovery ? "new-discovery" : ""}">
          ${card.isNewDiscovery ? `<div class="jc-new-badge">NOVA CARTA DESCOBERTA</div>` : ""}
          ${collectibleCardHTML(card)}
          ${card.isNewDiscovery ? `<p class="jc-new-sub">Adicionada à coleção</p>` : ""}
        </div>
      `;
    }
    st.index++;
    if (btn) {
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
  let list = grouped;
  if (rarity) list = list.filter(c => c.rarity === rarity);

  container.innerHTML = `
    <div class="jc-section">
      <div class="jc-section-head">
        <h2>Inventário</h2>
        <select onchange="window._jcInvRarity=this.value;renderCardsShell()">
          <option value="">Todas</option>
          ${["legend","epic","rare","common"].map(r =>
            `<option value="${r}" ${rarity===r?"selected":""}>${(window.CARDS.RARITY[r]||{}).label||r}</option>`
          ).join("")}
        </select>
      </div>
      <p class="jc-hint">Duplicatas aparecem como ×N. Toque para detalhes.</p>
      <div class="jc-grid tc-grid">
        ${list.map(c => collectibleCardHTML(c, {
          showCount: true,
          count: c.count,
          onclick: `cardsOpenDetail('${c.copies[0]}')`
        })).join("") || "<p class='jc-hint'>Sem cartas.</p>"}
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

/* ========== DETALHE ========== */
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
    <div class="jc-modal">
      <button class="jc-modal-close" onclick="document.getElementById('jcCardModal').remove()">×</button>
      <div class="jc-modal-card">
        ${collectibleCardHTML(card)}
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
}

/* ========== VITRINE / NPC / CÓDIGO — preservados com novo visual ========== */
function renderCardsShowcase(container) {
  const ownerId = getCardsOwnerId();
  const cards = inventoryList(ownerId);
  const sc = (window.AppState.cards.showcases || {})[ownerId] || { slots: [], title: "Minha vitrine" };
  const slots = Array.from({ length: cardsSettings().showcaseSlots || 6 }, (_, i) => sc.slots?.[i] || null);
  const byId = Object.fromEntries(cards.map(c => [c.cardId, c]));
  if (!window._jcShowcaseDraft) window._jcShowcaseDraft = slots.slice();

  container.innerHTML = `
    <div class="jc-section">
      <h2>Sua vitrine</h2>
      <p class="jc-hint">Clique no slot e depois na carta. Prestígio da coleção.</p>
      <div class="jc-showcase-row">
        ${(window._jcShowcaseDraft || slots).map((id, i) => {
          const c = id && byId[id];
          return `<div class="jc-showcase-slot ${window._jcSlot===i?"picking":""}" onclick="cardsPickSlot(${i})">
            ${c ? collectibleCardHTML(c, { small: true }) : "<div class='jc-slot-empty'>Slot " + (i+1) + "</div>"}
          </div>`;
        }).join("")}
      </div>
      <div class="jc-grid tc-grid" style="margin-top:16px">
        ${inventoryGrouped(ownerId).map(c => collectibleCardHTML(c, {
          showCount: true, count: c.count, selected: (window._jcShowcaseDraft || []).includes(c.copies[0]),
          onclick: `cardsAssignToSlot('${c.copies[0]}')`
        })).join("")}
      </div>
      <div style="margin-top:12px">
        <button class="jc-btn primary" onclick="cardsSaveShowcase()">Salvar vitrine</button>
      </div>
    </div>
    <div class="jc-section">
      <h2>Hall de colecionadores</h2>
      ${Object.entries(window.AppState.cards.showcases || {}).filter(([,s]) => s.type === "npc").map(([, s]) => `
        <div class="jc-npc-vitrine">
          <div class="jc-npc-head">${s.avatar || "🎴"} <strong>${s.name}</strong> · ${s.title || ""}</div>
          <div class="jc-showcase-row">
            ${(s.slots || []).map(slot => {
              if (typeof slot === "object" && slot?.playerKey) return collectibleCardHTML(slot, { small: true });
              return "";
            }).join("") || "<span class='jc-hint'>Em montagem</span>"}
          </div>
        </div>
      `).join("")}
    </div>
  `;
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
window.cardsReplayPack = cardsReplayPack;
window.cardsRevealNext = cardsRevealNext;
window.cardsSkipReveal = cardsSkipReveal;
window.cardsOpenDetail = cardsOpenDetail;
window.cardsPickSlot = cardsPickSlot;
window.cardsAssignToSlot = cardsAssignToSlot;
window.cardsSaveShowcase = cardsSaveShowcase;
window.cardsClaimOffer = cardsClaimOffer;
window.cardsRedeemCode = cardsRedeemCode;
