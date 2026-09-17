import { describe, it, expect } from "vitest";
import { computeAlignmentGeometry, type AlignmentParams } from "../engineering/alignmentGeometry";
import { alignmentToDxfPolylines, buildDxf3DPolylines, buildLandXml } from "./alignmentExport";

const params: AlignmentParams = {
  curveRadiusFt: 1500,
  geometricSpiralLengthFt: 200,
  deflectionAngleDeg: 40,
  turnDirection: "right",
  crossSlope: { tangentRunoutFt: 100, superelevationRunoffFt: 250, eNCPercent: -2, eDesignPercent: 6 },
  leadTangentFt: 300,
  pavementWidthFt: 24,
  shoulderWidthFt: 10,
  startElevationFt: 600,
  gradePercent: -1,
  startStationFt: 10000,
};

describe("alignmentToDxfPolylines / buildDxf3DPolylines", () => {
  it("produces three polylines (centerline + both edges), each with real vertices, not single points", () => {
    const result = computeAlignmentGeometry(params);
    const polylines = alignmentToDxfPolylines(result, params);
    expect(polylines).toHaveLength(3);
    for (const pl of polylines) {
      expect(pl.points.length).toBeGreaterThan(10);
    }
  });

  it("edges are laterally offset from the centerline by half the pavement width", () => {
    const result = computeAlignmentGeometry(params);
    const [centerline, left, right] = alignmentToDxfPolylines(result, params);
    const i = Math.floor(centerline.points.length / 2);
    const distLeft = Math.hypot(left.points[i].x - centerline.points[i].x, left.points[i].y - centerline.points[i].y);
    const distRight = Math.hypot(right.points[i].x - centerline.points[i].x, right.points[i].y - centerline.points[i].y);
    expect(distLeft).toBeCloseTo(params.pavementWidthFt / 2, 1);
    expect(distRight).toBeCloseTo(params.pavementWidthFt / 2, 1);
  });

  it("emits classic 3D POLYLINE/VERTEX/SEQEND entities (flag 70=8), not POINT entities", () => {
    const result = computeAlignmentGeometry(params);
    const dxf = buildDxf3DPolylines(alignmentToDxfPolylines(result, params));
    expect(dxf).toContain("POLYLINE");
    expect(dxf).toContain("VERTEX");
    expect(dxf).toContain("SEQEND");
    expect(dxf).not.toContain("\nPOINT\n");
    // 3D polyline flag (group code 70, value 8) must appear right after each POLYLINE's layer/group-66 pair.
    const polylineBlocks = dxf.split("0\nPOLYLINE\n").slice(1);
    expect(polylineBlocks.length).toBe(3);
    for (const block of polylineBlocks) {
      expect(block.split("0\nVERTEX\n")[0]).toContain("66\n1\n70\n8\n");
    }
  });
});

describe("buildLandXml", () => {
  it("produces well-formed XML with an Alignment and a CoordGeom containing Line, Spiral, and Curve elements", () => {
    const result = computeAlignmentGeometry(params);
    const xml = buildLandXml(result, params, "Test Corridor", params.startStationFt);
    expect(xml).toContain("<LandXML");
    expect(xml).toContain("<Alignment ");
    expect(xml).toContain("<CoordGeom>");
    expect(xml).toContain("<Line>");
    expect(xml).toContain("<Spiral ");
    expect(xml).toContain("<Curve ");
    expect(xml.match(/<Spiral /g)?.length).toBe(2); // entry + exit
  });

  it("escapes special characters in the corridor name", () => {
    const result = computeAlignmentGeometry(params);
    const xml = buildLandXml(result, params, 'US-290 "Bypass" & Ramp', params.startStationFt);
    expect(xml).toContain("&quot;Bypass&quot;");
    expect(xml).toContain("&amp;");
    expect(xml).not.toContain('"Bypass"');
  });

  it("omits Curve when the deflection is too small for a circular arc (spiral-only curve)", () => {
    const result = computeAlignmentGeometry({ ...params, deflectionAngleDeg: 1, geometricSpiralLengthFt: 400 });
    const xml = buildLandXml(result, { ...params, deflectionAngleDeg: 1, geometricSpiralLengthFt: 400 }, "Test", params.startStationFt);
    expect(xml).not.toContain("<Curve ");
    expect(xml.match(/<Spiral /g)?.length).toBe(2);
  });
});
