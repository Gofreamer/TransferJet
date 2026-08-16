/* Jet Cards 2.0 — trading card visual */
function cardsArtUrl(card) {
  if (card.specialImageUrl) return card.specialImageUrl;
  const map = typeof fantasyPlayerMap === "function" ? fantasyPlayerMap() : {};
  let player = map[card.playerKey];
  if (!player && typeof getAllPlayersFlat === "function") {
    player = getAllPlayersFlat().find(p => p.key === card.playerKey);
  }
  if (player && typeof getPlayerPhoto === "function") return getPlayerPhoto(player);
  return "";
}

function cardsTeamCrest(team) {
  // crest opcional se o app tiver helper; senão inicial do time
  if (typeof getTeamCrest === "function") return getTeamCrest(team);
  if (typeof getClubLogo === "function") return getClubLogo(team);
  return null;
}

/**
 * @param {object} card
 * @param {object} opts locked | small | selected | onclick | showCount | count
 */
function collectibleCardHTML(card, opts = {}) {
  if (opts.locked) {
    const num = card.cardNumber || (card.number != null ? formatCardNumber(card.number) : "JL-???");
    const rarity = (card.rarity || "legend").toLowerCase();
    return `
      <div class="tc-card locked rarity-${rarity}" ${opts.onclick ? `onclick="${opts.onclick}"` : ""}>
        <div class="tc-frame">
          <div class="tc-top"><span class="tc-num">${num}</span><span class="tc-rare">???</span></div>
          <div class="tc-art locked-art"><span class="tc-silhouette">?</span></div>
          <div class="tc-bottom">
            <div class="tc-name">???</div>
            <div class="tc-sub">Não descoberta</div>
          </div>
        </div>
      </div>
    `;
  }

  const resolved = typeof resolveCardDef === "function" ? resolveCardDef(card) : card;
  const rarity = (card.rarity || "common").toLowerCase();
  const foil = card.foil === "holo" ? "holo" : "";
  const edition = (card.edition || resolved.edition || "BASE").toUpperCase();
  const editionLabel = edition === "BASE" ? "" : (window.CARDS.EDITIONS[edition]?.label || edition);
  const name = card.customName || resolved.playerName || card.playerName || "—";
  const team = resolved.team || card.team || "—";
  const rank = resolved.rank || card.rank || "—";
  const cycle = resolved.cycle || card.cycle || cardsCycleLabel();
  const num = card.cardNumber || resolved.cardNumber || (card.number != null ? formatCardNumber(card.number) : "JL-???");
  const rareLabel = (window.CARDS.RARITY[rarity] || {}).label || rarity.toUpperCase();
  const art = cardsArtUrl({ ...card, specialImageUrl: card.specialImageUrl || resolved.specialImageUrl });
  const initials = (name || "?").slice(0, 2).toUpperCase();
  const crest = cardsTeamCrest(team);
  const countBadge = opts.showCount && opts.count > 1
    ? `<div class="tc-count">×${opts.count}</div>`
    : "";

  // tilt em todas (inclui small/vitrine) — mobile + desktop
  const tiltClass = !opts.locked ? "tc-tilt" : "";

  return `
    <div class="tc-card rarity-${rarity} ${foil} ${opts.small ? "small" : ""} ${opts.selected ? "selected" : ""} ed-${edition.toLowerCase()} ${tiltClass}"
         data-card-id="${card.cardId || ""}" data-def-id="${card.defId || resolved.defId || ""}"
         data-rarity="${rarity}"
         ${opts.onclick ? `onclick="${opts.onclick}"` : ""}>
      <div class="tc-frame">
        <div class="tc-shine"></div>
        ${foil ? `<div class="tc-holo-overlay"></div>` : ""}
        <div class="tc-glare"></div>
        <div class="tc-top">
          <span class="tc-num">${num}</span>
          <span class="tc-rare">${rareLabel}${foil ? " · HOLO" : ""}</span>
        </div>
        ${editionLabel ? `<div class="tc-edition ed-badge-${edition.toLowerCase()}">${editionLabel}</div>` : ""}
        <div class="tc-art">
          ${art
            ? `<img src="${art}" alt="" loading="lazy" onerror="this.parentElement.innerHTML='<span class=tc-initials>${initials}</span>'"/>`
            : `<span class="tc-initials">${initials}</span>`}
        </div>
        <div class="tc-bottom">
          <div class="tc-name-row">
            ${crest ? `<img class="tc-crest" src="${crest}" alt="" onerror="this.style.display='none'"/>` : ""}
            <div class="tc-name">${name}</div>
          </div>
          <div class="tc-sub">${team}</div>
          <div class="tc-meta"><span>${rank}</span><span>${cycle}</span></div>
        </div>
        ${countBadge}
      </div>
    </div>
  `;
}

/** Liga tilt 3D nas cartas .tc-tilt — mouse + touch (mobile). Só visual. */
function cardsBindTilt(root) {
  const scope = root || document;
  scope.querySelectorAll(".tc-card.tc-tilt").forEach(card => {
    if (card.dataset.tiltBound === "1") return;
    card.dataset.tiltBound = "1";
    const frame = card.querySelector(".tc-frame");
    const glare = card.querySelector(".tc-glare");
    if (!frame) return;

    const isSmall = card.classList.contains("small");
    let max = card.classList.contains("rarity-legend") ? 14
      : card.classList.contains("rarity-epic") ? 11
      : 8;
    if (isSmall) max = Math.max(6, max - 4);

    const onMove = (clientX, clientY) => {
      const rect = card.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const px = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const py = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
      const rx = (0.5 - py) * max;
      const ry = (px - 0.5) * max;
      frame.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) scale(1.03)`;
      if (glare) {
        glare.style.opacity = "0.6";
        glare.style.background = `radial-gradient(circle at ${px * 100}% ${py * 100}%, rgba(255,255,255,0.5), transparent 55%)`;
      }
    };
    const reset = () => {
      frame.style.transform = "";
      if (glare) glare.style.opacity = "0";
    };

    // pointer capture = funciona no celular (touch) e desktop
    card.addEventListener("pointerdown", e => {
      try { card.setPointerCapture(e.pointerId); } catch (_) {}
      onMove(e.clientX, e.clientY);
    });
    card.addEventListener("pointermove", e => {
      if (e.pointerType === "mouse" || card.hasPointerCapture?.(e.pointerId)) {
        onMove(e.clientX, e.clientY);
      }
    });
    card.addEventListener("pointerup", reset);
    card.addEventListener("pointerleave", reset);
    card.addEventListener("pointercancel", reset);
    // fallback touch explícito
    card.addEventListener("touchmove", e => {
      if (!e.touches?.[0]) return;
      onMove(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    card.addEventListener("touchend", reset);
    card.addEventListener("touchcancel", reset);
  });
}

function packCardBackHTML(rarityHint) {
  const r = rarityHint ? `hint-${rarityHint}` : "";
  return `<div class="tc-card tc-back ${r}"><div class="tc-frame"><div class="tc-back-logo">JL</div><div class="tc-back-sub">JET CARDS</div></div></div>`;
}

window.collectibleCardHTML = collectibleCardHTML;
window.packCardBackHTML = packCardBackHTML;
window.cardsArtUrl = cardsArtUrl;
window.cardsBindTilt = cardsBindTilt;
