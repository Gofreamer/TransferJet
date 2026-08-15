/* Jet Cards 2.0 — Admin */
function renderCardsAdmin() {
  const el = document.getElementById("adminTabContent");
  if (!el) return;
  ensureCardsState();
  const s = cardsSettings();
  const codes = Object.entries(window.AppState.cards.codes || {});
  const offers = Object.entries(window.AppState.cards.offers || {});
  const specials = Object.entries(window.AppState.cards.specials || {});
  const catalogCount = Object.keys(window.AppState.cards.catalog || {}).length;
  const humans = Object.entries(window.AppState.fantasy?.participants || {}).filter(([, p]) => p && p.type !== "npc");
  const players = (typeof getAllPlayersFlat === "function" ? getAllPlayersFlat() : []).filter(p => p.club && p.club !== "Livre");
  const editionOpts = Object.entries(window.CARDS.EDITIONS || {}).map(([k, v]) =>
    `<option value="${k}">${v.label}</option>`
  ).join("");

  el.innerHTML = `
    <h3 class="admin-section-title">Jet Cards 2.0</h3>
    <p class="admin-sub">Catálogo base: <strong>${catalogCount}</strong> cartas · Coleção, edições especiais, packs e códigos.</p>
    <div class="admin-actions" style="flex-wrap:wrap;gap:8px;margin-bottom:14px">
      <button class="btn-primary btn-sm" onclick="jcAdminSeed()">Seed / sync catálogo</button>
      <button class="btn-primary btn-sm" onclick="jcAdminGrantPack()">Dar pack</button>
    </div>

    <h3 class="admin-section-title">Config</h3>
    <div class="admin-form-grid">
      <div><label>Cartas/pack</label><input type="number" id="jcPackSize" min="1" max="5" value="${s.packSize ?? 3}"></div>
      <div><label>Common</label><input type="number" step="0.01" id="jcRateC" value="${s.rates?.common ?? 0.7}"></div>
      <div><label>Rare</label><input type="number" step="0.01" id="jcRateR" value="${s.rates?.rare ?? 0.22}"></div>
      <div><label>Epic</label><input type="number" step="0.01" id="jcRateE" value="${s.rates?.epic ?? 0.065}"></div>
      <div><label>Legend</label><input type="number" step="0.01" id="jcRateL" value="${s.rates?.legend ?? 0.015}"></div>
      <div><label>Label do ciclo</label><input type="text" id="jcCycle" value="${s.cycleLabel || ""}" placeholder="CICLO III"></div>
      <div><label>Temporada</label><input type="text" id="jcSeason" value="${s.seasonId || window.AppState.jet.currentSeason || ""}"></div>
      <div><label>Slots vitrine</label><input type="number" id="jcSlots" min="3" max="12" value="${s.showcaseSlots ?? 6}"></div>
    </div>
    <div class="admin-actions" style="margin-top:8px">
      <button class="btn-primary btn-sm" onclick="jcAdminSaveConfig()">Salvar config</button>
    </div>

    <h3 class="admin-section-title" style="margin-top:22px">Edição especial</h3>
    <p class="admin-sub">MVP, Champion, Finals, Commemorative… com arte por URL opcional.</p>
    <div class="admin-form-grid">
      <div><label>Tipo</label><select id="jcSpEdition">${editionOpts}</select></div>
      <div>
        <label>Agente</label>
        <select id="jcSpPlayer">
          ${players.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(p =>
            `<option value="${p.key}" data-name="${p.name}" data-team="${p.club}" data-rank="${p.rank||""}">${p.name} (${p.club})</option>`
          ).join("")}
        </select>
      </div>
      <div><label>Equipe (congelada)</label><input type="text" id="jcSpTeam" placeholder="deixe vazio = equipe atual"></div>
      <div>
        <label>Raridade padrão</label>
        <select id="jcSpRarity">
          <option value="rare">Rare</option>
          <option value="epic" selected>Epic</option>
          <option value="legend">Legend</option>
        </select>
      </div>
      <div><label>HOLO padrão</label><select id="jcSpFoil"><option value="normal">Normal</option><option value="holo">Holo</option></select></div>
      <div><label>Ciclo</label><input type="text" id="jcSpCycle" value="${s.cycleLabel || cardsCycleLabel()}"></div>
      <div class="full"><label>Imagem especial (URL)</label><input type="url" id="jcSpImg" placeholder="https://..."></div>
      <div class="full"><label>Descrição</label><input type="text" id="jcSpDesc" placeholder="Campeão do Ciclo III..."></div>
      <div class="full"><label>Conquistas (uma por linha)</label><textarea id="jcSpAch" rows="2" placeholder="🏆 Campeão&#10;⭐ MVP"></textarea></div>
      <div><label>No pool de packs?</label><select id="jcSpPool"><option value="no">Não</option><option value="yes">Sim</option></select></div>
      <div><label>Nome custom (opcional)</label><input type="text" id="jcSpCustom"></div>
    </div>
    <div class="admin-actions" style="margin-top:8px">
      <button class="btn-primary btn-sm" onclick="jcAdminCreateSpecial()">Criar edição especial</button>
    </div>
    <div class="admin-table-wrap" style="margin-top:10px;max-height:180px;overflow:auto">
      <table class="admin-table">
        <thead><tr><th>ID</th><th>Agente</th><th>Edição</th><th>Nº</th><th>Pack</th><th></th></tr></thead>
        <tbody>
          ${specials.map(([id, s]) => `
            <tr>
              <td><code style="font-size:0.7rem">${id.slice(0,18)}</code></td>
              <td>${s.playerName || s.playerKey}</td>
              <td>${s.edition}</td>
              <td>${s.number != null ? "JL-" + String(s.number).padStart(3,"0") : "—"}</td>
              <td>${s.inPackPool ? "Sim" : "Não"}</td>
              <td><button class="btn-gray btn-sm" onclick="jcAdminDeleteSpecial('${id}')">Remover</button></td>
            </tr>
          `).join("") || "<tr><td colspan='6'>—</td></tr>"}
        </tbody>
      </table>
    </div>

    <h3 class="admin-section-title" style="margin-top:22px">Código</h3>
    <div class="admin-form-grid">
      <div>
        <label>Tipo</label>
        <select id="jcCodeType" onchange="jcAdminToggleCodeType()">
          <option value="pack">Pack</option>
          <option value="card">Carta específica</option>
        </select>
      </div>
      <div><label>Código</label><input type="text" id="jcCodeStr" placeholder="auto se vazio"></div>
      <div><label>Label</label><input type="text" id="jcCodeLabel"></div>
      <div id="jcCodeCardFields" style="display:none;grid-column:1/-1">
        <div class="admin-form-grid">
          <div>
            <label>Agente</label>
            <select id="jcCodePlayer">
              ${players.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(p =>
                `<option value="${p.key}" data-name="${p.name}" data-team="${p.club}">${p.name}</option>`
              ).join("")}
            </select>
          </div>
          <div><label>Edição</label><select id="jcCodeEdition">${editionOpts}</select></div>
          <div>
            <label>Raridade</label>
            <select id="jcCodeRarity">
              <option value="rare">Rare</option><option value="epic">Epic</option><option value="legend">Legend</option>
            </select>
          </div>
          <div><label>Foil</label><select id="jcCodeFoil"><option value="normal">Normal</option><option value="holo">Holo</option></select></div>
          <div class="full"><label>Imagem URL (opcional)</label><input type="url" id="jcCodeImg"></div>
        </div>
      </div>
    </div>
    <div class="admin-actions" style="margin-top:8px">
      <button class="btn-primary btn-sm" onclick="jcAdminCreateCode()">Criar código</button>
    </div>
    <div class="admin-table-wrap" style="margin-top:10px;max-height:160px;overflow:auto">
      <table class="admin-table">
        <thead><tr><th>Código</th><th>Tipo</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${codes.slice().reverse().slice(0, 25).map(([id, c]) => `
            <tr>
              <td><code>${c.code || id}</code></td>
              <td>${c.type || "pack"}</td>
              <td>${c.used ? "Usado" : "Livre"}</td>
              <td>${!c.used ? `<button class="btn-gray btn-sm" onclick="jcAdminDeleteCode('${id}')">Apagar</button>` : ""}</td>
            </tr>
          `).join("") || "<tr><td colspan='4'>—</td></tr>"}
        </tbody>
      </table>
    </div>

    <h3 class="admin-section-title" style="margin-top:22px">Cena NPC</h3>
    <div class="admin-form-grid">
      <div><label>NPC</label><input type="text" id="jcOfferNpc" value="Luna Underdog"></div>
      <div><label>Avatar</label><input type="text" id="jcOfferAvatar" value="🦓"></div>
      <div class="full"><label>Texto</label><input type="text" id="jcOfferText" placeholder="Cena narrativa..."></div>
      <div>
        <label>Agente</label>
        <select id="jcOfferPlayer">
          ${players.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(p =>
            `<option value="${p.key}" data-name="${p.name}" data-team="${p.club}">${p.name}</option>`
          ).join("")}
        </select>
      </div>
      <div><label>Edição</label><select id="jcOfferEdition">${editionOpts}</select></div>
      <div>
        <label>Raridade</label>
        <select id="jcOfferRarity"><option value="epic">Epic</option><option value="legend">Legend</option><option value="rare">Rare</option></select>
      </div>
      <div><label>Foil</label><select id="jcOfferFoil"><option value="holo">Holo</option><option value="normal">Normal</option></select></div>
      <div class="full"><label>Imagem URL</label><input type="url" id="jcOfferImg"></div>
      <div>
        <label>Dono</label>
        <select id="jcOfferOwner">
          <option value="">Qualquer</option>
          ${humans.map(([id, p]) => `<option value="${id}">${p.displayName}</option>`).join("")}
        </select>
      </div>
    </div>
    <div class="admin-actions" style="margin-top:8px">
      <button class="btn-primary btn-sm" onclick="jcAdminCreateOffer()">Publicar cena</button>
    </div>

    <h3 class="admin-section-title" style="margin-top:22px">Dar carta direta</h3>
    <div class="admin-form-grid">
      <div>
        <label>Jogador</label>
        <select id="jcGrantOwner">
          ${humans.map(([id, p]) => `<option value="${id}">${p.displayName}</option>`).join("")}
        </select>
      </div>
      <div>
        <label>Agente</label>
        <select id="jcGrantPlayer">
          ${players.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(p =>
            `<option value="${p.key}" data-name="${p.name}" data-team="${p.club}" data-rank="${p.rank||""}">${p.name}</option>`
          ).join("")}
        </select>
      </div>
      <div><label>Edição</label><select id="jcGrantEdition">${editionOpts}</select></div>
      <div>
        <label>Raridade</label>
        <select id="jcGrantRarity"><option value="legend">Legend</option><option value="epic">Epic</option><option value="rare">Rare</option></select>
      </div>
      <div><label>Foil</label><select id="jcGrantFoil"><option value="holo">Holo</option><option value="normal">Normal</option></select></div>
      <div class="full"><label>Imagem URL</label><input type="url" id="jcGrantImg"></div>
    </div>
    <div class="admin-actions" style="margin-top:8px">
      <button class="btn-primary btn-sm" onclick="jcAdminGrantCard()">Dar carta</button>
    </div>

    <h3 class="admin-section-title" style="margin-top:22px">Vitrine NPC</h3>
    <div class="admin-form-grid">
      <div>
        <label>Vitrine</label>
        <select id="jcNpcVitrine">
          ${(window.CARDS.NPC_VITRINES || []).map(n => `<option value="${n.id}">${n.name}</option>`).join("")}
        </select>
      </div>
      <div>
        <label>Agente</label>
        <select id="jcNpcVitPlayer">
          ${players.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(p =>
            `<option value="${p.key}" data-name="${p.name}" data-team="${p.club}">${p.name}</option>`
          ).join("")}
        </select>
      </div>
      <div>
        <label>Raridade</label>
        <select id="jcNpcVitRarity"><option value="legend">Legend</option><option value="epic">Epic</option></select>
      </div>
      <div><label>Edição</label><select id="jcNpcVitEdition">${editionOpts}</select></div>
    </div>
    <div class="admin-actions" style="margin-top:8px">
      <button class="btn-primary btn-sm" onclick="jcAdminAddNpcShowcaseCard()">Add vitrine NPC</button>
      <button class="btn-gray btn-sm" onclick="jcAdminClearNpcShowcase()">Limpar</button>
    </div>
  `;
}

