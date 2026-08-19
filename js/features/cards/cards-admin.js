/* Jet Cards 2.0 — Admin */
function renderCardsAdmin(subTab) {
  const el = document.getElementById("adminTabContent");
  if (!el) return;
  ensureCardsState();
  if (subTab) window._jcAdminTab = subTab;
  const tab = window._jcAdminTab || "config";
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
  const humanOpts = humans.map(([id, p]) => `<option value="${id}">${p.displayName || id}</option>`).join("") || "<option value=''>Nenhum humano</option>";
  const playerOpts = players.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(p =>
    `<option value="${p.key}" data-name="${p.name}" data-team="${p.club}" data-rank="${p.rank||""}">${p.name}${p.club ? " ("+p.club+")" : ""}</option>`
  ).join("");
  const npcVitOpts = (() => {
    const fixed = window.CARDS.NPC_VITRINES || [];
    const fromDb = Object.entries(window.AppState.cards.showcases || {})
      .filter(([, s]) => s && s.type === "npc")
      .map(([id, s]) => ({ id, name: s.name || id }));
    const seen = new Set();
    const opts = [];
    [...fixed, ...fromDb].forEach(n => {
      if (seen.has(n.id)) return;
      seen.add(n.id);
      opts.push(`<option value="${n.id}">${n.name}</option>`);
    });
    return opts.join("") || "<option value=''>Nenhuma</option>";
  })();

  const tabs = [
    ["config", "Config"],
    ["packs", "Packs"],
    ["cartas", "Cartas"],
    ["codigos", "Códigos"],
    ["vitrines", "Vitrines"],
    ["cenas", "Cenas"],
    ["jogadores", "Jogadores"]
  ];

  let body = "";
  if (tab === "config") {
    body = `
      <p class="admin-sub">Catálogo base: <strong>${catalogCount}</strong> cartas · rates, ciclo e slots.</p>
      <div class="admin-actions" style="flex-wrap:wrap;gap:8px;margin-bottom:14px">
        <button class="btn-primary btn-sm" onclick="jcAdminSeed()">Seed / sync catálogo</button>
        <button class="btn-gray btn-sm" onclick="jcAdminPurgeOpenedPacks()">Limpar packs abertos</button>
        <button class="btn-gray btn-sm" onclick="jcAdminConsolidateInventories()">Empilhar inventários (consolidar)</button>
      </div>
      <p class="admin-sub" style="margin-top:-6px">Limpar packs abertos e empilhar <strong>não apagam</strong> cartas do jogador — só reduzem peso no Firebase.</p>
      <h3 class="admin-section-title">Config</h3>
      <div class="admin-form-grid">
        <div><label>Cartas/pack</label><input type="number" id="jcPackSize" min="1" max="5" value="${s.packSize ?? 3}"></div>
        <div><label>Common</label><input type="number" step="0.01" id="jcRateC" value="${s.rates?.common ?? 0.82}"></div>
        <div><label>Rare</label><input type="number" step="0.01" id="jcRateR" value="${s.rates?.rare ?? 0.13}"></div>
        <div><label>Epic</label><input type="number" step="0.01" id="jcRateE" value="${s.rates?.epic ?? 0.04}"></div>
        <div><label>Legend</label><input type="number" step="0.01" id="jcRateL" value="${s.rates?.legend ?? 0.01}"></div>
        <div><label>Especial (ED)</label><input type="number" step="0.01" min="0" max="1" id="jcRateSp" value="${s.specialChance ?? 0.08}" title="Chance de virar edição especial (respeita raridade mínima do especial)"></div>
        <div><label>Label do ciclo</label><input type="text" id="jcCycle" value="${s.cycleLabel || ""}" placeholder="CICLO III"></div>
        <div><label>Temporada</label><input type="text" id="jcSeason" value="${s.seasonId || window.AppState.jet?.currentSeason || ""}"></div>
        <div><label>Slots vitrine</label><input type="number" id="jcSlots" min="3" max="12" value="${s.showcaseSlots ?? 6}"></div>
      </div>
      <div class="admin-actions" style="margin-top:8px">
        <button class="btn-primary btn-sm" onclick="jcAdminSaveConfig()">Salvar config</button>
      </div>
    `;
  } else if (tab === "packs") {
    const packTypes = typeof getPackTypesMap === "function" ? getPackTypesMap() : (window.CARDS.DEFAULT_PACK_TYPES || {});
    const packTypeOpts = Object.entries(packTypes).map(([id, t]) =>
      `<option value="${id}">${t.label || id} · ${t.packSize || 3}c · L${Math.round((t.rates?.legend || 0) * 1000) / 10}% · ED${Math.round((t.specialChance || 0) * 100)}%</option>`
    ).join("");
    body = `
      <h3 class="admin-section-title">Tipos de pack</h3>
      <p class="admin-sub">Cada tipo tem rates, chance de ED e cartas/pack. Códigos e “Dar packs” usam um tipo.</p>
      <div class="admin-form-grid">
        <div><label>ID</label><input type="text" id="jcPtId" placeholder="ex: legend"></div>
        <div><label>Label</label><input type="text" id="jcPtLabel" placeholder="Pack Lendário"></div>
        <div><label>Cartas/pack</label><input type="number" id="jcPtSize" min="1" max="10" value="3"></div>
        <div><label>Common</label><input type="number" step="0.01" id="jcPtC" value="0.70"></div>
        <div><label>Rare</label><input type="number" step="0.01" id="jcPtR" value="0.22"></div>
        <div><label>Epic</label><input type="number" step="0.01" id="jcPtE" value="0.065"></div>
        <div><label>Legend</label><input type="number" step="0.01" id="jcPtL" value="0.015"></div>
        <div><label>Especial (ED)</label><input type="number" step="0.01" min="0" max="1" id="jcPtSp" value="0.06"></div>
      </div>
      <div class="admin-actions" style="margin-top:8px">
        <button class="btn-primary btn-sm" onclick="jcAdminSavePackType()">Salvar tipo</button>
        <button class="btn-gray btn-sm" onclick="jcAdminSeedPackTypes()">Seed tipos padrão</button>
      </div>
      <div class="admin-table-wrap" style="margin-top:10px;max-height:180px;overflow:auto">
        <table class="admin-table">
          <thead><tr><th>ID</th><th>Label</th><th>Size</th><th>Legend</th><th>ED</th><th></th></tr></thead>
          <tbody>
            ${Object.entries(packTypes).map(([id, t]) => `
              <tr>
                <td><code>${id}</code></td>
                <td>${t.label || id}</td>
                <td>${t.packSize || 3}</td>
                <td>${t.rates?.legend ?? "—"}</td>
                <td>${t.specialChance ?? "—"}</td>
                <td><button class="btn-gray btn-sm" onclick="jcAdminDeletePackType('${id}')">Apagar</button></td>
              </tr>
            `).join("") || "<tr><td colspan='6'>—</td></tr>"}
          </tbody>
        </table>
      </div>

      <h3 class="admin-section-title" style="margin-top:22px">Dar packs</h3>
      <p class="admin-sub">Selecione o jogador, o tipo de pack e a quantidade.</p>
      <div class="admin-form-grid">
        <div>
          <label>Jogador</label>
          <select id="jcPackOwner">${humanOpts}</select>
        </div>
        <div>
          <label>Tipo de pack</label>
          <select id="jcPackType">${packTypeOpts || "<option value='standard'>Padrão</option>"}</select>
        </div>
        <div>
          <label>Quantidade</label>
          <input type="number" id="jcPackQty" min="1" max="50" value="1">
        </div>
        <div>
          <label>Label (opcional)</label>
          <input type="text" id="jcPackLabel" placeholder="usa o nome do tipo se vazio">
        </div>
      </div>
      <div class="admin-actions" style="margin-top:8px">
        <button class="btn-primary btn-sm" onclick="jcAdminGrantPack()">Enviar packs</button>
      </div>
    `;
  } else if (tab === "cartas") {
    body = `
      <h3 class="admin-section-title">Edição especial</h3>
      <p class="admin-sub">MVP, Champion, Finals, Commemorative… com arte por URL opcional. Raridade mínima = floor (ex: Epic sai Epic ou Legend). HOLO “Chance normal” sorteia; “Sempre Holo” força.</p>
      <div class="admin-form-grid">
        <div><label>Tipo</label><select id="jcSpEdition">${editionOpts}</select></div>
        <div>
          <label>Agente</label>
          <select id="jcSpPlayer">${playerOpts}</select>
        </div>
        <div><label>Equipe (congelada)</label><input type="text" id="jcSpTeam" placeholder="deixe vazio = equipe atual"></div>
        <div>
          <label>Raridade mínima</label>
          <select id="jcSpRarity">
            <option value="rare">Rare (e acima)</option>
            <option value="epic" selected>Epic (e acima)</option>
            <option value="legend">Legend (só)</option>
          </select>
        </div>
        <div>
          <label>HOLO</label>
          <select id="jcSpFoil">
            <option value="normal">Chance normal</option>
            <option value="holo">Sempre Holo</option>
          </select>
        </div>
        <div><label>Ciclo</label><input type="text" id="jcSpCycle" value="${s.cycleLabel || (typeof cardsCycleLabel==="function"?cardsCycleLabel():"")}"></div>
        <div><label>No pool de packs?</label><select id="jcSpPool"><option value="no">Não</option><option value="yes">Sim</option></select></div>
        <div class="full"><label>Imagem URL</label><input type="url" id="jcSpImg"></div>
        <div class="full"><label>Descrição</label><input type="text" id="jcSpDesc"></div>
      </div>
      <div class="admin-actions" style="margin-top:8px">
        <button class="btn-primary btn-sm" onclick="jcAdminCreateSpecial()">Criar edição especial</button>
      </div>
      <div class="admin-table-wrap" style="margin-top:10px;max-height:180px;overflow:auto">
        <table class="admin-table">
          <thead><tr><th>ID</th><th>Agente</th><th>Edição</th><th>Nº</th><th>Pack</th><th></th></tr></thead>
          <tbody>
            ${specials.map(([id, sp]) => `
              <tr>
                <td><code style="font-size:0.7rem">${id.slice(0,18)}</code></td>
                <td>${sp.playerName || sp.playerKey}</td>
                <td>${sp.edition}</td>
                <td>${sp.number != null ? "JL-" + String(sp.number).padStart(3,"0") : "—"}</td>
                <td>${sp.inPackPool ? "Sim" : "Não"}</td>
                <td><button class="btn-gray btn-sm" onclick="jcAdminDeleteSpecial('${id}')">Remover</button></td>
              </tr>
            `).join("") || "<tr><td colspan='6'>—</td></tr>"}
          </tbody>
        </table>
      </div>

      <h3 class="admin-section-title" style="margin-top:22px">Dar carta direta</h3>
      <p class="admin-sub">Só cartas que já existem no catálogo BASE ou em especiais cadastrados.</p>
      <div class="admin-form-grid">
        <div>
          <label>Jogador</label>
          <select id="jcGrantOwner">${humanOpts}</select>
        </div>
        <div class="full">
          <label>Carta do deck</label>
          <select id="jcGrantDef">${(() => {
            const cat = Object.entries(window.AppState.cards.catalog || {});
            const sp = Object.entries(window.AppState.cards.specials || {});
            const rows = [];
            cat.forEach(([id, c]) => {
              const num = c.number != null ? "JL-" + String(c.number).padStart(3, "0") : "—";
              const name = c.playerName || c.playerKey || id;
              rows.push({ id, kind: "catalog", label: `${num} · ${name} · BASE`, sort: name });
            });
            sp.forEach(([id, c]) => {
              const num = c.number != null ? "JL-" + String(c.number).padStart(3, "0") : "—";
              const name = c.playerName || c.playerKey || id;
              const ed = c.edition || "SPECIAL";
              rows.push({ id, kind: "special", label: `${num} · ${name} · ${ed}`, sort: name });
            });
            rows.sort((a, b) => a.sort.localeCompare(b.sort) || a.label.localeCompare(b.label));
            if (!rows.length) return "<option value=''>Nenhuma carta no deck</option>";
            return rows.map(r => `<option value="${r.kind}|${r.id}">${r.label}</option>`).join("");
          })()}</select>
        </div>
        <div>
          <label>Raridade</label>
          <select id="jcGrantRarity"><option value="legend">Legend</option><option value="epic">Epic</option><option value="rare">Rare</option><option value="common">Common</option></select>
        </div>
        <div><label>Foil</label><select id="jcGrantFoil"><option value="holo">Holo</option><option value="normal">Normal</option></select></div>
      </div>
      <div class="admin-actions" style="margin-top:8px">
        <button class="btn-primary btn-sm" onclick="jcAdminGrantCard()">Dar carta</button>
      </div>

      <h3 class="admin-section-title" style="margin-top:22px">Remover carta da coleção</h3>
      <p class="admin-sub">Quando o jogador vende a carta em outro site — remove da conta e da vitrine.</p>
      <div class="admin-form-grid">
        <div>
          <label>Jogador</label>
          <select id="jcRemoveOwner" onchange="jcAdminLoadPlayerCards()">
            <option value="">— selecione —</option>
            ${humans.map(([id, p]) => `<option value="${id}">${p.displayName || id}</option>`).join("")}
          </select>
        </div>
        <div class="full">
          <label>Carta</label>
          <select id="jcRemoveCard"><option value="">— carregue o jogador —</option></select>
        </div>
      </div>
      <div class="admin-actions" style="margin-top:8px">
        <button class="btn-primary btn-sm" onclick="jcAdminLoadPlayerCards()">Carregar cartas</button>
        <button class="btn-gray btn-sm" style="background:#7f1d1d;border-color:#991b1b" onclick="jcAdminRemoveCard()">Remover carta</button>
      </div>
    `;
  } else if (tab === "codigos") {
    const packTypes = typeof getPackTypesMap === "function" ? getPackTypesMap() : (window.CARDS.DEFAULT_PACK_TYPES || {});
    const packTypeOpts = Object.entries(packTypes).map(([id, t]) =>
      `<option value="${id}">${t.label || id}</option>`
    ).join("");
    body = `
      <h3 class="admin-section-title">Código</h3>
      <div class="admin-form-grid">
        <div>
          <label>Tipo</label>
          <select id="jcCodeType" onchange="jcAdminToggleCodeType()">
            <option value="pack">Pack</option>
            <option value="card">Carta específica</option>
          </select>
        </div>
        <div><label>Código</label><input type="text" id="jcCodeStr" placeholder="auto se vazio"></div>
        <div><label>Label</label><input type="text" id="jcCodeLabel" placeholder="nome da pilha (opcional)"></div>
        <div id="jcCodePackFields" style="grid-column:1/-1">
          <div class="admin-form-grid">
            <div>
              <label>Tipo de pack</label>
              <select id="jcCodePackType">${packTypeOpts || "<option value='standard'>Padrão</option>"}</select>
            </div>
            <div>
              <label>Quantidade</label>
              <input type="number" id="jcCodeQty" min="1" max="50" value="1">
            </div>
          </div>
        </div>
        <div id="jcCodeCardFields" style="display:none;grid-column:1/-1">
          <div class="admin-form-grid">
            <div>
              <label>Agente</label>
              <select id="jcCodePlayer">${playerOpts}</select>
            </div>
            <div><label>Edição</label><select id="jcCodeEdition">${editionOpts}</select></div>
            <div>
              <label>Raridade</label>
              <select id="jcCodeRarity"><option value="rare">Rare</option><option value="epic">Epic</option><option value="legend">Legend</option></select>
            </div>
            <div><label>Foil</label><select id="jcCodeFoil"><option value="normal">Normal</option><option value="holo">Holo</option></select></div>
            <div class="full"><label>Imagem URL</label><input type="url" id="jcCodeImg"></div>
          </div>
        </div>
      </div>
      <div class="admin-actions" style="margin-top:8px">
        <button class="btn-primary btn-sm" onclick="jcAdminCreateCode()">Gerar código</button>
      </div>
      <div class="admin-table-wrap" style="margin-top:10px;max-height:220px;overflow:auto">
        <table class="admin-table">
          <thead><tr><th>Código</th><th>Tipo</th><th>Detalhe</th><th>Label</th><th>Usado</th><th></th></tr></thead>
          <tbody>
            ${codes.map(([id, c]) => {
              let det = "—";
              if ((c.type || "pack") === "pack") {
                det = (c.packTypeId || "standard") + " ×" + (c.quantity || c.qty || 1);
              } else {
                det = (c.playerName || c.playerKey || "?") + " · " + (c.rarity || "");
              }
              return `
              <tr>
                <td><code>${c.code || id}</code></td>
                <td>${c.type || "pack"}</td>
                <td>${det}</td>
                <td>${c.label || "—"}</td>
                <td>${c.used ? "Sim" : "Não"}</td>
                <td><button class="btn-gray btn-sm" onclick="jcAdminDeleteCode('${id}')">Apagar</button></td>
              </tr>`;
            }).join("") || "<tr><td colspan='6'>—</td></tr>"}
          </tbody>
        </table>
      </div>
    `;
  } else if (tab === "vitrines") {
    body = `
      <h3 class="admin-section-title">Ver vitrine do jogador</h3>
      <p class="admin-sub">Escolha um jogador para visualizar a vitrine dele.</p>
      <div class="admin-form-grid">
        <div>
          <label>Jogador</label>
          <select id="jcViewVitrineOwner">${humanOpts}</select>
        </div>
      </div>
      <div class="admin-actions" style="margin-top:8px">
        <button class="btn-primary btn-sm" onclick="jcAdminViewVitrine()">Ver vitrine</button>
      </div>
      <div id="jcAdminVitrinePreview" style="margin-top:12px"></div>

      <h3 class="admin-section-title" style="margin-top:22px">Criar vitrine de personagem / NPC</h3>
      <p class="admin-sub">Crie vitrines extras. Elas aparecem no Hall de colecionadores para todo mundo.</p>
      <div class="admin-form-grid">
        <div><label>Nome</label><input type="text" id="jcNewNpcName" placeholder="Ex: Zico Lendas"></div>
        <div><label>Título</label><input type="text" id="jcNewNpcTitle" placeholder="Ex: Ídolos eternos"></div>
        <div><label>Avatar (emoji)</label><input type="text" id="jcNewNpcAvatar" value="🎴" maxlength="4"></div>
      </div>
      <div class="admin-actions" style="margin-top:8px">
        <button class="btn-primary btn-sm" onclick="jcAdminCreateNpcVitrine()">Criar vitrine</button>
      </div>

      <h3 class="admin-section-title" style="margin-top:22px">Vitrine NPC / Personagem</h3>
      <p class="admin-sub">Adicione cartas (novas ou a partir do inventário de um jogador) e remova uma a uma.</p>
      <div class="admin-form-grid">
        <div>
          <label>Vitrine</label>
          <select id="jcNpcVitrine" onchange="jcAdminRefreshNpcSlots()">${npcVitOpts}</select>
        </div>
        <div>
          <label>Agente</label>
          <select id="jcNpcVitPlayer">${playerOpts}</select>
        </div>
        <div>
          <label>Raridade</label>
          <select id="jcNpcVitRarity">
            <option value="legend">Legend</option>
            <option value="epic">Epic</option>
            <option value="rare">Rare</option>
            <option value="common">Common</option>
          </select>
        </div>
        <div><label>Edição</label><select id="jcNpcVitEdition">${editionOpts}</select></div>
        <div>
          <label>Foil</label>
          <select id="jcNpcVitFoil"><option value="holo">Holo</option><option value="normal">Normal</option></select>
        </div>
        <div class="full"><label>Imagem URL (opcional — senão usa especial/foto do agente)</label><input type="url" id="jcNpcVitImg" placeholder="https://..."></div>
      </div>
      <div class="admin-actions" style="margin-top:8px">
        <button class="btn-primary btn-sm" onclick="jcAdminAddNpcShowcaseCard()">Add carta na vitrine</button>
        <button class="btn-gray btn-sm" onclick="jcAdminClearNpcShowcase()">Limpar vitrine inteira</button>
      </div>

      <h4 style="margin-top:18px;font-size:0.9rem">Copiar carta existente do inventário de um jogador</h4>
      <div class="admin-form-grid">
        <div>
          <label>Jogador dono</label>
          <select id="jcNpcCopyOwner" onchange="jcAdminLoadNpcCopyCards()">${humanOpts}</select>
        </div>
        <div>
          <label>Carta existente</label>
          <select id="jcNpcCopyCard"><option value="">— selecione o jogador —</option></select>
        </div>
      </div>
      <div class="admin-actions" style="margin-top:8px">
        <button class="btn-primary btn-sm" onclick="jcAdminCopyExistingToNpc()">Add carta existente na vitrine NPC</button>
      </div>

      <div id="jcNpcSlotsList" style="margin-top:14px"></div>
    `;
  } else if (tab === "cenas") {
    body = `
      <h3 class="admin-section-title">Cena / oferta NPC</h3>
      <div class="admin-form-grid">
        <div><label>Nome NPC</label><input type="text" id="jcOfferNpc" placeholder="Ex: Luna"></div>
        <div><label>Avatar</label><input type="text" id="jcOfferAvatar" value="🎭" maxlength="4"></div>
        <div class="full"><label>Texto da cena</label><input type="text" id="jcOfferText" placeholder="Diálogo / pitch"></div>
        <div>
          <label>Agente</label>
          <select id="jcOfferPlayer">${playerOpts}</select>
        </div>
        <div><label>Edição</label><select id="jcOfferEdition">${editionOpts}</select></div>
        <div>
          <label>Raridade</label>
          <select id="jcOfferRarity"><option value="epic">Epic</option><option value="legend">Legend</option><option value="rare">Rare</option></select>
        </div>
        <div><label>Foil</label><select id="jcOfferFoil"><option value="holo">Holo</option><option value="normal">Normal</option></select></div>
        <div>
          <label>Dono (opcional)</label>
          <select id="jcOfferOwner"><option value="">Qualquer um</option>${humanOpts}</select>
        </div>
        <div class="full"><label>Imagem URL</label><input type="url" id="jcOfferImg"></div>
      </div>
      <div class="admin-actions" style="margin-top:8px">
        <button class="btn-primary btn-sm" onclick="jcAdminCreateOffer()">Publicar cena</button>
      </div>
      <div class="admin-table-wrap" style="margin-top:10px;max-height:200px;overflow:auto">
        <table class="admin-table">
          <thead><tr><th>NPC</th><th>Agente</th><th>Raridade</th><th></th></tr></thead>
          <tbody>
            ${offers.map(([id, o]) => `
              <tr>
                <td>${o.npcAvatar || ""} ${o.npcName || "NPC"}</td>
                <td>${o.playerName || o.playerKey || "—"}</td>
                <td>${o.rarity || "—"}</td>
                <td><button class="btn-gray btn-sm" onclick="window.marketDb.ref('cards/offers/${id}').remove().then(()=>renderCardsAdmin())">Remover</button></td>
              </tr>
            `).join("") || "<tr><td colspan='4'>—</td></tr>"}
          </tbody>
        </table>
      </div>
    `;
  } else if (tab === "jogadores") {
    body = `
      <h3 class="admin-section-title">Cadastrar jogador (nick / código)</h3>
      <p class="admin-sub">Cria conta humana no Fantasy + Cards. Use o código pra logar em Jet Cards e fingir ser o jogador em tempo real.</p>
      <div class="admin-form-grid">
        <div><label>Nick</label><input type="text" id="jcNewNick" placeholder="Ex: Richa"></div>
        <div><label>Nome do time</label><input type="text" id="jcNewTeam" placeholder="Ex: Dark Side"></div>
        <div><label>Código de convite</label><input type="text" id="jcNewCode" placeholder="Ex: JET-RICHA (auto se vazio)"></div>
      </div>
      <div class="admin-actions" style="margin-top:8px">
        <button class="btn-primary btn-sm" onclick="jcAdminAddHuman()">Cadastrar jogador</button>
      </div>
      <div class="admin-table-wrap" style="margin-top:12px">
        <table class="admin-table">
          <thead><tr><th>Nick</th><th>Time</th><th>Código</th><th>ID</th></tr></thead>
          <tbody>
            ${humans.map(([id, p]) => `
              <tr>
                <td>${p.displayName || "—"}</td>
                <td>${p.teamName || "—"}</td>
                <td><code>${p.inviteCode || "—"}</code></td>
                <td><code style="font-size:0.7rem">${id}</code></td>
              </tr>
            `).join("") || "<tr><td colspan='4'>Nenhum humano ainda</td></tr>"}
          </tbody>
        </table>
      </div>
    `;
  }

  el.innerHTML = `
    <h3 class="admin-section-title">Jet Cards 2.0</h3>
    <div class="admin-subtabs" style="display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 16px">
      ${tabs.map(([id, label]) =>
        `<button class="btn-sm ${tab===id?"btn-primary":"btn-gray"}" onclick="renderCardsAdmin('${id}')">${label}</button>`
      ).join("")}
    </div>
    <div class="jc-admin-tab-body">${body}</div>
  `;
  if (tab === "vitrines" && typeof jcAdminRefreshNpcSlots === "function") {
    setTimeout(() => jcAdminRefreshNpcSlots(), 0);
  }
}

