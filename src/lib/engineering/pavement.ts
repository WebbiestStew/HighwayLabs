// 1993 AASHTO Guide for Design of Pavement Structures — flexible pavement
// empirical structural design equation, solved iteratively (bisection) for
// required Structural Number.

const Z_R_TABLE: [number, number][] = [
  [50, 0], [60, -0.253], [70, -0.524], [75, -0.674], [80, -0.841],
  [85, -1.037], [90, -1.282], [91, -1.34], [92, -1.405], [93, -1.476],
  [94, -1.555], [95, -1.645], [96, -1.751], [97, -1.881], [98, -2.054],
  [99, -2.327], [99.9, -3.09], [99.99, -3.75],
];
export function zR(reliabilityPercent: number): number {
  const t = Z_R_TABLE;
  if (reliabilityPercent <= t[0][0]) return t[0][1];
  if (reliabilityPercent >= t[t.length - 1][0]) return t[t.length - 1][1];
  for (let i = 0; i < t.length - 1; i++) {
    const [x0, y0] = t[i];
    const [x1, y1] = t[i + 1];
    if (reliabilityPercent >= x0 && reliabilityPercent <= x1) {
      const f = (reliabilityPercent - x0) / (x1 - x0);
      return y0 + f * (y1 - y0);
    }
  }
  return t[t.length - 1][1];
}

export interface PavementInputs {
  w18: number;
  reliabilityPercent: number;
  s0: number;
  p0: number;
  pt: number;
  mrPsi: number;
  a1: number;
  d1: number;
  a2: number;
  d2: number;
  m2: number;
  a3: number;
  d3: number;
  m3: number;
}

function aashtoRhs(sn: number, ZR: number, S0: number, deltaPSI: number, MR: number): number {
  return (
    ZR * S0 +
    9.36 * Math.log10(sn + 1) -
    0.2 +
    Math.log10(deltaPSI / (4.2 - 1.5)) / (0.4 + 1094 / Math.pow(sn + 1, 5.19)) +
    2.32 * Math.log10(MR) -
    8.07
  );
}

export function solveRequiredSN(inputs: PavementInputs): number {
  const ZR = zR(inputs.reliabilityPercent);
  const target = Math.log10(inputs.w18);
  const deltaPSI = inputs.p0 - inputs.pt;

  let lo = 0.1;
  let hi = 20;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const val = aashtoRhs(mid, ZR, inputs.s0, deltaPSI, inputs.mrPsi);
    if (val < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function providedSN(inputs: PavementInputs): number {
  return inputs.a1 * inputs.d1 + inputs.a2 * inputs.d2 * inputs.m2 + inputs.a3 * inputs.d3 * inputs.m3;
}

/** AASHTO Ch.3 recommended minimum thickness (in) by ESAL range. */
export function minimumThicknesses(w18: number): { surfaceIn: number; baseIn: number } {
  if (w18 <= 50_000) return { surfaceIn: 1.0, baseIn: 4 };
  if (w18 <= 150_000) return { surfaceIn: 2.0, baseIn: 4 };
  if (w18 <= 500_000) return { surfaceIn: 2.5, baseIn: 4 };
  if (w18 <= 2_000_000) return { surfaceIn: 3.0, baseIn: 6 };
  if (w18 <= 7_000_000) return { surfaceIn: 3.5, baseIn: 6 };
  return { surfaceIn: 4.0, baseIn: 6 };
}

export interface PavementResults {
  zR: number;
  deltaPSI: number;
  snRequired: number;
  snProvided: number;
  margin: number;
  pass: boolean;
  minimums: { surfaceIn: number; baseIn: number };
  meetsMinSurface: boolean;
  meetsMinBase: boolean;
  /** Back-solved allowable W18 capacity at the provided SN, holding other inputs fixed. */
  allowableW18: number;
}

export function computePavement(inputs: PavementInputs): PavementResults {
  const ZR = zR(inputs.reliabilityPercent);
  const deltaPSI = inputs.p0 - inputs.pt;
  const snRequired = solveRequiredSN(inputs);
  const snProvided = providedSN(inputs);
  const minimums = minimumThicknesses(inputs.w18);

  const rhsAtProvided = aashtoRhs(snProvided, ZR, inputs.s0, deltaPSI, inputs.mrPsi);
  const allowableW18 = Math.pow(10, rhsAtProvided);

  return {
    zR: ZR,
    deltaPSI,
    snRequired,
    snProvided,
    margin: snProvided - snRequired,
    pass: snProvided >= snRequired,
    minimums,
    meetsMinSurface: inputs.d1 >= minimums.surfaceIn,
    meetsMinBase: inputs.d2 >= minimums.baseIn,
    allowableW18,
  };
}
