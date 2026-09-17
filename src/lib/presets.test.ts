import { describe, it, expect } from "vitest";
import { CORRIDOR_PRESETS } from "./presets";
import { computeHorizontal } from "./engineering/horizontal";
import { DESIGN_VEHICLE_LABELS } from "./store";

describe("CORRIDOR_PRESETS", () => {
  it("has exactly the 3 requested templates", () => {
    expect(CORRIDOR_PRESETS.map((p) => p.id)).toEqual([
      "txdot-rural-interstate",
      "urban-arterial-divided",
      "mountain-pass-highway",
    ]);
  });

  for (const preset of CORRIDOR_PRESETS) {
    it(`${preset.label}: selected curve radius meets R_min (R >= R_min per AASHTO Eq. 3-8)`, () => {
      const results = computeHorizontal(preset.horizontal);
      expect(results.meetsRMin).toBe(true);
      expect(preset.horizontal.curveRadiusFt).toBeGreaterThanOrEqual(results.rMinFt);
    });

    it(`${preset.label}: design vehicle is a recognized AASHTO classification`, () => {
      expect(Object.keys(DESIGN_VEHICLE_LABELS)).toContain(preset.horizontal.designVehicle);
    });

    it(`${preset.label}: design speed and vehicle are consistent between the preset's top-level fields and its horizontal inputs`, () => {
      expect(preset.designSpeedMph).toBe(preset.horizontal.designSpeedMph);
      expect(preset.designVehicle).toBe(preset.horizontal.designVehicle);
    });

    it(`${preset.label}: station range is well-formed`, () => {
      expect(preset.stationEnd).toBeGreaterThan(preset.stationStart);
    });
  }
});
