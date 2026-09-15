"use client";

import { useEffect, useRef, useState } from "react";
import type { VerticalResults } from "@/lib/engineering/vertical";
import { formatStation, type UnitSystem } from "@/lib/units";

interface Props {
  results: VerticalResults;
  pvcStationFt: number;
  pvcElevationFt: number;
  pvtStationFt: number;
  pvtElevationFt: number;
  g1: number;
  g2: number;
  ssdFt: number;
  structure?: { stationFt: number; girderElevationFt: number; widthFt: number; requiredClearanceFt: number } | null;
  unitSystem: UnitSystem;
}

export default function VerticalCurveCanvas({
  results,
  pvcStationFt,
  pvcElevationFt,
  pvtStationFt,
  pvtElevationFt,
  g1,
  g2,
  ssdFt,
  structure,
  unitSystem,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoverStation, setHoverStation] = useState<number | null>(null);

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

    const margin = { l: 56, r: 20, t: 20, b: 30 };
    const plotW = w - margin.l - margin.r;
    const plotH = h - margin.t - margin.b;

    const stationPad = (pvtStationFt - pvcStationFt) * 0.25 + 40;
    const xMin = pvcStationFt - stationPad;
    const xMax = pvtStationFt + stationPad;

    const elevSamples: number[] = [];
    for (let i = 0; i <= 50; i++) {
      elevSamples.push(results.elevationAt(pvcStationFt + (i / 50) * (pvtStationFt - pvcStationFt)));
    }
    let yMin = Math.min(...elevSamples, pvcElevationFt, pvtElevationFt);
    let yMax = Math.max(...elevSamples, pvcElevationFt, pvtElevationFt);
    if (structure) {
      yMax = Math.max(yMax, structure.girderElevationFt);
    }
    const yPad = Math.max((yMax - yMin) * 0.3, 2);
    yMin -= yPad;
    yMax += yPad + (structure ? 6 : 0);

    const sx = (station: number) => margin.l + ((station - xMin) / (xMax - xMin)) * plotW;
    const sy = (elev: number) => margin.t + plotH - ((elev - yMin) / (yMax - yMin)) * plotH;

    // grid
    ctx.strokeStyle = "#1a1e25";
    ctx.lineWidth = 1;
    for (let gx = margin.l; gx <= w - margin.r; gx += 40) {
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

    // axis ticks (station)
    ctx.fillStyle = "#565d68";
    ctx.font = "9px monospace";
    for (let i = 0; i <= 4; i++) {
      const st = xMin + (i / 4) * (xMax - xMin);
      const x = sx(st);
      ctx.fillText(formatStation(st, unitSystem), x - 20, h - margin.b + 12);
    }

    // Tangent extensions (dashed)
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = "#565d68";
    ctx.lineWidth = 1.2;
    const pviStation = results.pviStationFt;
    const pviElev = results.pviElevationFt;
    ctx.beginPath();
    ctx.moveTo(sx(pvcStationFt), sy(pvcElevationFt));
    ctx.lineTo(sx(pviStation), sy(pviElev));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sx(pviStation), sy(pviElev));
    ctx.lineTo(sx(pvtStationFt), sy(pvtElevationFt));
    ctx.stroke();
    ctx.setLineDash([]);

    // Parabola
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let i = 0; i <= 100; i++) {
      const st = pvcStationFt + (i / 100) * (pvtStationFt - pvcStationFt);
      const x = sx(st);
      const y = sy(results.elevationAt(st));
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // PVC / PVI / PVT markers
    const markPoint = (station: number, elev: number, label: string, color: string) => {
      const x = sx(station);
      const y = sy(elev);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#d4d8de";
      ctx.font = "9px monospace";
      ctx.fillText(`${label}  STA ${formatStation(station, unitSystem)}  EL ${elev.toFixed(2)}`, x + 6, y - 6);
    };
    markPoint(pvcStationFt, pvcElevationFt, "PVC", "#f59e0b");
    markPoint(pviStation, pviElev, "PVI", "#f59e0b");
    markPoint(pvtStationFt, pvtElevationFt, "PVT", "#f59e0b");

    // High/low extrema crosshair
    if (results.extremaStationFt != null && results.extremaElevationFt != null) {
      const x = sx(results.extremaStationFt);
      const y = sy(results.extremaElevationFt);
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - 8, y);
      ctx.lineTo(x + 8, y);
      ctx.moveTo(x, y - 8);
      ctx.lineTo(x, y + 8);
      ctx.stroke();
      ctx.fillStyle = "#10b981";
      ctx.font = "9px monospace";
      const lbl = g2 - g1 < 0 ? "HIGH PT" : "LOW PT";
      ctx.fillText(`${lbl} STA ${formatStation(results.extremaStationFt, unitSystem)}`, x + 8, y + 14);
    }

    // SSD sightline ray from PVC
    const eyeH = 3.5;
    const objH = 2.0;
    const rayStart = pvcStationFt + (pvtStationFt - pvcStationFt) * 0.15;
    const rayEndStation = Math.min(rayStart + ssdFt, xMax);
    ctx.strokeStyle = "#ef444490";
    ctx.setLineDash([2, 2]);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(sx(rayStart), sy(results.elevationAt(rayStart) + eyeH));
    ctx.lineTo(sx(rayEndStation), sy(results.elevationAt(rayEndStation) + objH));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#ef4444";
    ctx.fillText("SSD SIGHTLINE (illustrative)", sx(rayStart), sy(results.elevationAt(rayStart) + eyeH) - 6);

    // Overhead structure
    if (structure) {
      const sX = sx(structure.stationFt - structure.widthFt / 2);
      const eX = sx(structure.stationFt + structure.widthFt / 2);
      const girderY = sy(structure.girderElevationFt);
      ctx.fillStyle = "#26262699";
      ctx.fillRect(sX, margin.t, eX - sX, girderY - margin.t);
      ctx.strokeStyle = "#838a97";
      ctx.strokeRect(sX, margin.t, eX - sX, girderY - margin.t);

      const roadY = sy(results.elevationAt(structure.stationFt));
      const clearance = results.structureCheck?.governingClearanceFt ?? 0;
      const pass = results.structureCheck?.pass ?? false;
      const dimX = eX + 14;
      ctx.strokeStyle = pass ? "#10b981" : "#ef4444";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(dimX, girderY);
      ctx.lineTo(dimX, roadY);
      ctx.moveTo(dimX - 4, girderY);
      ctx.lineTo(dimX + 4, girderY);
      ctx.moveTo(dimX - 4, roadY);
      ctx.lineTo(dimX + 4, roadY);
      ctx.stroke();
      ctx.fillStyle = pass ? "#10b981" : "#ef4444";
      ctx.font = "10px monospace";
      ctx.fillText(`${clearance.toFixed(2)} ft`, dimX + 8, (girderY + roadY) / 2);
    }

    // Hover crosshair + slope readout
    if (hoverStation != null && hoverStation >= pvcStationFt && hoverStation <= pvtStationFt) {
      const x = sx(hoverStation);
      const y = sy(results.elevationAt(hoverStation));
      ctx.strokeStyle = "#22d3ee80";
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(x, margin.t);
      ctx.lineTo(x, h - margin.b);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#22d3ee";
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
      const slope = results.slopeAt(hoverStation);
      ctx.fillStyle = "#0f1115";
      ctx.fillRect(x + 8, y - 24, 130, 30);
      ctx.strokeStyle = "#262b34";
      ctx.strokeRect(x + 8, y - 24, 130, 30);
      ctx.fillStyle = "#d4d8de";
      ctx.fillText(`STA ${formatStation(hoverStation, unitSystem)}`, x + 12, y - 12);
      ctx.fillText(`EL ${results.elevationAt(hoverStation).toFixed(2)}  g=${slope.toFixed(2)}%`, x + 12, y - 1);
    }
  }, [results, pvcStationFt, pvcElevationFt, pvtStationFt, pvtElevationFt, g1, g2, ssdFt, structure, unitSystem, hoverStation]);

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-full cursor-crosshair"
      onMouseMove={(e) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const margin = { l: 56, r: 20 };
        const plotW = rect.width - margin.l - margin.r;
        const stationPad = (pvtStationFt - pvcStationFt) * 0.25 + 40;
        const xMin = pvcStationFt - stationPad;
        const xMax = pvtStationFt + stationPad;
        const station = xMin + ((px - margin.l) / plotW) * (xMax - xMin);
        setHoverStation(station);
      }}
      onMouseLeave={() => setHoverStation(null)}
    />
  );
}
