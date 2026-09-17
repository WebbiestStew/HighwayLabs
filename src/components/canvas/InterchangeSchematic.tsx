"use client";

import { useEffect, useRef } from "react";
import type { Topology } from "@/lib/engineering/interchangeTopologies";
import type { LOSGrade } from "@/lib/engineering/hcmOps";
import { losColor } from "@/lib/engineering/hcmOps";
import { tracePath, pathMidpointAndAngle } from "./roadPath";

interface Props {
  topology: Topology;
  losByRole: Partial<Record<"mainline" | "ramp" | "weave" | "crossroad", LOSGrade>>;
  flashOnF?: boolean;
}

export default function InterchangeSchematic({ topology, losByRole, flashOnF = true }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

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

    const pad = 40;
    const px = (x: number) => pad + x * (w - pad * 2);
    const py = (y: number) => pad + y * (h - pad * 2);

    let frame = 0;
    const draw = () => {
      frame++;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#0f1115";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#1a1e25";
      ctx.lineWidth = 1;
      for (let gx = 0; gx < w; gx += 24) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, h);
        ctx.stroke();
      }
      for (let gy = 0; gy < h; gy += 24) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(w, gy);
        ctx.stroke();
      }

      for (const road of topology.roads) {
        const pts = road.points.map((p) => ({ x: px(p.x), y: py(p.y) }));
        const grade = losByRole[road.role] ?? "A";
        const color = losColor(grade);
        const isF = grade === "F";
        const flashPhase = Math.sin(frame / 15) * 0.5 + 0.5;
        const alpha = isF && flashOnF ? 0.4 + flashPhase * 0.6 : 1;
        const width = road.role === "mainline" ? 7 : road.role === "crossroad" ? 5.5 : 3.5;

        // Dark casing beneath the colored stroke reads as pavement edges,
        // so roads look like roads rather than abstract graph edges.
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = "#05060899";
        ctx.lineWidth = width + 2.5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        tracePath(ctx, pts);
        ctx.stroke();

        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        tracePath(ctx, pts);
        ctx.stroke();

        // Dashed centerline on the wider through-roads for a "paved road" feel.
        if (road.role === "mainline" || road.role === "crossroad") {
          ctx.globalAlpha = alpha * 0.8;
          ctx.strokeStyle = "#0f1115";
          ctx.lineWidth = 1.2;
          ctx.setLineDash([6, 5]);
          ctx.beginPath();
          tracePath(ctx, pts);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.globalAlpha = 1;

        const { x: midx, y: midy, angle } = pathMidpointAndAngle(pts);
        ctx.save();
        ctx.translate(midx, midy);
        ctx.rotate(angle);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(7, 0);
        ctx.lineTo(-5, -5);
        ctx.lineTo(-5, 5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      for (const node of topology.nodes) {
        const x = px(node.x);
        const y = py(node.y);
        ctx.fillStyle = "#22d3ee";
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
        if (node.label) {
          ctx.fillStyle = "#838a97";
          ctx.font = "9px monospace";
          const tw = ctx.measureText(node.label).width;
          ctx.fillText(node.label, Math.min(Math.max(x - tw / 2, 4), w - tw - 4), node.y < 0.5 ? y - 8 : y + 16);
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [topology, losByRole, flashOnF]);

  return <canvas ref={canvasRef} className="h-full w-full" />;
}