function jcAdminToggleCodeType() {
  const t = document.getElementById("jcCodeType")?.value;
  const box = document.getElementById("jcCodeCardFields");
  if (box) box.style.display = t === "card" ? "block" : "none";
}

async function jcAdminSeed() {
  await ensureCardsSeeded();
  const n = await syncCardsCatalog();
  alert("Catálogo sincronizado (+" + n + " novas BASE)");
  renderCardsAdmin();
}

async function jcAdminSaveConfig() {
  await saveCardsSettings({
    packSize: Number(document.getElementById("jcPackSize")?.value) || 3,
    rates: {
      common: Number(document.getElementById("jcRateC")?.value) || 0.7,
      rare: Number(document.getElementById("jcRateR")?.value) || 0.22,
      epic: Number(document.getElementById("jcRateE")?.value) || 0.065,
      legend: Number(document.getElementById("jcRateL")?.value) || 0.015
    },
    cycleLabel: document.getElementById("jcCycle")?.value || null,
    seasonId: document.getElementById("jcSeason")?.value || window.AppState.jet.currentSeason,
    showcaseSlots: Number(document.getElementById("jcSlots")?.value) || 6
  });
  alert("Config salva");
  renderCardsAdmin();
}

async function jcAdminCreateSpecial() {
  const sel = document.getElementById("jcSpPlayer");
  const opt = sel?.selectedOptions?.[0];
  if (!opt?.value) return alert("Agente obrigatório");
  const edition = document.getElementById("jcSpEdition")?.value || "MVP";
  const defId = catalogDefId(opt.value, edition) + "_" + Date.now().toString(36).slice(-4);
  // next number after catalog max
  const nums = [
    ...Object.values(window.AppState.cards.catalog || {}).map(c => Number(c.number) || 0),
    ...Object.values(window.AppState.cards.specials || {}).map(c => Number(c.number) || 0)
  ];
  const number = (nums.length ? Math.max(...nums) : 0) + 1;
  const achRaw = document.getElementById("jcSpAch")?.value || "";
  const achievements = achRaw.split("\n").map(s => s.trim()).filter(Boolean);
  await window.marketDb.ref("cards/specials/" + defId).set({
    defId,
    playerKey: opt.value,
    playerName: opt.dataset.name,
    team: document.getElementById("jcSpTeam")?.value || opt.dataset.team,
    rank: opt.dataset.rank || "—",
    edition,
    number,
    cycle: document.getElementById("jcSpCycle")?.value || cardsCycleLabel(),
    season: cardsSettings().seasonId || "",
    specialImageUrl: document.getElementById("jcSpImg")?.value || null,
    description: document.getElementById("jcSpDesc")?.value || "",
    achievements,
    customName: document.getElementById("jcSpCustom")?.value || null,
    defaultRarity: document.getElementById("jcSpRarity")?.value || "epic",
    defaultFoil: document.getElementById("jcSpFoil")?.value || "normal",
    inPackPool: document.getElementById("jcSpPool")?.value === "yes",
    active: true,
    createdAt: new Date().toISOString()
  });
  alert("Edição especial criada · " + formatCardNumber(number));
  renderCardsAdmin();
}

