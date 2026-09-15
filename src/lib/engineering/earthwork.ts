export interface StationRow {
  id: string;
  stationFt: number;
  cutAreaSqFt: number;
  fillAreaSqFt: number;
  centerHeightFt?: number;
  topWidthFt?: number;
}

export type SoilClass = "common-soil" | "rock";

export interface EarthworkInputs {
  rows: StationRow[];
  soilClass: SoilClass;
  shrinkagePercent: number; // compaction loss, common soil
  swellPercent: number; // blasting expansion, rock
  applyPrismoidalCorrection: boolean;
  excavationUnitCostPerCy: number;
  freeHaulDistanceFt: number;
  overhaulUnitCostPerStationYd: number;
  borrowUnitCostPerCy: number;
  wasteUnitCostPerCy: number;
}

export interface IntervalResult {
  fromStationFt: number;
  toStationFt: number;
  midStationFt: number;
  lengthFt: number;
  cutVolumeCy: number;
  fillVolumeCy: number;
  prismoidalCorrectionCy: number;
  adjustedCutVolumeCy: number; // after shrink/swell, credited toward mass-haul
  netOrdinateDeltaCy: number;
}

export interface MassHaulPoint {
  stationFt: number;
  cumulativeCy: number;
}

export interface LoopResult {
  startStationFt: number;
  endStationFt: number;
  cutVolumeCy: number;
  fillVolumeCy: number;
  balancedVolumeCy: number;
  centroidCutStationFt: number;
  centroidFillStationFt: number;
  haulDistanceFt: number;
  freeHaulVolumeCy: number;
  overhaulDistanceFt: number;
  overhaulStationYd: number;
  overhaulCost: number;
  kind: "excavation" | "embankment";
}

export interface EarthworkResults {
  intervals: IntervalResult[];
  massHaul: MassHaulPoint[];
  totalCutCy: number;
  totalFillCy: number;
  totalAdjustedCutCy: number;
  netEndOrdinateCy: number;
  borrowRequiredCy: number;
  wasteRequiredCy: number;
  totalExcavationCost: number;
  totalOverhaulCost: number;
  totalBorrowCost: number;
  totalWasteCost: number;
  grandTotalCost: number;
}

export function computeEarthwork(inputs: EarthworkInputs): EarthworkResults {
  const rows = [...inputs.rows].sort((a, b) => a.stationFt - b.stationFt);
  const fillCreditFactor =
    inputs.soilClass === "common-soil" ? 1 - inputs.shrinkagePercent / 100 : 1 + inputs.swellPercent / 100;

  const intervals: IntervalResult[] = [];
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i];
    const b = rows[i + 1];
    const L = b.stationFt - a.stationFt;
    if (L <= 0) continue;
    const cutVolumeCy = ((a.cutAreaSqFt + b.cutAreaSqFt) / 2) * (L / 27);
    const fillVolumeCy = ((a.fillAreaSqFt + b.fillAreaSqFt) / 2) * (L / 27);

    let prismoidalCorrectionCy = 0;
    if (inputs.applyPrismoidalCorrection && a.centerHeightFt != null && b.centerHeightFt != null && a.topWidthFt != null && b.topWidthFt != null) {
      prismoidalCorrectionCy = (L / 162) * (a.centerHeightFt - b.centerHeightFt) * (a.topWidthFt - b.topWidthFt) / 27;
    }

    const correctedCutCy = Math.max(0, cutVolumeCy - prismoidalCorrectionCy);
    const adjustedCutVolumeCy = correctedCutCy * fillCreditFactor;
    const netOrdinateDeltaCy = adjustedCutVolumeCy - fillVolumeCy;

    intervals.push({
      fromStationFt: a.stationFt,
      toStationFt: b.stationFt,
      midStationFt: (a.stationFt + b.stationFt) / 2,
      lengthFt: L,
      cutVolumeCy,
      fillVolumeCy,
      prismoidalCorrectionCy,
      adjustedCutVolumeCy,
      netOrdinateDeltaCy,
    });
  }

  const massHaul: MassHaulPoint[] = [];
  let cum = 0;
  if (rows.length > 0) massHaul.push({ stationFt: rows[0].stationFt, cumulativeCy: 0 });
  for (const iv of intervals) {
    cum += iv.netOrdinateDeltaCy;
    massHaul.push({ stationFt: iv.toStationFt, cumulativeCy: cum });
  }

  const totalCutCy = intervals.reduce((s, i) => s + i.cutVolumeCy, 0);
  const totalFillCy = intervals.reduce((s, i) => s + i.fillVolumeCy, 0);
  const totalAdjustedCutCy = intervals.reduce((s, i) => s + i.adjustedCutVolumeCy, 0);
  const netEndOrdinateCy = massHaul.length ? massHaul[massHaul.length - 1].cumulativeCy : 0;
  const borrowRequiredCy = netEndOrdinateCy < 0 ? -netEndOrdinateCy : 0;
  const wasteRequiredCy = netEndOrdinateCy > 0 ? netEndOrdinateCy : 0;

  const totalExcavationCost = totalCutCy * inputs.excavationUnitCostPerCy;
  const totalBorrowCost = borrowRequiredCy * inputs.borrowUnitCostPerCy;
  const totalWasteCost = wasteRequiredCy * inputs.wasteUnitCostPerCy;

  return {
    intervals,
    massHaul,
    totalCutCy,
    totalFillCy,
    totalAdjustedCutCy,
    netEndOrdinateCy,
    borrowRequiredCy,
    wasteRequiredCy,
    totalExcavationCost,
    totalOverhaulCost: 0, // computed separately per balance line in computeLoops()
    totalBorrowCost,
    totalWasteCost,
    grandTotalCost: totalExcavationCost + totalBorrowCost + totalWasteCost,
  };
}

