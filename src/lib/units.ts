// Global unit engine — US Customary <-> Metric/SI.
// AASHTO Green Book publishes parallel US and SI equations with different
// empirical constants (e.g. R_min = V²/[15(e+f)] in US mph/ft vs
// V²/[127(e+f)] in SI km/h·m). Rather than converting a single canonical
// value through a lossy round trip, callers should select the constant set
// matching the active UnitSystem — see lib/engineering/*.ts.

export type UnitSystem = "us" | "si";

export const FT_PER_M = 3.280839895;
export const M_PER_FT = 1 / FT_PER_M;
export const MPH_PER_KMH = 0.621371;
export const KMH_PER_MPH = 1 / MPH_PER_KMH;
export const CY_PER_M3 = 1.307951;
export const M3_PER_CY = 1 / CY_PER_M3;
export const PSI_PER_MPA = 145.037738;
export const MPA_PER_PSI = 1 / PSI_PER_MPA;

export const ftToM = (ft: number) => ft * M_PER_FT;
export const mToFt = (m: number) => m * FT_PER_M;
export const mphToKmh = (mph: number) => mph * KMH_PER_MPH;
export const kmhToMph = (kmh: number) => kmh * MPH_PER_KMH;
export const cyToM3 = (cy: number) => cy * M3_PER_CY;
export const m3ToCy = (m3: number) => m3 * CY_PER_M3;
export const psiToMPa = (psi: number) => psi * MPA_PER_PSI;
export const mPaToPsi = (mpa: number) => mpa * PSI_PER_MPA;

export function lengthUnit(u: UnitSystem) {
  return u === "us" ? "ft" : "m";
}
export function speedUnit(u: UnitSystem) {
  return u === "us" ? "mph" : "km/h";
}
export function volumeUnit(u: UnitSystem) {
  return u === "us" ? "cy" : "m³";
}
export function stressUnit(u: UnitSystem) {
  return u === "us" ? "psi" : "MPa";
}

/** Format a number with fixed decimals and tabular-nums grouping. */
export function fmt(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format an alignment station.
 * US: 100 ft per station -> "12+34.56"
 * SI: 1000 m per station (km chainage) -> "1+234.567"
 */
export function formatStation(value: number, unitSystem: UnitSystem): string {
  if (!Number.isFinite(value)) return "—";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (unitSystem === "us") {
    const whole = Math.floor(abs / 100);
    const rem = abs - whole * 100;
    return `${sign}${whole}+${rem.toFixed(2).padStart(5, "0")}`;
  }
  const whole = Math.floor(abs / 1000);
  const rem = abs - whole * 1000;
  return `${sign}${whole}+${rem.toFixed(3).padStart(7, "0")}`;
}

export function stationStep(unitSystem: UnitSystem) {
  return unitSystem === "us" ? 100 : 1000;
}
