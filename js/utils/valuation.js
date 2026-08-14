/* Jet Market — Fórmula de valorização
   Hierarquia: Especial > Rank S > A > B > C > D > E > Clandestino
   Função: Titular > Reserva > Emergência
*/

window.VALUATION = {
  rankBase: {
    "Especial": 40000000,
    "Rank S": 32000000,
    "S": 32000000,
    "Rank A": 22000000,
    "A": 22000000,
    "Rank B": 15000000,
    "B": 15000000,
    "Rank C": 10000000,
    "C": 10000000,
    "Rank D": 6500000,
    "D": 6500000,
    "Rank E": 3500000,
    "E": 3500000,
    "Clandestino": 8000000,
    "Clandestina": 8000000,
    "Rank ?": 9000000,
    "-": 7000000,
    "": 7000000
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
    if (r.includes("especial")) return 40000000;
    if (r.includes("s") && !r.includes("especial")) return 32000000;
    if (r.includes("a")) return 22000000;
    if (r.includes("b")) return 15000000;
    if (r.includes("c")) return 10000000;
    if (r.includes("d")) return 6500000;
    if (r.includes("e")) return 3500000;
    if (r.includes("clandest")) return 8000000;
    return 8000000;
  },

  roleMultiplier(func, role) {
    const f = String(func || "").toLowerCase();
    const r = String(role || "").toLowerCase();
    if (/capit[aã]o/.test(f)) return 1.12;
    if (/emerg/.test(f) || r === "emergencia") return 0.75;
    if (/reserva/.test(f) || r === "reserva") return 0.90;
    return 1.0; // titular / membro
  },

  calculate({ rank, func, role, trophy, P, V, D, team }) {
    const base = this.resolveRankBase(rank);
    const wr = P > 0 ? V / P : 0.5;
    const perf = 0.65 + 0.35 * wr;
    const vol = P > 0 ? 0.80 + 0.20 * Math.min(P / 8, 1) : 0.70;
    const trop = 1 + 0.10 * (trophy || 0);
    const roleM = this.roleMultiplier(func, role);
    const tf = this.teamFactor[team] || 1.0;

    let value = Math.round(base * perf * vol * roleM * trop * tf / 100000) * 100000;
    value = Math.max(1500000, Math.min(value, 55000000));
    const peak = Math.round(value * (1.05 + 0.1 * wr) / 100000) * 100000;
    return { value, peak, wr };
  }
};