/** Find balance-line crossings and segregate free-haul vs overhaul per loop, given a user-chosen balance level. */
export function computeLoops(
  massHaul: MassHaulPoint[],
  intervals: IntervalResult[],
  balanceLevelCy: number,
  freeHaulDistanceFt: number,
  overhaulUnitCostPerStationYd: number
): LoopResult[] {
  if (massHaul.length < 2) return [];

  const crossings: number[] = [massHaul[0].stationFt];
  for (let i = 0; i < massHaul.length - 1; i++) {
    const a = massHaul[i];
    const b = massHaul[i + 1];
    const da = a.cumulativeCy - balanceLevelCy;
    const db = b.cumulativeCy - balanceLevelCy;
    if (da === 0) continue;
    if (da * db < 0) {
      const t = da / (da - db);
      crossings.push(a.stationFt + t * (b.stationFt - a.stationFt));
    }
  }
  crossings.push(massHaul[massHaul.length - 1].stationFt);
  const uniqueCrossings = Array.from(new Set(crossings.map((c) => Math.round(c * 100) / 100))).sort((x, y) => x - y);

  const loops: LoopResult[] = [];
  for (let i = 0; i < uniqueCrossings.length - 1; i++) {
    const start = uniqueCrossings[i];
    const end = uniqueCrossings[i + 1];
    if (end - start < 1e-6) continue;

    const loopIntervals = intervals.filter((iv) => iv.midStationFt >= start && iv.midStationFt <= end);
    const cutVolumeCy = loopIntervals.reduce((s, iv) => s + iv.adjustedCutVolumeCy, 0);
    const fillVolumeCy = loopIntervals.reduce((s, iv) => s + iv.fillVolumeCy, 0);
    const cutMoment = loopIntervals.reduce((s, iv) => s + iv.midStationFt * iv.adjustedCutVolumeCy, 0);
    const fillMoment = loopIntervals.reduce((s, iv) => s + iv.midStationFt * iv.fillVolumeCy, 0);
    const centroidCutStationFt = cutVolumeCy > 0 ? cutMoment / cutVolumeCy : (start + end) / 2;
    const centroidFillStationFt = fillVolumeCy > 0 ? fillMoment / fillVolumeCy : (start + end) / 2;
    const haulDistanceFt = Math.abs(centroidFillStationFt - centroidCutStationFt);
    const balancedVolumeCy = Math.min(cutVolumeCy, fillVolumeCy);
    const overhaulDistanceFt = Math.max(0, haulDistanceFt - freeHaulDistanceFt);
    const overhaulStationYd = balancedVolumeCy * (overhaulDistanceFt / 100);
    const overhaulCost = overhaulStationYd * overhaulUnitCostPerStationYd;
    const freeHaulVolumeCy = balancedVolumeCy;

    const midCum = (massHaul.find((p) => p.stationFt >= (start + end) / 2)?.cumulativeCy ?? 0);
    const kind: LoopResult["kind"] = midCum >= balanceLevelCy ? "excavation" : "embankment";

    loops.push({
      startStationFt: start,
      endStationFt: end,
      cutVolumeCy,
      fillVolumeCy,
      balancedVolumeCy,
      centroidCutStationFt,
      centroidFillStationFt,
      haulDistanceFt,
      freeHaulVolumeCy,
      overhaulDistanceFt,
      overhaulStationYd,
      overhaulCost,
      kind,
    });
  }
  return loops;
}
