/* Jet Market — Fórmula de valorização
   Hierarquia: Especial > Rank S > A > B > C > D > E
   Função: Titular > Reserva > Emergência
*/

window.VALUATION = {
  rankBase: {
    "Especial": 5000000,
    "Rank S": 3000000,
    "S": 3000000,
    "Rank A": 2000000,
    "A": 2000000,
    "Rank B": 1500000,
    "B": 1500000,
    "Rank C": 1000000,
    "C": 1000000,
    "Rank D": 500000,
    "D": 500000,
    "Rank E": 0,
    "E": 0,
    "Clandestino": 2000000,
    "Clandestina": 2000000,
    "Rank ?": 1500000,
    "-": 1000000,
    "": 1000000
  },

  teamFactor: {
    "Salvatore": 1.12,
    "KOF 12": 1.10,
    "Rainbow Six": 1.08,
    "Weigon": 1.06,
    "Ghost's": 1.04,
    "Morning Star": 1.00,
    "Asgard": 0.98,
    "Platinum": 0.96,
    "La Pantera": 0.94,
    "Bastard Gran Tubarões XYZ": 0.90
  },

  resolveRankBase(rank) {
    if (this.rankBase[rank] != null) return this.rankBase[rank];
    const r = String(rank || "").toLowerCase();
    if (r.includes("especial")) return 5000000;
    if (r.includes("s") && !r.includes("especial")) return 3000000;
    if (r.includes("a")) return 2000000;
    if (r.includes("b")) return 1500000;
    if (r.includes("c")) return 1000000;
    if (r.includes("d")) return 500000;
    if (r.includes("e")) return 0;
    if (r.includes("clandest")) return 2000000;
    return 1000000;
  },

  roleMultiplier(func, role) {
    const f = String(func || "").toLowerCase();
    const r = String(role || "").toLowerCase();
    if (/capit[aã]o/.test(f)) return 1.12;
    if (/emerg/.test(f) || r === "emergencia") return 0.75;
    if (/reserva/.test(f) || r === "reserva") return 0.90;
    return 1.0;
  },

  calculate({ rank, func, role, trophy, P, V, D, team }) {
    const base = this.resolveRankBase(rank);
    const wr = P > 0 ? V / P : 0.5;
    const perf = 0.65 + 0.35 * wr;
    const vol = P > 0 ? 0.80 + 0.20 * Math.min(P / 8, 1) : 0.70;
    const trop = 1 + 0.10 * (trophy || 0);
    const roleM = this.roleMultiplier(func, role);
    const tf = this.teamFactor[team] || 1.0;

    let value = base <= 0
      ? 0
      : Math.round(base * perf * vol * roleM * trop * tf / 50000) * 50000;

    value = Math.max(0, Math.min(value, 12000000));
    const peak = value <= 0
      ? 0
      : Math.round(value * (1.05 + 0.1 * wr) / 50000) * 50000;
    return { value, peak, wr };
  }
};
