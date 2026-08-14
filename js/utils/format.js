/* Jet Market — Formatadores */

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

function playerKey(club, name) {
  return `${club}_${name}`;
}

window.formatUSD = formatUSD;
window.formatVariation = formatVariation;
window.roleLabel = roleLabel;
window.statusLabel = statusLabel;
window.playerKey = playerKey;
