/* Jet Fantasy — cartas visuais */
function fantasyCardHTML(p, opts = {}) {
  if (!p) {
    return `<div class="fx-card fx-card-empty">${opts.emptyLabel || "Slot vazio"}</div>`;
  }
  const fantasyPrice = p.fantasyPrice ?? (typeof playerPrice === "function" ? playerPrice(p.key) : Number(p.marketValue || 0));
  const price = fantasyPrice ? (typeof formatUSD === "function" ? formatUSD(fantasyPrice, true) : fantasyPrice) : "—";
  const officialPrice = p.marketValue ? (typeof formatUSD === "function" ? formatUSD(p.marketValue, true) : p.marketValue) : "—";
  const wr = p.stats?.P ? Math.round((p.stats.winRate || 0) * 100) + "%" : "—";
  const selected = opts.selected ? "selected" : "";
  const captain = opts.captain ? "captain" : "";
  const bench = opts.bench ? "bench" : "";
  const photo = typeof getPlayerPhoto === "function" ? getPlayerPhoto(p) : "";
  const initials = typeof getPlayerInitials === "function" ? getPlayerInitials(p.name) : (p.name || "?").slice(0, 2);

  return `
    <div class="fx-card ${selected} ${captain} ${bench}" data-key="${escapeHTML(p.key)}" ${opts.onclick ? `onclick="${opts.onclick}"` : ""}>
      ${opts.captain ? `<div class="fx-card-badge captain">⭐ CAPITÃO</div>` : ""}
      ${opts.bench ? `<div class="fx-card-badge bench">RESERVA</div>` : ""}
      <div class="fx-card-photo">
        <img src="${escapeHTML(photo)}" alt="" onerror="this.hidden=true;this.nextElementSibling.hidden=false"/><span class="fx-initials" hidden>${escapeHTML(initials)}</span>
      </div>
      <div class="fx-card-body">
        <div class="fx-card-name">${escapeHTML(p.name)}</div>
        <div class="fx-card-meta">${escapeHTML(p.club)} · ${escapeHTML(p.rank || "—")}</div>
        <div class="fx-card-stats">
          <span title="Valor oficial TransferJet: ${officialPrice}">${price}</span>
          <span>WR ${wr}</span>
        </div>
      </div>
      ${opts.actions || ""}
    </div>
  `;
}

window.fantasyCardHTML = fantasyCardHTML;