async function jcAdminDeleteSpecial(id) {
  if (!confirm("Remover especial?")) return;
  await window.marketDb.ref("cards/specials/" + id).remove();
  renderCardsAdmin();
}

async function jcAdminCreateCode() {
  const type = document.getElementById("jcCodeType")?.value || "pack";
  let code = (document.getElementById("jcCodeStr")?.value || "").trim().toUpperCase();
  if (!code) code = "JET-CARD-" + Math.random().toString(36).slice(2, 8).toUpperCase();
  const id = "code_" + Date.now();
  const payload = {
    code, type,
    label: document.getElementById("jcCodeLabel")?.value || "",
    used: false,
    createdAt: new Date().toISOString()
  };
  if (type === "card") {
    const sel = document.getElementById("jcCodePlayer");
    const opt = sel?.selectedOptions?.[0];
    if (!opt?.value) return alert("Selecione agente");
    payload.playerKey = opt.value;
    payload.playerName = opt.dataset.name;
    payload.team = opt.dataset.team;
    payload.edition = document.getElementById("jcCodeEdition")?.value || "BASE";
    payload.rarity = document.getElementById("jcCodeRarity")?.value || "rare";
    payload.foil = document.getElementById("jcCodeFoil")?.value || "normal";
    payload.specialImageUrl = document.getElementById("jcCodeImg")?.value || null;
  }
  await window.marketDb.ref("cards/codes/" + id).set(payload);
  alert("Código: " + code);
  renderCardsAdmin();
}

