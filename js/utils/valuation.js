/* Jet Market — Fórmula de valorização
   Hierarquia: Especial > Rank S > A > B > C > D > E
   Função: Titular > Reserva > Emergência
   Títulos: Mundial > Evento Especial > Nacional > L.J.I
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
    "Rank E": 250000,
    "E": 250000,
    "Clandestino": 1500000,
    "Clandestina": 1500000,
    "Rank ?": 1500000,
    "-": 1000000,
    "": 1000000
  },

  /* Pesos por tipo de título (multiplicador acumulativo) */
  titleWeights: {
    nacional: 0.08,        // 🥇 +8%
    lji: 0.06,             // 🥈 +6%
    mundial: 0.15,         // 🏆 +15%  (mais valioso)
    eventoEspecial: 0.10   // 🏅 +10%
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
    if (r.includes("e")) return 250000;
    if (r.includes("clandest")) return 1500000;
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

  /** Multiplicador de títulos a partir do objeto titles ou do número legado trophy */
  titlesMultiplier(titles, trophyFallback) {
    if (titles && typeof titles === "object") {
      let m = 1;
      for (const [type, weight] of Object.entries(this.titleWeights)) {
        const n = Number(titles[type]) || 0;
        if (n > 0) m += weight * n;
      }
      return m;
    }
    // Fallback legado: +5% por troféu
    return 1 + 0.05 * (Number(trophyFallback) || 0);
  },

  /** Total de títulos (para exibição) */
  totalTitles(titles, trophyFallback) {
    if (titles && typeof titles === "object") {
      return Object.values(titles).reduce((s, n) => s + (Number(n) || 0), 0);
    }
    return Number(trophyFallback) || 0;
  },

  // Bônus acumulativo por prêmios individuais da Jet League
  mvpBonusPer: 0.04,        // +4% por MVP da série
  destaqueBonusPer: 0.07,   // +7% por Destaque da Rodada

  awardsMultiplier(mvpCount, destaqueCount) {
    const m = Math.max(0, Number(mvpCount) || 0);
    const d = Math.max(0, Number(destaqueCount) || 0);
    return 1 + (this.mvpBonusPer * m) + (this.destaqueBonusPer * d);
  },

  calculate({ rank, func, role, trophy, titles, P, V, D, team, mvpCount = 0, destaqueCount = 0 }) {
    const base = this.resolveRankBase(rank);
    const wr = P > 0 ? V / P : 0.5;
    const perf = 0.65 + 0.35 * wr;

    // Volume um pouco mais agressivo: curva sobe mais rápido e premia quem joga a temporada
    const vol = P > 0 ? 0.72 + 0.28 * Math.min(P / 7, 1) : 0.65;

    const trop = this.titlesMultiplier(titles, trophy);
    const roleM = this.roleMultiplier(func, role);
    const tf = this.teamFactor[team] || 1.0;
    const awards = this.awardsMultiplier(mvpCount, destaqueCount);

    // Proteção amostra pequena: P < 3 → × 0.75
    const sampleGuard = (P > 0 && P < 3) ? 0.75 : 1.0;

    // Bônus de consistência leve: P >= 8 e WR >= 70%
    const consistency = (P >= 8 && wr >= 0.70) ? 1.05 : 1.0;

    let value = base <= 0
      ? 0
      : Math.round(base * perf * vol * roleM * trop * tf * sampleGuard * consistency * awards / 50000) * 50000;

    value = Math.max(0, Math.min(value, 12000000));
    const peak = value <= 0
      ? 0
      : Math.round(value * (1.05 + 0.1 * wr) / 50000) * 50000;
    return { value, peak, wr };
  }
};
