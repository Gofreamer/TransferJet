/* Jet Market — Formatadores */

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
}

function formatUSD(value, compact = false) {
  if (value == null || isNaN(value)) return "—";

  if (compact) {
    if (value >= 1_000_000) {
      const mi = value / 1_000_000;
      return `US$ ${mi % 1 === 0 ? mi.toFixed(0) : mi.toFixed(1).replace(".", ",")} mi`;
    }
    if (value >= 1_000) {
      return `US$ ${(value / 1_000).toFixed(0)} mil`;
    }
    return `US$ ${value}`;
  }

  // Formato completo: US$ 32.500.000
  return "US$ " + value.toLocaleString("pt-BR");
}

function formatVariation(current, previous) {
  if (previous == null || previous === 0) return null;
  const diff = current - previous;
  const pct = ((diff / previous) * 100);
  return {
    diff,
    pct,
    positive: diff >= 0,
    text: `${diff >= 0 ? "▲" : "▼"} ${formatUSD(Math.abs(diff), true)} (${pct >= 0 ? "+" : ""}${pct.toFixed(1).replace(".", ",")}%)`
  };
}

function roleLabel(role) {
  if (role === "titular") return "Titular";
  if (role === "reserva") return "Reserva";
  return "Emergência";
}

function isCompetitivePlayer(player) {
  return window.StaffData?.isCombatant(player) !== false;
}

function statusLabel(status) {
  const map = {
    oficial:      { label: "OFICIAL",      color: "#22c55e", icon: "🟢" },
    negociando:   { label: "NEGOCIANDO",   color: "#3b82f6", icon: "🔵" },
    interesse:    { label: "INTERESSE",    color: "#eab308", icon: "🟡" },
    rumor_forte:  { label: "RUMOR FORTE",  color: "#f97316", icon: "🟠" },
    rumor:        { label: "RUMOR",        color: "#94a3b8", icon: "⚪" },
    encerrada:    { label: "ENCERRADA",    color: "#ef4444", icon: "🔴" }
  };
  return map[status] || { label: status?.toUpperCase() || "—", color: "#94a3b8", icon: "⚪" };
}

/** Status do agente (Market) — distinto do status de transferência/rumor */
function agentStatusMeta(status) {
  const map = {
    ativo:       { label: "Ativo",       color: "#22c55e", icon: "●" },
    livre:       { label: "Livre",       color: "#38bdf8", icon: "○" },
    emprestado:  { label: "Emprestado",  color: "#a78bfa", icon: "↔" },
    lesionado:   { label: "Lesionado",   color: "#f97316", icon: "+" },
    suspenso:    { label: "Suspenso",    color: "#ef4444", icon: "!" },
    aposentado:  { label: "Aposentado",  color: "#94a3b8", icon: "◆" },
    "fora-liga": { label: "Fora da liga", color: "#94a3b8", icon: "↗" }
  };
  const key = String(status || "ativo").toLowerCase();
  return map[key] || { label: status || "—", color: "#94a3b8", icon: "·" };
}

function renderAgentStatusBadge(status) {
  if (!status || status === "ativo") return "";
  const m = agentStatusMeta(status);
  return `<span class="tag agent-status-tag" style="background:${m.color}22;color:${m.color};border:1px solid ${m.color}44">${m.icon} ${escapeHTML(m.label)}</span>`;
}

/** Efeitos reais do status do agente no Market / UI / Fantasy */
function agentStatusEffects(status) {
  const s = String(status || "ativo").toLowerCase();
  return {
    isFree: s === "livre",
    isRetired: s === "aposentado",
    isLoaned: s === "emprestado",
    isInjured: s === "lesionado",
    isSuspended: s === "suspenso",
    offRosterVisible: s === "livre" || s === "aposentado",
    canTransfer: s !== "aposentado" && s !== "suspenso",
    fantasyEligible: s === "ativo" || s === "emprestado" || s === "lesionado",
    clubOverride: s === "livre" ? "Livre" : (s === "aposentado" ? "Aposentado" : null)
  };
}

function playerKey(club, name) {
  return `${club}_${name}`;
}

window.formatUSD = formatUSD;
window.formatVariation = formatVariation;
window.roleLabel = roleLabel;
window.statusLabel = statusLabel;
window.agentStatusMeta = agentStatusMeta;
window.renderAgentStatusBadge = renderAgentStatusBadge;
window.agentStatusEffects = agentStatusEffects;
window.playerKey = playerKey;