async function jcAdminDeleteCode(id) {
  if (!confirm("Apagar?")) return;
  await window.marketDb.ref("cards/codes/" + id).remove();
  renderCardsAdmin();
}

async function jcAdminGrantPack() {
  const humans = Object.entries(window.AppState.fantasy?.participants || {}).filter(([, p]) => p && p.type !== "npc");
  if (!humans.length) return alert("Cadastre humano no Fantasy");
  const ownerId = humans[0][0];
  const packId = newPackId();
  await window.marketDb.ref("cards/packs/" + packId).set({
    ownerId, status: "sealed", label: "Pack Admin",
    source: "admin", grantedAt: new Date().toISOString()
  });
  alert("Pack → " + humans[0][1].displayName);
  renderCardsAdmin();
}

async function jcAdminCreateOffer() {
  const sel = document.getElementById("jcOfferPlayer");
  const opt = sel?.selectedOptions?.[0];
  if (!opt?.value) return;
  const id = "offer_" + Date.now();
  await window.marketDb.ref("cards/offers/" + id).set({
    npcName: document.getElementById("jcOfferNpc")?.value || "NPC",
    npcAvatar: document.getElementById("jcOfferAvatar")?.value || "🎭",
    sceneText: document.getElementById("jcOfferText")?.value || "",
    playerKey: opt.value,
    playerName: opt.dataset.name,
    team: opt.dataset.team,
    edition: document.getElementById("jcOfferEdition")?.value || "BASE",
    rarity: document.getElementById("jcOfferRarity")?.value || "epic",
    foil: document.getElementById("jcOfferFoil")?.value || "holo",
    specialImageUrl: document.getElementById("jcOfferImg")?.value || null,
    ownerId: document.getElementById("jcOfferOwner")?.value || null,
    active: true,
    createdAt: new Date().toISOString()
  });
  alert("Cena publicada");
  renderCardsAdmin();
}

