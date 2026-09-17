// Real 3D-polyline DXF and LandXML CoordGeom export, sourced from the same
// alignmentGeometry.ts engine that drives the 3D viewer and sight-distance
// overlay, so every export stays numerically consistent with what's shown
// on screen. LandXML CoordGeom element structure follows the published
// LandXML 1.2 schema (Line/Spiral/Curve with Start/End/Center/PI child
// points, "northing easting" point order) but has not been round-tripped
// against every vendor's importer — treat as a good-faith interoperability
// export, not a certified/validated one.

import { downloadBlob } from "./download";
import { offsetPoint, type AlignmentParams, type AlignmentResult } from "../engineering/alignmentGeometry";

export interface Polyline3D {
  layer: string;
  points: { x: number; y: number; z: number }[];
}

/** Real 3D POLYLINE (classic DXF R12-compatible entity, flag 70=8) + VERTEX + SEQEND — not point clouds. */
export function buildDxf3DPolylines(polylines: Polyline3D[]): string {
  const lines: string[] = [];
  const push = (code: number | string, value: string | number) => {
    lines.push(String(code), String(value));
  };
  push(0, "SECTION");
  push(2, "ENTITIES");
  for (const pl of polylines) {
    push(0, "POLYLINE");
    push(8, pl.layer);
    push(66, 1); // "entities follow" flag
    push(70, 8); // 3D polyline
    for (const p of pl.points) {
      push(0, "VERTEX");
      push(8, pl.layer);
      push(10, p.x.toFixed(4));
      push(20, p.y.toFixed(4));
      push(30, p.z.toFixed(4));
      push(70, 32); // 3D polyline vertex flag
    }
    push(0, "SEQEND");
  }
  push(0, "ENDSEC");
  push(0, "EOF");
  return lines.join("\n");
}

/** Centerline + both edges of pavement, as real 3D polylines reflecting grade and superelevation roll. */
export function alignmentToDxfPolylines(result: AlignmentResult, params: AlignmentParams): Polyline3D[] {
  const halfWidth = params.pavementWidthFt / 2;
  return [
    { layer: "CENTERLINE", points: result.points.map((p) => ({ x: p.x, y: p.y, z: p.z })) },
    { layer: "EDGE-OF-PAVEMENT-LEFT", points: result.points.map((p) => offsetPoint(p, halfWidth, params.turnDirection)) },
    { layer: "EDGE-OF-PAVEMENT-RIGHT", points: result.points.map((p) => offsetPoint(p, -halfWidth, params.turnDirection)) },
  ];
}

export function downloadAlignmentDxf(result: AlignmentResult, params: AlignmentParams, filename: string) {
  downloadBlob(new Blob([buildDxf3DPolylines(alignmentToDxfPolylines(result, params))], { type: "application/dxf" }), filename);
}

function fmt(n: number, d = 4): string {
  return n.toFixed(d);
}
function pt(x: number, y: number): string {
  // LandXML CoordGeom points are "northing easting" — y is treated as northing here.
  return `${fmt(y)} ${fmt(x)}`;
}
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** LandXML 1.2 <Alignment>/<CoordGeom> for the horizontal geometry: lead-in Line, entry Spiral, Curve, exit Spiral, lead-out Line. */
export function buildLandXml(result: AlignmentResult, params: AlignmentParams, corridorName: string, startStationFt: number): string {
  const pts = result.points;
  const at = (arcLength: number) => pts.reduce((closest, p) => (Math.abs(p.arcLengthFt - arcLength) < Math.abs(closest.arcLengthFt - arcLength) ? p : closest));
  const origin = pts[0];
  const ts = at(result.tsArcLength);
  const sc = at(result.scArcLength);
  const cs = at(result.csArcLength);
  const st = at(result.stArcLength);
  const end = pts[pts.length - 1];
  const rot = params.turnDirection === "right" ? "cw" : "ccw";
  const A = Math.sqrt(Math.max(result.scArcLength, 0.001) * params.curveRadiusFt);

  const segments: string[] = [];
  if (params.leadTangentFt > 0.01) {
    segments.push(`      <Line>\n        <Start>${pt(origin.x, origin.y)}</Start>\n        <End>${pt(ts.x, ts.y)}</End>\n      </Line>`);
  }
  if (result.scArcLength > 0.01) {
    segments.push(
      `      <Spiral rot="${rot}" spiType="clothoid" length="${fmt(result.scArcLength, 3)}" radiusStart="INF" radiusEnd="${fmt(params.curveRadiusFt, 3)}" constant="${fmt(A, 3)}">\n` +
        `        <Start>${pt(ts.x, ts.y)}</Start>\n        <End>${pt(sc.x, sc.y)}</End>\n      </Spiral>`
    );
  }
  if (result.circularArcLengthFt > 0.01) {
    segments.push(
      `      <Curve rot="${rot}" length="${fmt(result.circularArcLengthFt, 3)}" radius="${fmt(params.curveRadiusFt, 3)}">\n` +
        `        <Start>${pt(sc.x, sc.y)}</Start>\n        <Center>${pt(result.centerX, result.centerY)}</Center>\n        <End>${pt(cs.x, cs.y)}</End>\n      </Curve>`
    );
  }
  if (result.scArcLength > 0.01) {
    segments.push(
      `      <Spiral rot="${rot}" spiType="clothoid" length="${fmt(result.scArcLength, 3)}" radiusStart="${fmt(params.curveRadiusFt, 3)}" radiusEnd="INF" constant="${fmt(A, 3)}">\n` +
        `        <Start>${pt(cs.x, cs.y)}</Start>\n        <End>${pt(st.x, st.y)}</End>\n      </Spiral>`
    );
  }
  if (params.leadTangentFt > 0.01) {
    segments.push(`      <Line>\n        <Start>${pt(st.x, st.y)}</Start>\n        <End>${pt(end.x, end.y)}</End>\n      </Line>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<LandXML xmlns="http://www.landxml.org/schema/LandXML-1.2" version="1.2" date="${new Date().toISOString().slice(0, 10)}" time="${new Date().toISOString().slice(11, 19)}">
  <Project name="${esc(corridorName)}"/>
  <Alignments>
    <Alignment name="${esc(corridorName)}" length="${fmt(result.stArcLength + 2 * params.leadTangentFt, 3)}" staStart="${fmt(startStationFt - params.leadTangentFt, 3)}">
      <CoordGeom>
${segments.join("\n")}
      </CoordGeom>
    </Alignment>
  </Alignments>
</LandXML>
`;
}

export function downloadLandXml(result: AlignmentResult, params: AlignmentParams, corridorName: string, startStationFt: number, filename: string) {
  downloadBlob(new Blob([buildLandXml(result, params, corridorName, startStationFt)], { type: "application/xml" }), filename);
}
