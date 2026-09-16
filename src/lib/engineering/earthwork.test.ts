import { describe, it, expect } from "vitest";
import { computeEarthwork, computeLoops, type StationRow, type EarthworkInputs } from "./earthwork";

const rows: StationRow[] = [
  { id: "a", stationFt: 0, cutAreaSqFt: 0, fillAreaSqFt: 0 },
  { id: "b", stationFt: 100, cutAreaSqFt: 200, fillAreaSqFt: 0 },
  { id: "c", stationFt: 200, cutAreaSqFt: 0, fillAreaSqFt: 0 },
  { id: "d", stationFt: 300, cutAreaSqFt: 0, fillAreaSqFt: 200 },
  { id: "e", stationFt: 400, cutAreaSqFt: 0, fillAreaSqFt: 0 },
];

const baseInputs: EarthworkInputs = {
  rows,
  soilClass: "common-soil",
  shrinkagePercent: 0,
  swellPercent: 0,
  applyPrismoidalCorrection: false,
  excavationUnitCostPerCy: 10,
  freeHaulDistanceFt: 500,
  overhaulUnitCostPerStationYd: 0.5,
  borrowUnitCostPerCy: 12,
  wasteUnitCostPerCy: 4,
};

describe("average end area volume", () => {
  it("matches the hand-computed (A1+A2)/2 * L/27 for a single interval", () => {
    const r = computeEarthwork(baseInputs);
    // interval a->b: (0+200)/2 * 100/27
    expect(r.intervals[0].cutVolumeCy).toBeCloseTo(((0 + 200) / 2) * (100 / 27), 4);
  });

  it("with zero shrinkage/swell, adjusted cut credit equals raw cut volume", () => {
    const r = computeEarthwork(baseInputs);
    expect(r.totalAdjustedCutCy).toBeCloseTo(r.totalCutCy, 4);
  });
});

describe("shrinkage / swell adjustment", () => {
  it("reduces the fill credit for common soil shrinkage", () => {
    const withShrink = computeEarthwork({ ...baseInputs, shrinkagePercent: 20 });
    const without = computeEarthwork(baseInputs);
    expect(withShrink.totalAdjustedCutCy).toBeCloseTo(without.totalAdjustedCutCy * 0.8, 3);
  });

  it("increases the credited volume for rock swell", () => {
    const rock = computeEarthwork({ ...baseInputs, soilClass: "rock", swellPercent: 25 });
    const soil = computeEarthwork({ ...baseInputs, soilClass: "common-soil", shrinkagePercent: 0 });
    expect(rock.totalAdjustedCutCy).toBeCloseTo(soil.totalAdjustedCutCy * 1.25, 3);
  });
});

describe("mass-haul cumulative ordinate", () => {
  it("starts at zero at the first station", () => {
    const r = computeEarthwork(baseInputs);
    expect(r.massHaul[0].cumulativeCy).toBe(0);
  });

  it("each ordinate equals the running sum of net interval deltas", () => {
    const r = computeEarthwork(baseInputs);
    let running = 0;
    for (let i = 0; i < r.intervals.length; i++) {
      running += r.intervals[i].netOrdinateDeltaCy;
      expect(r.massHaul[i + 1].cumulativeCy).toBeCloseTo(running, 6);
    }
  });

  it("net end ordinate matches cut minus fill for a perfectly balanced profile", () => {
    const r = computeEarthwork(baseInputs);
    // symmetric cut/fill of 200 sf triangular sections -> should net ~0
    expect(r.netEndOrdinateCy).toBeCloseTo(0, 4);
  });
});

describe("balance loops", () => {
  it("finds at least one loop for a cut-then-fill profile at balance level 0", () => {
    const r = computeEarthwork(baseInputs);
    const loops = computeLoops(r.massHaul, r.intervals, 0, 500, 0.5);
    expect(loops.length).toBeGreaterThan(0);
  });

  it("haul distance is always non-negative", () => {
    const r = computeEarthwork(baseInputs);
    const loops = computeLoops(r.massHaul, r.intervals, 0, 500, 0.5);
    for (const loop of loops) {
      expect(loop.haulDistanceFt).toBeGreaterThanOrEqual(0);
    }
  });

  it("overhaul is zero when haul distance is within the free-haul distance", () => {
    const r = computeEarthwork(baseInputs);
    const loops = computeLoops(r.massHaul, r.intervals, 0, 100000, 0.5);
    for (const loop of loops) {
      expect(loop.overhaulStationYd).toBe(0);
    }
  });
});

describe("degenerate inputs", () => {
  it("handles a single station row without throwing", () => {
    const r = computeEarthwork({ ...baseInputs, rows: [rows[0]] });
    expect(r.intervals.length).toBe(0);
    expect(Number.isNaN(r.netEndOrdinateCy)).toBe(false);
  });

  it("handles unsorted station input by sorting internally", () => {
    const shuffled = [rows[2], rows[0], rows[4], rows[1], rows[3]];
    const r = computeEarthwork({ ...baseInputs, rows: shuffled });
    expect(r.intervals[0].fromStationFt).toBe(0);
    expect(r.intervals[r.intervals.length - 1].toStationFt).toBe(400);
  });
});