async function jcAdminGrantCard() {
  const ownerId = document.getElementById("jcGrantOwner")?.value;
  const sel = document.getElementById("jcGrantPlayer");
  const opt = sel?.selectedOptions?.[0];
  if (!ownerId || !opt?.value) return alert("Preencha");
  const cardId = newCardId();
  await window.marketDb.ref("cards/inventory/" + ownerId + "/" + cardId).set(buildCardRecord({
    playerKey: opt.value,
    playerName: opt.dataset.name,
    team: opt.dataset.team,
    rank: opt.dataset.rank,
    edition: document.getElementById("jcGrantEdition")?.value || "BASE",
    rarity: document.getElementById("jcGrantRarity")?.value || "legend",
    foil: document.getElementById("jcGrantFoil")?.value || "holo",
    specialImageUrl: document.getElementById("jcGrantImg")?.value || null,
    source: "admin"
  }));
  alert("Carta concedida");
  renderCardsAdmin();
}

async function jcAdminAddNpcShowcaseCard() {
  const vid = document.getElementById("jcNpcVitrine")?.value;
  const sel = document.getElementById("jcNpcVitPlayer");
  const opt = sel?.selectedOptions?.[0];
  if (!vid || !opt?.value) return;
  const snap = await window.marketDb.ref("cards/showcases/" + vid).once("value");
  const cur = snap.val() || { type: "npc", slots: [] };
  const slots = Array.isArray(cur.slots) ? cur.slots.slice() : [];
  const edition = document.getElementById("jcNpcVitEdition")?.value || "BASE";
  const rarity = document.getElementById("jcNpcVitRarity")?.value || "legend";
  slots.push(buildCardRecord({
    playerKey: opt.value,
    playerName: opt.dataset.name,
    team: opt.dataset.team,
    edition,
    rarity,
    foil: "holo",
    source: "npc_showcase"
  }));
  const meta = (window.CARDS.NPC_VITRINES || []).find(n => n.id === vid) || {};
  await window.marketDb.ref("cards/showcases/" + vid).set({
    type: "npc",
    name: meta.name || cur.name,
    title: meta.title || cur.title || "",
    avatar: meta.avatar || cur.avatar || "🎴",
    slots
  });
  alert("Vitrine NPC atualizada");
  renderCardsAdmin();
}

async function jcAdminClearNpcShowcase() {
  const vid = document.getElementById("jcNpcVitrine")?.value;
  if (!vid || !confirm("Limpar?")) return;
  await window.marketDb.ref("cards/showcases/" + vid + "/slots").set([]);
  renderCardsAdmin();
}

window.renderCardsAdmin = renderCardsAdmin;
window.jcAdminSeed = jcAdminSeed;
window.jcAdminSaveConfig = jcAdminSaveConfig;
window.jcAdminCreateSpecial = jcAdminCreateSpecial;
window.jcAdminDeleteSpecial = jcAdminDeleteSpecial;
window.jcAdminCreateCode = jcAdminCreateCode;
window.jcAdminDeleteCode = jcAdminDeleteCode;
window.jcAdminGrantPack = jcAdminGrantPack;
window.jcAdminCreateOffer = jcAdminCreateOffer;
window.jcAdminGrantCard = jcAdminGrantCard;
window.jcAdminAddNpcShowcaseCard = jcAdminAddNpcShowcaseCard;
window.jcAdminClearNpcShowcase = jcAdminClearNpcShowcase;
window.jcAdminToggleCodeType = jcAdminToggleCodeType;
