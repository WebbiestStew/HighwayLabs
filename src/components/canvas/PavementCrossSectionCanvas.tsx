"use client";

import { useEffect, useRef } from "react";

interface Layer {
  label: string;
  thicknessIn: number;
  color: string;
  subtitle: string;
}

export default function PavementCrossSectionCanvas({
  d1,
  d2,
  d3,
}: {
  d1: number;
  d2: number;
  d3: number;
}) {
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
    ctx.fillStyle = "#0f1115";
    ctx.fillRect(0, 0, w, h);

    const layers: Layer[] = [
      { label: "Asphalt Concrete Surface", thicknessIn: d1, color: "#262b34", subtitle: `D1 = ${d1.toFixed(1)} in` },
      { label: "Crushed Stone Base", thicknessIn: d2, color: "#3a3f48", subtitle: `D2 = ${d2.toFixed(1)} in` },
      { label: "Granular Subbase", thicknessIn: d3, color: "#565d68", subtitle: `D3 = ${d3.toFixed(1)} in` },
      { label: "Compacted Subgrade", thicknessIn: 24, color: "#7a6a4a", subtitle: "M_R roadbed soil" },
    ];

    const totalStructIn = d1 + d2 + d3;
    const pad = { l: 30, r: 140, t: 30, b: 30 };
    const plotH = h - pad.t - pad.b - 40; // reserve 40 for subgrade block
    const scale = plotH / Math.max(totalStructIn, 1);

    let y = pad.t;
    ctx.font = "10px monospace";
    for (const layer of layers) {
      const layerH = layer.label === "Compacted Subgrade" ? 60 : layer.thicknessIn * scale;
      ctx.fillStyle = layer.color;
      ctx.fillRect(pad.l, y, w - pad.l - pad.r, layerH);
      ctx.strokeStyle = "#0a0a0a";
      ctx.strokeRect(pad.l, y, w - pad.l - pad.r, layerH);

      ctx.fillStyle = "#d4d8de";
      ctx.fillText(layer.label, w - pad.r + 10, y + layerH / 2 - 5);
      ctx.fillStyle = "#22d3ee";
      ctx.fillText(layer.subtitle, w - pad.r + 10, y + layerH / 2 + 8);

      // dimension leader
      ctx.strokeStyle = "#565d68";
      ctx.beginPath();
      ctx.moveTo(w - pad.r + 2, y + layerH / 2);
      ctx.lineTo(w - pad.r - 6, y + layerH / 2);
      ctx.stroke();

      y += layerH;
    }

    // top surface line marking driving surface
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pad.l, pad.t);
    ctx.lineTo(w - pad.r, pad.t);
    ctx.stroke();
    ctx.fillStyle = "#22d3ee";
    ctx.fillText("PAVEMENT SURFACE", pad.l, pad.t - 8);
  }, [d1, d2, d3]);

  return <canvas ref={canvasRef} className="h-full w-full" />;
}
