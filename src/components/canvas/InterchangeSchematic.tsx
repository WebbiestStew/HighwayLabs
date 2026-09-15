"use client";

import { useEffect, useRef } from "react";
import type { Topology } from "@/lib/engineering/interchangeTopologies";
import type { LOSGrade } from "@/lib/engineering/hcmOps";
import { losColor } from "@/lib/engineering/hcmOps";

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

    const nodeById = new Map(topology.nodes.map((n) => [n.id, n]));

    let frame = 0;
    const draw = () => {
      frame++;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#0f1115";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#1a1e25";
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

      for (const link of topology.links) {
        const a = nodeById.get(link.from);
        const b = nodeById.get(link.to);
        if (!a || !b) continue;
        const grade = losByRole[link.role] ?? "A";
        let color = losColor(grade);
        const isF = grade === "F";
        const flashPhase = Math.sin(frame / 15) * 0.5 + 0.5;
        const alpha = isF && flashOnF ? 0.4 + flashPhase * 0.6 : 1;
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = color;
        ctx.lineWidth = link.role === "mainline" ? 6 : link.role === "crossroad" ? 4.5 : 3;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(px(a.x), py(a.y));
        // slight curve for ramp/weave links for visual distinction
        if (link.role === "ramp" || link.role === "weave") {
          const mx = (px(a.x) + px(b.x)) / 2 + (py(a.y) - py(b.y)) * 0.15;
          const my = (py(a.y) + py(b.y)) / 2 + (px(b.x) - px(a.x)) * 0.15;
          ctx.quadraticCurveTo(mx, my, px(b.x), py(b.y));
        } else {
          ctx.lineTo(px(b.x), py(b.y));
        }
        ctx.stroke();
        ctx.globalAlpha = 1;

        // directional arrow at midpoint
        const midx = (px(a.x) + px(b.x)) / 2;
        const midy = (py(a.y) + py(b.y)) / 2;
        const angle = Math.atan2(py(b.y) - py(a.y), px(b.x) - px(a.x));
        ctx.save();
        ctx.translate(midx, midy);
        ctx.rotate(angle);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(6, 0);
        ctx.lineTo(-4, -4);
        ctx.lineTo(-4, 4);
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
