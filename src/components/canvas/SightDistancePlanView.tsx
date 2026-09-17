"use client";

import { useEffect, useRef } from "react";
import { offsetPoint, type AlignmentResult } from "@/lib/engineering/alignmentGeometry";

interface Props {
  result: AlignmentResult;
  curveRadiusFt: number;
  middleOrdinateFt: number;
  ssdFt: number;
  turnDirection: "left" | "right";
  pavementWidthFt: number;
  actualClearanceFt: number;
}

export default function SightDistancePlanView({
  result,
  curveRadiusFt,
  middleOrdinateFt,
  ssdFt,
  turnDirection,
  pavementWidthFt,
  actualClearanceFt,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const violation = actualClearanceFt < middleOrdinateFt;

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
    ctx.fillStyle = "#0f1115";
    ctx.fillRect(0, 0, w, h);

    const pts = result.points;
    if (pts.length < 2) return;

    // Fit the whole shown alignment (including the obstruction offset ring) into the canvas.
    const halfWidth = pavementWidthFt / 2;
    const marginFt = Math.max(actualClearanceFt, middleOrdinateFt) + 20;
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const minX = Math.min(...xs) - marginFt;
    const maxX = Math.max(...xs) + marginFt;
    const minY = Math.min(...ys, result.centerY) - marginFt;
    const maxY = Math.max(...ys, result.centerY) + marginFt;
    const spanX = Math.max(maxX - minX, 1);
    const spanY = Math.max(maxY - minY, 1);
    const pad = 24;
    const scale = Math.min((w - pad * 2) / spanX, (h - pad * 2) / spanY);
    const originX = (w - spanX * scale) / 2 - minX * scale;
    const originY = h - ((h - spanY * scale) / 2 - minY * scale);
    const sx = (x: number) => originX + x * scale;
    const sy = (y: number) => originY - y * scale;

    // Background grid
    ctx.strokeStyle = "#1a1e25";
    ctx.lineWidth = 1;
    for (let gx = 0; gx < w; gx += 24) {
      ctx.beginPath();
      ctx.moveTo(gx + 0.5, 0);
      ctx.lineTo(gx + 0.5, h);
      ctx.stroke();
    }
    for (let gy = 0; gy < h; gy += 24) {
      ctx.beginPath();
      ctx.moveTo(0, gy + 0.5);
      ctx.lineTo(w, gy + 0.5);
      ctx.stroke();
    }

    // Pavement edges
    const left = pts.map((p) => offsetPoint(p, halfWidth, turnDirection));
    const right = pts.map((p) => offsetPoint(p, -halfWidth, turnDirection));
    ctx.strokeStyle = "#565d68";
    ctx.lineWidth = 2;
    for (const edge of [left, right]) {
      ctx.beginPath();
      edge.forEach((p, i) => (i === 0 ? ctx.moveTo(sx(p.x), sy(p.y)) : ctx.lineTo(sx(p.x), sy(p.y))));
      ctx.stroke();
    }

    // Centerline
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(sx(p.x), sy(p.y)) : ctx.lineTo(sx(p.x), sy(p.y))));
    ctx.stroke();

    // Required clear-zone boundary and actual-obstruction ring, centered on the circle center,
    // spanning the curve's angular extent (only meaningful where a circular arc / constant-R region exists).
    const scPoint = pts.find((p) => p.arcLengthFt >= result.scArcLength) ?? pts[0];
    const csPoint = pts.find((p) => p.arcLengthFt >= result.csArcLength) ?? pts[pts.length - 1];
    const angleAt = (p: { x: number; y: number }) => Math.atan2(p.y - result.centerY, p.x - result.centerX);
    const a0 = angleAt(scPoint);
    const a1 = angleAt(csPoint);
    // Turning right sweeps clockwise (decreasing screen angle); normalize the draw order either way.
    const drawArc = (radius: number, color: string, dashed: boolean) => {
      if (radius <= 1) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      if (dashed) ctx.setLineDash([5, 4]);
      ctx.beginPath();
      const steps = 40;
      for (let i = 0; i <= steps; i++) {
        const a = a0 + ((a1 - a0) * i) / steps;
        const x = result.centerX + radius * Math.cos(a);
        const y = result.centerY + radius * Math.sin(a);
        if (i === 0) ctx.moveTo(sx(x), sy(y));
        else ctx.lineTo(sx(x), sy(y));
      }
      ctx.stroke();
      ctx.setLineDash([]);
    };
    drawArc(curveRadiusFt - middleOrdinateFt, "#f59e0b", true); // required clear-zone boundary
    drawArc(curveRadiusFt - actualClearanceFt, violation ? "#ef4444" : "#10b981", false); // actual obstruction line

    // Sight-line chord: SSD arc centered on the middle of the circular-arc region (or curve midpoint if no arc).
    const midArc = (result.scArcLength + result.csArcLength) / 2;
    const halfSsdAngle = curveRadiusFt > 0 ? (ssdFt / 2 / curveRadiusFt) : 0;
    const midPoint = pts.reduce((closest, p) => (Math.abs(p.arcLengthFt - midArc) < Math.abs(closest.arcLengthFt - midArc) ? p : closest));
    const midAngle = angleAt(midPoint);
    const eyeAngle = midAngle - Math.sign(a1 - a0 || 1) * halfSsdAngle;
    const targetAngle = midAngle + Math.sign(a1 - a0 || 1) * halfSsdAngle;
    const eyeX = result.centerX + curveRadiusFt * Math.cos(eyeAngle);
    const eyeY = result.centerY + curveRadiusFt * Math.sin(eyeAngle);
    const targetX = result.centerX + curveRadiusFt * Math.cos(targetAngle);
    const targetY = result.centerY + curveRadiusFt * Math.sin(targetAngle);
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(sx(eyeX), sy(eyeY));
    ctx.lineTo(sx(targetX), sy(targetY));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#facc15";
    [
      [eyeX, eyeY],
      [targetX, targetY],
    ].forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(sx(x), sy(y), 2.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // M dimension: from the sight chord midpoint out to the required clear-zone boundary, along the radial direction.
    const chordMidX = (eyeX + targetX) / 2;
    const chordMidY = (eyeY + targetY) / 2;
    const boundaryX = result.centerX + (curveRadiusFt - middleOrdinateFt) * Math.cos(midAngle);
    const boundaryY = result.centerY + (curveRadiusFt - middleOrdinateFt) * Math.sin(midAngle);
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx(chordMidX), sy(chordMidY));
    ctx.lineTo(sx(boundaryX), sy(boundaryY));
    ctx.stroke();

    ctx.font = "10px monospace";
    ctx.fillStyle = "#f59e0b";
    ctx.fillText(`M = ${middleOrdinateFt.toFixed(2)} ft`, sx((chordMidX + boundaryX) / 2) + 6, sy((chordMidY + boundaryY) / 2));

    // Legend
    const legendY = 14;
    ctx.font = "10px monospace";
    ctx.fillStyle = "#facc15";
    ctx.fillText(`SIGHT LINE (SSD = ${ssdFt.toFixed(0)} ft)`, 8, legendY);
    ctx.fillStyle = "#f59e0b";
    ctx.fillText("REQUIRED CLEAR-ZONE BOUNDARY", 8, legendY + 14);
    ctx.fillStyle = violation ? "#ef4444" : "#10b981";
    ctx.fillText(`ACTUAL OBSTRUCTION @ ${actualClearanceFt.toFixed(1)} ft — ${violation ? "VIOLATION" : "CLEAR"}`, 8, legendY + 28);
  }, [result, curveRadiusFt, middleOrdinateFt, ssdFt, turnDirection, pavementWidthFt, actualClearanceFt, violation]);

  return <canvas ref={canvasRef} className="h-full w-full" />;
}
