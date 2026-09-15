"use client";

import { useEffect, useRef } from "react";
import { slopesAtOffset, type TransitionGeometry } from "@/lib/engineering/superelevationProfile";

interface Props {
  offsetFt: number; // current station offset along transition, 0..Lt+Lr
  geometry: TransitionGeometry;
  lanesPerDirection: number;
  laneWidthFt: number;
  shoulderInsideFt: number;
  shoulderOutsideFt: number;
}

const PX_PER_FT = 9;

export default function CrossSectionCanvas({
  offsetFt,
  geometry,
  lanesPerDirection,
  laneWidthFt,
  shoulderInsideFt,
  shoulderOutsideFt,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    // background grid
    ctx.fillStyle = "#0f1115";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#1a1e25";
    ctx.lineWidth = 1;
    for (let gx = 0; gx < w; gx += 20) {
      ctx.beginPath();
      ctx.moveTo(gx + 0.5, 0);
      ctx.lineTo(gx + 0.5, h);
      ctx.stroke();
    }
    for (let gy = 0; gy < h; gy += 20) {
      ctx.beginPath();
      ctx.moveTo(0, gy + 0.5);
      ctx.lineTo(w, gy + 0.5);
      ctx.stroke();
    }

    const { lowSidePercent, highSidePercent } = slopesAtOffset(offsetFt, geometry);
    const lowSlope = lowSidePercent / 100;
    const highSlope = highSidePercent / 100;
    const shoulderBreakCapPercent = 7.0;
    const shoulderLowSlope =
      Math.sign(lowSlope) * Math.min(Math.abs(lowSlope) + 0.02, shoulderBreakCapPercent / 100);
    const shoulderHighSlope =
      Math.sign(highSlope || 1) * Math.min(Math.abs(highSlope) + 0.02, shoulderBreakCapPercent / 100);

    const cx = w / 2;
    const cy = h * 0.42;
    const laneRunPx = laneWidthFt * PX_PER_FT;
    const shoInPx = shoulderInsideFt * PX_PER_FT;
    const shoOutPx = shoulderOutsideFt * PX_PER_FT;

    // Build polyline points from low-side shoulder edge -> CL -> high-side shoulder edge
    type Pt = { x: number; y: number };
    const lowPts: Pt[] = [];
    const highPts: Pt[] = [];

    let x = 0;
    let yLow = 0;
    for (let i = 0; i < lanesPerDirection; i++) {
      lowPts.push({ x: cx - x, y: cy - yLow });
      x += laneRunPx;
      yLow += lowSlope * laneRunPx;
      lowPts.push({ x: cx - x, y: cy - yLow });
    }
    const lowEdgeY = yLow;
    const lowShoY = lowEdgeY + shoulderLowSlope * shoInPx;
    lowPts.push({ x: cx - x - shoInPx, y: cy - lowShoY });

    let xh = 0;
    let yHigh = 0;
    for (let i = 0; i < lanesPerDirection; i++) {
      highPts.push({ x: cx + xh, y: cy - yHigh });
      xh += laneRunPx;
      yHigh += highSlope * laneRunPx;
      highPts.push({ x: cx + xh, y: cy - yHigh });
    }
    const highEdgeY = yHigh;
    const highShoY = highEdgeY + shoulderHighSlope * shoOutPx;
    highPts.push({ x: cx + xh + shoOutPx, y: cy - highShoY });

    // Pavement fill (travel lanes)
    ctx.beginPath();
    ctx.moveTo(lowPts[lowPts.length - 2].x, lowPts[lowPts.length - 2].y);
    for (let i = lowPts.length - 2; i >= 0; i--) ctx.lineTo(lowPts[i].x, lowPts[i].y);
    for (let i = 0; i < highPts.length - 1; i++) ctx.lineTo(highPts[i].x, highPts[i].y);
    ctx.strokeStyle = "#565d68";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Shoulders (dimmer)
    ctx.strokeStyle = "#3a3f48";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(lowPts[lowPts.length - 2].x, lowPts[lowPts.length - 2].y);
    ctx.lineTo(lowPts[lowPts.length - 1].x, lowPts[lowPts.length - 1].y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(highPts[highPts.length - 2].x, highPts[highPts.length - 2].y);
    ctx.lineTo(highPts[highPts.length - 1].x, highPts[highPts.length - 1].y);
    ctx.stroke();

    // Lane stripes (dashed) at each lane boundary
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 1.5;
    for (let i = 1; i < lowPts.length - 1; i += 2) {
      ctx.beginPath();
      ctx.moveTo(lowPts[i].x, lowPts[i].y - 1.5);
      ctx.lineTo(lowPts[i].x, lowPts[i].y - 1.5);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Centerline
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 14);
    ctx.lineTo(cx, cy + 4);
    ctx.stroke();
    ctx.fillStyle = "#22d3ee";
    ctx.beginPath();
    ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Breakover point markers (pavement edges)
    ctx.fillStyle = "#f59e0b";
    [lowPts[lowPts.length - 2], highPts[highPts.length - 2]].forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // Vehicle roll indicator (simple rotated rectangle on high side lane) — draw before labels
    const vehX = cx + laneRunPx * 0.5;
    const vehY = cy - highSlope * laneRunPx * 0.5 - 10;
    const angle = Math.atan(highSlope);
    ctx.save();
    ctx.translate(vehX, vehY);
    ctx.rotate(angle);
    ctx.fillStyle = "#10b98122";
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 1;
    ctx.fillRect(-14, -8, 28, 8);
    ctx.strokeRect(-14, -8, 28, 8);
    ctx.restore();

    // Labels — stacked bottom-left panel, kept clear of the section geometry
    const labelPad = 8;
    ctx.font = "10px monospace";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#838a97";
    ctx.fillText("LOW-SIDE", labelPad, h - 34);
    ctx.fillStyle = "#10b981";
    ctx.fillText(`${lowSidePercent.toFixed(2)}%`, labelPad + 64, h - 34);
    ctx.fillStyle = "#838a97";
    ctx.fillText("HIGH-SIDE", labelPad, h - 20);
    ctx.fillStyle = "#f59e0b";
    ctx.fillText(`${highSidePercent.toFixed(2)}%`, labelPad + 64, h - 20);

    ctx.textAlign = "right";
    ctx.fillStyle = "#10b981";
    ctx.fillText(`ROLL ${(angle * (180 / Math.PI)).toFixed(2)}°`, w - labelPad, 14);
    ctx.textAlign = "left";
  }, [offsetFt, geometry, lanesPerDirection, laneWidthFt, shoulderInsideFt, shoulderOutsideFt]);

  return <canvas ref={canvasRef} className="h-full w-full" />;
}