function jcAdminToggleCodeType() {
  const t = document.getElementById("jcCodeType")?.value;
  const cardBox = document.getElementById("jcCodeCardFields");
  const packBox = document.getElementById("jcCodePackFields");
  if (cardBox) cardBox.style.display = t === "card" ? "block" : "none";
  if (packBox) packBox.style.display = t === "pack" || !t ? "block" : "none";
}

async function jcAdminSeed() {
  await ensureCardsSeeded();
  const n = await syncCardsCatalog();
  alert("Catálogo sincronizado (+" + n + " novas BASE)");
  renderCardsAdmin(window._jcAdminTab || "config");
}

async function jcAdminSaveConfig() {
  const spRaw = Number(document.getElementById("jcRateSp")?.value);
  const specialChance = Number.isFinite(spRaw) ? Math.max(0, Math.min(1, spRaw)) : 0.08;
  await saveCardsSettings({
    packSize: Number(document.getElementById("jcPackSize")?.value) || 3,
    rates: {
      common: Number(document.getElementById("jcRateC")?.value) || 0.7,
      rare: Number(document.getElementById("jcRateR")?.value) || 0.22,
      epic: Number(document.getElementById("jcRateE")?.value) || 0.065,
      legend: Number(document.getElementById("jcRateL")?.value) || 0.015
    },
    specialChance,
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
  if (type === "pack" || !type) {
    payload.packTypeId = document.getElementById("jcCodePackType")?.value || "standard";
    payload.quantity = Math.max(1, Math.min(50, parseInt(document.getElementById("jcCodeQty")?.value || "1", 10) || 1));
  }
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
  const extra = type === "pack" ? ` · ${payload.packTypeId} ×${payload.quantity}` : "";
  alert("Código: " + code + extra);
  renderCardsAdmin();
}

async function jcAdminDeleteCode(id) {
  if (!confirm("Apagar?")) return;
  await window.marketDb.ref("cards/codes/" + id).remove();
  renderCardsAdmin();
}

async function jcAdminGrantPack() {
  const ownerId = document.getElementById("jcPackOwner")?.value;
  const qty = Math.max(1, Math.min(50, parseInt(document.getElementById("jcPackQty")?.value || "1", 10) || 1));
  const packTypeId = document.getElementById("jcPackType")?.value || "standard";
  const customLabel = (document.getElementById("jcPackLabel")?.value || "").trim();
  if (!ownerId) return alert("Selecione um jogador");
  const humans = Object.entries(window.AppState.fantasy?.participants || {}).filter(([, p]) => p && p.type !== "npc");
  const target = humans.find(([id]) => id === ownerId);
  const name = target?.[1]?.displayName || ownerId;
  const pt = typeof resolvePackType === "function" ? resolvePackType(packTypeId) : null;
  const label = customLabel || pt?.label || "Pack Admin";

  const updates = {};
  if (typeof applyStackedPackGains === "function") {
    applyStackedPackGains(ownerId, qty, { label, source: "admin", packTypeId }, updates);
  } else {
    const now = new Date().toISOString();
    const packId = "pack_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
    updates["cards/packs/" + packId] = {
      ownerId, status: "sealed", label, source: "admin", packTypeId, grantedAt: now, count: qty
    };
  }
  await window.marketDb.ref().update(updates);
  alert(`${qty}× ${label} → ${name}`);
  renderCardsAdmin();
}

async function jcAdminSavePackType() {
  let id = (document.getElementById("jcPtId")?.value || "").trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_");
  if (!id) return alert("ID obrigatório (ex: legend)");
  const label = (document.getElementById("jcPtLabel")?.value || "").trim() || id;
  const packSize = Math.max(1, Math.min(10, parseInt(document.getElementById("jcPtSize")?.value || "3", 10) || 3));
  const rates = {
    common: Number(document.getElementById("jcPtC")?.value) || 0,
    rare: Number(document.getElementById("jcPtR")?.value) || 0,
    epic: Number(document.getElementById("jcPtE")?.value) || 0,
    legend: Number(document.getElementById("jcPtL")?.value) || 0
  };
  const spRaw = Number(document.getElementById("jcPtSp")?.value);
  const specialChance = Number.isFinite(spRaw) ? Math.max(0, Math.min(1, spRaw)) : 0.06;
  await window.marketDb.ref("cards/packTypes/" + id).set({
    id, label, packSize, rates, specialChance, updatedAt: new Date().toISOString()
  });
  alert("Tipo salvo: " + label);
  renderCardsAdmin("packs");
}

async function jcAdminDeletePackType(id) {
  if (!id || id === "standard") {
    if (id === "standard" && !confirm("Apagar o tipo standard? Packs sem tipo caem nas rates globais.")) return;
  }
  if (!confirm("Apagar tipo " + id + "?")) return;
  await window.marketDb.ref("cards/packTypes/" + id).remove();
  renderCardsAdmin("packs");
}

async function jcAdminSeedPackTypes() {
  const defaults = window.CARDS.DEFAULT_PACK_TYPES || {};
  const updates = {};
  Object.entries(defaults).forEach(([id, t]) => {
    updates["cards/packTypes/" + id] = { ...t, id };
  });
  await window.marketDb.ref().update(updates);
  alert("Tipos padrão gravados no Firebase");
  renderCardsAdmin("packs");
}

function jcAdminViewVitrine() {
  const ownerId = document.getElementById("jcViewVitrineOwner")?.value;
  const box = document.getElementById("jcAdminVitrinePreview");
  if (!box) return;
  if (!ownerId) {
    box.innerHTML = "<p class='admin-sub'>Selecione um jogador.</p>";
    return;
  }
  const humans = Object.entries(window.AppState.fantasy?.participants || {}).filter(([, p]) => p && p.type !== "npc");
  const target = humans.find(([id]) => id === ownerId);
  const name = target?.[1]?.displayName || ownerId;
  const sc = (window.AppState.cards.showcases || {})[ownerId];
  const slots = sc?.slots || [];
  const inv = (window.AppState.cards.inventory || {})[ownerId] || {};
  const byId = {};
  Object.entries(inv).forEach(([cid, c]) => { byId[cid] = { ...c, cardId: cid }; });

  const cardsHtml = slots.filter(Boolean).map(id => {
    const c = byId[id];
    if (!c) return `<div class="jc-slot-empty" style="padding:8px;border:1px dashed #666;border-radius:8px;font-size:12px">Carta ausente</div>`;
    if (typeof collectibleCardHTML === "function") {
      return collectibleCardHTML(c, { small: true });
    }
    return `<div style="padding:6px 10px;background:#1a1a2e;border-radius:8px;font-size:12px">${c.playerName || c.playerKey} · ${c.rarity || "?"}</div>`;
  }).join("") || "<p class='admin-sub'>Vitrine vazia ou ainda não configurada.</p>";

  box.innerHTML = `
    <div style="border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:14px;background:rgba(0,0,0,0.25)">
      <div style="font-weight:600;margin-bottom:10px">Vitrine de ${name}</div>
      <div class="jc-showcase-row" style="display:flex;flex-wrap:wrap;gap:10px">
        ${cardsHtml}
      </div>
      <p class="admin-sub" style="margin-top:10px;margin-bottom:0">Slots: ${slots.filter(Boolean).length} / ${(sc?.slots?.length || cardsSettings().showcaseSlots || 6)}</p>
    </div>
  `;
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
  const raw = document.getElementById("jcGrantDef")?.value || "";
  if (!ownerId || !raw || !raw.includes("|")) return alert("Selecione jogador e uma carta do deck");
  const [kind, defId] = raw.split("|");
  const fromCat = kind === "catalog" ? (window.AppState.cards.catalog || {})[defId] : null;
  const fromSp = kind === "special" ? (window.AppState.cards.specials || {})[defId] : null;
  const def = fromCat || fromSp;
  if (!def) return alert("Carta não encontrada no deck");

  // Garante inventário do dono em memória
  if (!(window.AppState.cards.inventory || {})[ownerId] && typeof cardsFetchInventoryOnce === "function") {
    await cardsFetchInventoryOnce(ownerId);
  }
  const updates = {};
  applyStackedCardGains(ownerId, [{
    defId: def.defId || defId,
    playerKey: def.playerKey,
    playerName: def.playerName,
    team: def.team,
    rank: def.rank,
    edition: def.edition || (kind === "catalog" ? "BASE" : "SPECIAL"),
    number: def.number != null ? def.number : null,
    rarity: document.getElementById("jcGrantRarity")?.value || "legend",
    foil: document.getElementById("jcGrantFoil")?.value || "holo",
    specialImageUrl: def.specialImageUrl || null,
    description: def.description || "",
    source: "admin"
  }], updates);
  await window.marketDb.ref().update(updates);
  const label = (def.playerName || def.playerKey) + " · " + (def.edition || "BASE");
  alert("Carta concedida (empilhada): " + label);
  renderCardsAdmin();
}

async function jcAdminAddNpcShowcaseCard() {
  const vid = document.getElementById("jcNpcVitrine")?.value;
  const sel = document.getElementById("jcNpcVitPlayer");
  const opt = sel?.selectedOptions?.[0];
  if (!vid || !opt?.value) return alert("Selecione vitrine e agente");
  const snap = await window.marketDb.ref("cards/showcases/" + vid).once("value");
  const cur = snap.val() || { type: "npc", slots: [] };
  const slots = Array.isArray(cur.slots) ? cur.slots.slice() : [];
  const edition = document.getElementById("jcNpcVitEdition")?.value || "BASE";
  const rarity = document.getElementById("jcNpcVitRarity")?.value || "legend";
  const foil = document.getElementById("jcNpcVitFoil")?.value || "holo";
  const img = (document.getElementById("jcNpcVitImg")?.value || "").trim() || null;
  const partial = {
    playerKey: opt.value,
    playerName: opt.dataset.name,
    team: opt.dataset.team,
    rank: opt.dataset.rank,
    edition,
    rarity,
    foil,
    specialImageUrl: img,
    source: "npc_showcase"
  };
  // Puxa número JL + arte especial do catálogo/specials quando existir
  const resolved = typeof resolveCardDef === "function" ? resolveCardDef(partial) : partial;
  const record = buildCardRecord({
    ...partial,
    number: resolved.number,
    cardNumber: resolved.cardNumber,
    specialImageUrl: img || resolved.specialImageUrl || null,
    rank: resolved.rank || partial.rank
  });
  slots.push(record);
  const meta = (window.CARDS.NPC_VITRINES || []).find(n => n.id === vid) || {};
  await window.marketDb.ref("cards/showcases/" + vid).set({
    type: "npc",
    name: cur.name || meta.name || "NPC",
    title: cur.title || meta.title || "",
    avatar: cur.avatar || meta.avatar || "🎴",
    slots
  });
  alert("Carta adicionada na vitrine");
  jcAdminRefreshNpcSlots();
}

async function jcAdminClearNpcShowcase() {
  const vid = document.getElementById("jcNpcVitrine")?.value;
  if (!vid || !confirm("Limpar toda a vitrine NPC?")) return;
  await window.marketDb.ref("cards/showcases/" + vid + "/slots").set([]);
  jcAdminRefreshNpcSlots();
}

function jcAdminRefreshNpcSlots() {
  const box = document.getElementById("jcNpcSlotsList");
  const vid = document.getElementById("jcNpcVitrine")?.value;
  if (!box) return;
  if (!vid) {
    box.innerHTML = "";
    return;
  }
  const sc = (window.AppState.cards.showcases || {})[vid] || {};
  const slots = Array.isArray(sc.slots) ? sc.slots : [];
  if (!slots.length) {
    box.innerHTML = `<p class="admin-sub" style="margin:0">Vitrine vazia · ${sc.name || vid}</p>`;
    return;
  }
  box.innerHTML = `
    <p class="admin-sub" style="margin:0 0 8px"><strong>${sc.name || vid}</strong> · ${slots.length} carta(s) · clique em Remover para tirar só uma</p>
    <div class="admin-table-wrap" style="max-height:240px;overflow:auto">
      <table class="admin-table">
        <thead><tr><th>#</th><th>Agente</th><th>Edição</th><th>Raridade</th><th>Foil</th><th></th></tr></thead>
        <tbody>
          ${slots.map((c, i) => {
            if (!c || typeof c !== "object") return `<tr><td>${i + 1}</td><td colspan="4">slot inválido</td><td><button class="btn-gray btn-sm" onclick="jcAdminRemoveNpcSlot(${i})">Remover</button></td></tr>`;
            return `<tr>
              <td>${i + 1}</td>
              <td>${c.playerName || c.playerKey || "—"}</td>
              <td>${c.edition || "BASE"}</td>
              <td>${c.rarity || "—"}</td>
              <td>${c.foil || "normal"}</td>
              <td><button class="btn-gray btn-sm" onclick="jcAdminRemoveNpcSlot(${i})">Remover</button></td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

async function jcAdminRemoveNpcSlot(index) {
  const vid = document.getElementById("jcNpcVitrine")?.value;
  if (!vid) return;
  const snap = await window.marketDb.ref("cards/showcases/" + vid).once("value");
  const cur = snap.val() || {};
  const slots = Array.isArray(cur.slots) ? cur.slots.slice() : [];
  if (index < 0 || index >= slots.length) return;
  const label = slots[index]?.playerName || slots[index]?.playerKey || ("#" + (index + 1));
  if (!confirm(`Remover "${label}" desta vitrine NPC?`)) return;
  slots.splice(index, 1);
  await window.marketDb.ref("cards/showcases/" + vid + "/slots").set(slots);
  jcAdminRefreshNpcSlots();
}

function jcAdminLoadNpcCopyCards() {
  const ownerId = document.getElementById("jcNpcCopyOwner")?.value;
  const sel = document.getElementById("jcNpcCopyCard");
  if (!sel) return;
  if (!ownerId) {
    sel.innerHTML = "<option value=''>— selecione o jogador —</option>";
    return;
  }
  // Garante inventário em memória
  if (!(window.AppState.cards.inventory || {})[ownerId] && typeof cardsFetchInventoryOnce === "function") {
    cardsFetchInventoryOnce(ownerId).then(() => jcAdminLoadNpcCopyCards());
  }
  const inv = (window.AppState.cards.inventory || {})[ownerId] || {};
  const entries = Object.entries(inv);
  if (!entries.length) {
    sel.innerHTML = "<option value=''>Nenhuma carta na coleção</option>";
    return;
  }
  const rarityOrder = { legend: 0, epic: 1, rare: 2, common: 3 };
  entries.sort((a, b) => {
    const ra = rarityOrder[a[1].rarity] ?? 9;
    const rb = rarityOrder[b[1].rarity] ?? 9;
    return ra - rb || (a[1].playerName || "").localeCompare(b[1].playerName || "");
  });
  sel.innerHTML = entries.map(([cid, c]) => {
    const n = Math.max(1, Number(c.count) || 1);
    const label = `${c.playerName || c.playerKey} · ${c.rarity || "?"} · ${(c.edition || "BASE")} · ${c.foil || "normal"}${n > 1 ? " · ×" + n : ""}`;
    return `<option value="${cid}">${label}</option>`;
  }).join("");
}

async function jcAdminCopyExistingToNpc() {
  const vid = document.getElementById("jcNpcVitrine")?.value;
  const ownerId = document.getElementById("jcNpcCopyOwner")?.value;
  const cardId = document.getElementById("jcNpcCopyCard")?.value;
  if (!vid || !ownerId || !cardId) return alert("Selecione vitrine, jogador e carta");
  const inv = (window.AppState.cards.inventory || {})[ownerId] || {};
  const card = inv[cardId];
  if (!card) return alert("Carta não encontrada no inventário");
  const snap = await window.marketDb.ref("cards/showcases/" + vid).once("value");
  const cur = snap.val() || { type: "npc", slots: [] };
  const slots = Array.isArray(cur.slots) ? cur.slots.slice() : [];
  // Cópia para a vitrine NPC (não remove do jogador)
  const copy = {
    ...card,
    cardId: cardId,
    source: "npc_showcase_copy",
    copiedFrom: ownerId
  };
  slots.push(copy);
  const meta = (window.CARDS.NPC_VITRINES || []).find(n => n.id === vid) || {};
  await window.marketDb.ref("cards/showcases/" + vid).set({
    type: "npc",
    name: cur.name || meta.name || "NPC",
    title: cur.title || meta.title || "",
    avatar: cur.avatar || meta.avatar || "🎴",
    slots
  });
  alert("Carta existente copiada para a vitrine NPC");
  jcAdminRefreshNpcSlots();
}

async function jcAdminCreateNpcVitrine() {
  const name = (document.getElementById("jcNewNpcName")?.value || "").trim();
  if (!name) return alert("Digite um nome para a vitrine");
  const title = (document.getElementById("jcNewNpcTitle")?.value || "").trim();
  const avatar = (document.getElementById("jcNewNpcAvatar")?.value || "🎴").trim() || "🎴";
  const id = "npc_showcase_" + name.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 32) + "_" + Date.now().toString(36).slice(-4);
  await window.marketDb.ref("cards/showcases/" + id).set({
    type: "npc",
    name,
    title,
    avatar,
    slots: [],
    createdAt: new Date().toISOString()
  });
  alert("Vitrine criada: " + name);
  renderCardsAdmin();
}

function jcAdminLoadPlayerCards() {
  const ownerId = document.getElementById("jcRemoveOwner")?.value;
  const sel = document.getElementById("jcRemoveCard");
  if (!sel) return;
  if (!ownerId) {
    sel.innerHTML = "<option value=''>— selecione o jogador —</option>";
    return;
  }
  const inv = (window.AppState.cards.inventory || {})[ownerId] || {};
  const entries = Object.entries(inv);
  if (!entries.length) {
    sel.innerHTML = "<option value=''>Nenhuma carta na coleção</option>";
    return;
  }
  const rarityOrder = { legend: 0, epic: 1, rare: 2, common: 3 };
  entries.sort((a, b) => {
    const ra = rarityOrder[a[1].rarity] ?? 9;
    const rb = rarityOrder[b[1].rarity] ?? 9;
    return ra - rb || (a[1].playerName || "").localeCompare(b[1].playerName || "");
  });
  sel.innerHTML = entries.map(([cid, c]) => {
    const n = Math.max(1, Number(c.count) || 1);
    const label = `${c.playerName || c.playerKey} · ${c.rarity || "?"} · ${(c.edition || "BASE")} · ${c.foil || "normal"}${n > 1 ? " · ×" + n : ""}`;
    return `<option value="${cid}">${label}</option>`;
  }).join("");
}

async function jcAdminRemoveCard() {
  const ownerId = document.getElementById("jcRemoveOwner")?.value;
  const cardId = document.getElementById("jcRemoveCard")?.value;
  if (!ownerId || !cardId) return alert("Selecione jogador e carta");
  if (!(window.AppState.cards.inventory || {})[ownerId] && typeof cardsFetchInventoryOnce === "function") {
    await cardsFetchInventoryOnce(ownerId);
  }
  const inv = (window.AppState.cards.inventory || {})[ownerId] || {};
  const card = inv[cardId];
  if (!card) return alert("Carta não encontrada");
  const cnt = Math.max(1, Number(card.count) || 1);
  const label = `${card.playerName || card.playerKey} (${card.rarity || "?"}) ×${cnt}`;
  if (!confirm(`Remover 1× de "${label}" da coleção deste jogador?`)) return;

  if (cnt > 1) {
    await window.marketDb.ref("cards/inventory/" + ownerId + "/" + cardId).update({
      count: cnt - 1,
      stacked: true
    });
  } else {
    await window.marketDb.ref("cards/inventory/" + ownerId + "/" + cardId).remove();
    const sc = (window.AppState.cards.showcases || {})[ownerId];
    if (sc && Array.isArray(sc.slots) && sc.slots.includes(cardId)) {
      const newSlots = sc.slots.map(s => s === cardId ? null : s);
      await window.marketDb.ref("cards/showcases/" + ownerId + "/slots").set(newSlots);
    }
  }

  alert("Removido 1×: " + label);
  // refresh local cache
  if (typeof cardsFetchInventoryOnce === "function") {
    const all = window.AppState.cards.inventory || {};
    delete all[ownerId];
    await cardsFetchInventoryOnce(ownerId);
  }
  jcAdminLoadPlayerCards();
}

async function jcAdminPurgeOpenedPacks() {
  if (!confirm("Apagar apenas packs com status OPENED?\nAs cartas no inventário NÃO serão apagadas.")) return;
  const n = await cardsPurgeOpenedPacks();
  alert(n ? `${n} pack(s) aberto(s) removido(s).` : "Nenhum pack aberto encontrado.");
}

async function jcAdminConsolidateInventories() {
  if (!confirm("Empilhar inventários de todos os jogadores?\nJunta cópias iguais em uma pilha (count). Total de cartas se mantém.")) return;
  const snap = await window.marketDb.ref("cards/inventory").once("value");
  const all = snap.val() || {};
  let totalStacks = 0, totalRemoved = 0;
  for (const ownerId of Object.keys(all)) {
    const r = await consolidateOwnerInventory(ownerId);
    totalStacks += r.stacks || 0;
    totalRemoved += r.removed || 0;
  }
  alert(`Consolidado.\nPilhas: ${totalStacks}\nRegistros soltos removidos: ${totalRemoved}\n(Quantidade total de cartas preservada.)`);
}

async function jcAdminAddHuman() {
  const nick = document.getElementById("jcNewNick")?.value?.trim();
  const team = document.getElementById("jcNewTeam")?.value?.trim() || (nick ? nick + " FC" : "");
  let code = document.getElementById("jcNewCode")?.value?.trim();
  if (!nick) return alert("Informe o nick");
  if (!code) code = "JET-" + nick.toUpperCase().replace(/\s+/g, "").slice(0, 10);

  // evita código duplicado
  const parts = window.AppState.fantasy?.participants || {};
  const dup = Object.values(parts).find(p => p && (p.inviteCode || "").toUpperCase() === code.toUpperCase());
  if (dup) return alert("Código já existe: " + code + " (nick: " + (dup.displayName || "?") + ")");

  const id = "human_" + Date.now();
  const budget = (typeof fantasySettings === "function" ? fantasySettings().budgetInitial : null) || 5000000;
  const payload = {
    type: "human",
    displayName: nick,
    teamName: team,
    inviteCode: code,
    active: true,
    budgetRemaining: budget,
    squad: typeof emptySquad === "function" ? emptySquad() : { starters: [null, null, null, null, null], bench: null },
    acquisitions: {},
    strategy: null,
    createdAt: new Date().toISOString()
  };

  try {
    if (typeof saveFantasyParticipant === "function") {
      await saveFantasyParticipant(id, payload);
    } else {
      await window.marketDb.ref("fantasy/participants/" + id).set(payload);
    }
    // espelha no estado local se o listener atrasar
    if (!window.AppState.fantasy) window.AppState.fantasy = {};
    if (!window.AppState.fantasy.participants) window.AppState.fantasy.participants = {};
    window.AppState.fantasy.participants[id] = payload;
    alert("Cadastrado! Nick: " + nick + " · Código: " + code);
    renderCardsAdmin("jogadores");
  } catch (err) {
    console.error("jcAdminAddHuman", err);
    alert("Erro ao cadastrar: " + (err?.message || err) + "\n\nConfira se você está logado como admin (auth com e-mail).");
  }
}

window.renderCardsAdmin = renderCardsAdmin;
window.jcAdminSeed = jcAdminSeed;
window.jcAdminSaveConfig = jcAdminSaveConfig;
window.jcAdminCreateSpecial = jcAdminCreateSpecial;
window.jcAdminDeleteSpecial = jcAdminDeleteSpecial;
window.jcAdminCreateCode = jcAdminCreateCode;
window.jcAdminDeleteCode = jcAdminDeleteCode;
window.jcAdminGrantPack = jcAdminGrantPack;
window.jcAdminSavePackType = jcAdminSavePackType;
window.jcAdminDeletePackType = jcAdminDeletePackType;
window.jcAdminSeedPackTypes = jcAdminSeedPackTypes;
window.jcAdminViewVitrine = jcAdminViewVitrine;
window.jcAdminCreateOffer = jcAdminCreateOffer;
window.jcAdminGrantCard = jcAdminGrantCard;
window.jcAdminAddNpcShowcaseCard = jcAdminAddNpcShowcaseCard;
window.jcAdminClearNpcShowcase = jcAdminClearNpcShowcase;
window.jcAdminRefreshNpcSlots = jcAdminRefreshNpcSlots;
window.jcAdminRemoveNpcSlot = jcAdminRemoveNpcSlot;
window.jcAdminLoadNpcCopyCards = jcAdminLoadNpcCopyCards;
window.jcAdminCopyExistingToNpc = jcAdminCopyExistingToNpc;
window.jcAdminCreateNpcVitrine = jcAdminCreateNpcVitrine;
window.jcAdminLoadPlayerCards = jcAdminLoadPlayerCards;
window.jcAdminRemoveCard = jcAdminRemoveCard;
window.jcAdminAddHuman = jcAdminAddHuman;
window.jcAdminToggleCodeType = jcAdminToggleCodeType;
window.jcAdminPurgeOpenedPacks = jcAdminPurgeOpenedPacks;
window.jcAdminConsolidateInventories = jcAdminConsolidateInventories;
