"use client";

import { useEffect, useRef, useState } from "react";
import type { MassHaulPoint, LoopResult } from "@/lib/engineering/earthwork";
import { formatStation, type UnitSystem } from "@/lib/units";

interface Props {
  massHaul: MassHaulPoint[];
  loops: LoopResult[];
  balanceLevelCy: number;
  onBalanceLevelChange: (v: number) => void;
  unitSystem: UnitSystem;
}

export default function MassHaulCanvas({ massHaul, loops, balanceLevelCy, onBalanceLevelChange, unitSystem }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dragging, setDragging] = useState(false);
  const scaleRef = useRef<{ sx: (s: number) => number; sy: (v: number) => number; ySy: (py: number) => number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || massHaul.length === 0) return;
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

    const margin = { l: 64, r: 20, t: 20, b: 30 };
    const plotW = w - margin.l - margin.r;
    const plotH = h - margin.t - margin.b;

    const xMin = massHaul[0].stationFt;
    const xMax = massHaul[massHaul.length - 1].stationFt;
    const values = massHaul.map((p) => p.cumulativeCy).concat(balanceLevelCy);
    let yMin = Math.min(...values);
    let yMax = Math.max(...values);
    const yPad = Math.max((yMax - yMin) * 0.15, 10);
    yMin -= yPad;
    yMax += yPad;

    const sx = (station: number) => margin.l + ((station - xMin) / (xMax - xMin || 1)) * plotW;
    const sy = (v: number) => margin.t + plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH;
    const ySy = (py: number) => yMin + ((margin.t + plotH - py) / plotH) * (yMax - yMin);
    scaleRef.current = { sx, sy, ySy };

    // grid
    ctx.strokeStyle = "#1a1e25";
    ctx.lineWidth = 1;
    for (let gx = margin.l; gx <= w - margin.r; gx += 50) {
      ctx.beginPath();
      ctx.moveTo(gx + 0.5, margin.t);
      ctx.lineTo(gx + 0.5, h - margin.b);
      ctx.stroke();
    }
    for (let gy = margin.t; gy <= h - margin.b; gy += 30) {
      ctx.beginPath();
      ctx.moveTo(margin.l, gy + 0.5);
      ctx.lineTo(w - margin.r, gy + 0.5);
      ctx.stroke();
    }
    ctx.strokeStyle = "#262b34";
    ctx.strokeRect(margin.l, margin.t, plotW, plotH);

    // zero-volume baseline
    ctx.strokeStyle = "#3a4048";
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(margin.l, sy(0));
    ctx.lineTo(w - margin.r, sy(0));
    ctx.stroke();
    ctx.setLineDash([]);

    // loop shading — excavation (cut-dominant, above balance) vs embankment (fill-dominant, below)
    for (const loop of loops) {
      const x0 = sx(loop.startStationFt);
      const x1 = sx(loop.endStationFt);
      ctx.fillStyle = loop.kind === "excavation" ? "#10b98114" : "#f59e0b14";
      ctx.fillRect(x0, margin.t, x1 - x0, plotH);
    }

    // mass-haul polyline
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    massHaul.forEach((p, i) => {
      const x = sx(p.stationFt);
      const y = sy(p.cumulativeCy);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // crest/sag markers (local extrema)
    for (let i = 1; i < massHaul.length - 1; i++) {
      const prev = massHaul[i - 1].cumulativeCy;
      const cur = massHaul[i].cumulativeCy;
      const next = massHaul[i + 1].cumulativeCy;
      const isCrest = cur > prev && cur > next;
      const isSag = cur < prev && cur < next;
      if (isCrest || isSag) {
        const x = sx(massHaul[i].stationFt);
        const y = sy(cur);
        ctx.fillStyle = isCrest ? "#10b981" : "#f59e0b";
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // balance line (draggable)
    const balY = sy(balanceLevelCy);
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 3]);
    ctx.beginPath();
    ctx.moveTo(margin.l, balY);
    ctx.lineTo(w - margin.r, balY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(w - margin.r - 4, balY - 5, 8, 10);
    ctx.fillText(`BALANCE  ${balanceLevelCy.toFixed(0)} CY`, margin.l + 4, balY - 5);

    // balance crossing markers
    ctx.fillStyle = "#ef4444";
    for (const loop of loops) {
      [loop.startStationFt, loop.endStationFt].forEach((s) => {
        ctx.beginPath();
        ctx.arc(sx(s), balY, 2.5, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // axis labels
    ctx.fillStyle = "#565d68";
    ctx.font = "9px monospace";
    for (let i = 0; i <= 4; i++) {
      const st = xMin + (i / 4) * (xMax - xMin);
      ctx.fillText(formatStation(st, unitSystem), sx(st) - 22, h - margin.b + 12);
    }
    for (let i = 0; i <= 4; i++) {
      const v = yMin + (i / 4) * (yMax - yMin);
      ctx.fillText(v.toFixed(0), 4, margin.t + plotH - (i / 4) * plotH + 3);
    }
  }, [massHaul, loops, balanceLevelCy, unitSystem]);

  return (
    <canvas
      ref={canvasRef}
      className={`h-full w-full ${dragging ? "cursor-ns-resize" : "cursor-grab"}`}
      onMouseDown={(e) => {
        setDragging(true);
        const rect = canvasRef.current!.getBoundingClientRect();
        const py = e.clientY - rect.top;
        if (scaleRef.current) onBalanceLevelChange(scaleRef.current.ySy(py));
      }}
      onMouseMove={(e) => {
        if (!dragging) return;
        const rect = canvasRef.current!.getBoundingClientRect();
        const py = e.clientY - rect.top;
        if (scaleRef.current) onBalanceLevelChange(scaleRef.current.ySy(py));
      }}
      onMouseUp={() => setDragging(false)}
      onMouseLeave={() => setDragging(false)}
    />
  );
}
