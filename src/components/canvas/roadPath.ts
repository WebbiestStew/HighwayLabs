// Shared curve-drawing helper for interchange schematics (the full-size
// InterchangeSchematic and the small NetworkBuilderCanvas stamp preview),
// so a road defined by 2+ waypoints reads as one smooth road, not a
// straight-line node graph. Uses the standard "quadratic-through-midpoints"
// technique: each interior point acts as a curve control point, and the
// path actually passes through the midpoints between consecutive points —
// simple, dependency-free, and smooth enough for a schematic diagram.

export interface Pt {
  x: number;
  y: number;
}

/** Traces the smooth path into the current canvas path (call ctx.stroke()/fill() after). */
export function tracePath(ctx: CanvasRenderingContext2D, points: Pt[]) {
  if (points.length < 2) return;
  ctx.moveTo(points[0].x, points[0].y);
  if (points.length === 2) {
    ctx.lineTo(points[1].x, points[1].y);
    return;
  }
  for (let i = 1; i < points.length - 1; i++) {
    const mx = (points[i].x + points[i + 1].x) / 2;
    const my = (points[i].y + points[i + 1].y) / 2;
    ctx.quadraticCurveTo(points[i].x, points[i].y, mx, my);
  }
  ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
}

/** A representative point + direction near the middle of the path, for placing a directional arrow or label. */
export function pathMidpointAndAngle(points: Pt[]): { x: number; y: number; angle: number } {
  const i = Math.max(0, Math.floor((points.length - 1) / 2));
  const a = points[i];
  const b = points[Math.min(i + 1, points.length - 1)];
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, angle: Math.atan2(b.y - a.y, b.x - a.x) };
}
