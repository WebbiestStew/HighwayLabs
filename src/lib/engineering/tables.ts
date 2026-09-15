// Empirical AASHTO Green Book design-value curves, digitized as piecewise-linear
// interpolation tables over standard design-speed breakpoints (5 mph increments,
// 15-80 mph). These are the widely published/taught representative design values
// used across state DOT design manuals (incl. TxDOT RDM); confirm against the
// current AASHTO Green Book edition exhibits before PS&E / PE certification use.

function interp(table: [number, number][], x: number): number {
  if (x <= table[0][0]) return table[0][1];
  const last = table[table.length - 1];
  if (x >= last[0]) return last[1];
  for (let i = 0; i < table.length - 1; i++) {
    const [x0, y0] = table[i];
    const [x1, y1] = table[i + 1];
    if (x >= x0 && x <= x1) {
      const t = (x - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return last[1];
}

/** Maximum side friction factor f_max(V) — open-highway design curve. */
const F_MAX_TABLE: [number, number][] = [
  [15, 0.38], [20, 0.32], [25, 0.27], [30, 0.23], [35, 0.2],
  [40, 0.18], [45, 0.16], [50, 0.14], [55, 0.13], [60, 0.12],
  [65, 0.11], [70, 0.1], [75, 0.09], [80, 0.08],
];
export function fMax(designSpeedMph: number): number {
  return interp(F_MAX_TABLE, designSpeedMph);
}

/** AASHTO Maximum Relative Gradient Δmax (%) — superelevation runoff control. */
const DELTA_MAX_TABLE: [number, number][] = [
  [15, 0.78], [20, 0.74], [25, 0.7], [30, 0.66], [35, 0.62],
  [40, 0.58], [45, 0.54], [50, 0.5], [55, 0.47], [60, 0.45],
  [65, 0.42], [70, 0.4], [75, 0.38], [80, 0.35],
];
export function deltaMax(designSpeedMph: number): number {
  return interp(DELTA_MAX_TABLE, designSpeedMph);
}

/** Multi-lane adjustment factor w_l for superelevation runoff, by lanes rotated. */
const WL_TABLE: [number, number][] = [
  [1, 1.0], [1.5, 1.2], [2, 1.5], [2.5, 1.75], [3, 2.0],
];
export function wL(lanesRotated: number): number {
  return interp(WL_TABLE, lanesRotated);
}

/** AASHTO minimum stopping sight distance SSD(V) in feet, level grade, t=2.5s, a=11.2 ft/s². */
export function ssdMinFt(designSpeedMph: number): number {
  const t = 2.5;
  const a = 11.2;
  const V = designSpeedMph;
  return 1.47 * V * t + V * V / (30 * (a / 32.2));
}

/** AASHTO minimum K-factor tables (rounded design values), per curve class. */
const K_CREST_TABLE: [number, number][] = [
  [15, 3], [20, 7], [25, 12], [30, 19], [35, 29],
  [40, 44], [45, 61], [50, 84], [55, 114], [60, 151],
  [65, 193], [70, 247], [75, 312], [80, 384],
];
const K_SAG_TABLE: [number, number][] = [
  [15, 10], [20, 17], [25, 26], [30, 37], [35, 49],
  [40, 64], [45, 79], [50, 96], [55, 115], [60, 136],
  [65, 157], [70, 181], [75, 206], [80, 231],
];
export function kMinCrest(designSpeedMph: number): number {
  return interp(K_CREST_TABLE, designSpeedMph);
}
export function kMinSag(designSpeedMph: number): number {
  return interp(K_SAG_TABLE, designSpeedMph);
}

/** Design vehicle wheelbase (effective, ft) and track/body width (ft) — AASHTO Green Book Ch.2. */
export const DESIGN_VEHICLE_GEOMETRY: Record<
  string,
  { wheelbaseFt: number; widthFt: number; label: string }
> = {
  P: { wheelbaseFt: 11, widthFt: 7, label: "Passenger Car" },
  "SU-30": { wheelbaseFt: 20, widthFt: 8.5, label: "Single Unit Truck" },
  "WB-40": { wheelbaseFt: 39.8, widthFt: 8.5, label: "Interstate Semi (WB-40)" },
  "WB-62": { wheelbaseFt: 45.5, widthFt: 8.5, label: "Interstate Semi (WB-62)" },
  "WB-67": { wheelbaseFt: 48.0, widthFt: 8.5, label: "Interstate Semi-Trailer (WB-67)" },
};
