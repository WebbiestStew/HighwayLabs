"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  type NetworkState,
  type RoadType,
  type NetNode,
  ROAD_TYPE_SPECS,
  addSegment,
  removeSegment,
  removeStamp,
  addStamp,
  findNearbyNode,
  snapToGrid,
  pointToSegmentDistance,
  uid,
} from "@/lib/engineering/networkBuilder";
import { TOPOLOGIES, type TopologyId } from "@/lib/engineering/interchangeTopologies";
import { tracePath } from "./roadPath";

export type BuilderTool = "draw" | "delete" | "stamp" | "pan";

interface Props {
  state: NetworkState;
  onChange: (next: NetworkState) => void;
  tool: BuilderTool;
  roadType: RoadType;
  stampTopologyId: TopologyId;
  stampFootprintFt: number;
  stampRotationDeg: number;
  gridFt: number;
  snapEnabled: boolean;
}

interface Transform {
  offsetX: number;
  offsetY: number;
  scale: number; // px per ft
}

const ROLE_COLOR: Record<string, string> = {
  mainline: "#22d3ee",
  ramp: "#10b981",
  crossroad: "#f59e0b",
  weave: "#f59e0b",
};

export default function NetworkBuilderCanvas({
  state,
  onChange,
  tool,
  roadType,
  stampTopologyId,
  stampFootprintFt,
  stampRotationDeg,
  gridFt,
  snapEnabled,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [xform, setXform] = useState<Transform>({ offsetX: 0, offsetY: 0, scale: 0.12 });
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [hoverWorld, setHoverWorld] = useState<{ x: number; y: number } | null>(null);
  const panState = useRef<{ active: boolean; lastX: number; lastY: number }>({ active: false, lastX: 0, lastY: 0 });

  const toWorld = useCallback(
    (sx: number, sy: number) => ({
      x: (sx - xform.offsetX) / xform.scale,
      y: (sy - xform.offsetY) / xform.scale,
    }),
    [xform]
  );
  const toScreen = useCallback((wx: number, wy: number) => ({ x: xform.offsetX + wx * xform.scale, y: xform.offsetY + wy * xform.scale }), [xform]);

  const snapPoint = useCallback(
    (x: number, y: number) => {
      const near = findNearbyNode(state.nodes, x, y, 40 / xform.scale + 10);
      if (near) return { x: near.x, y: near.y };
      if (snapEnabled) return { x: snapToGrid(x, gridFt), y: snapToGrid(y, gridFt) };
      return { x, y };
    },
    [state.nodes, snapEnabled, gridFt, xform.scale]
  );

  // Initial centering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setXform((t) => ({ ...t, offsetX: canvas.clientWidth / 2, offsetY: canvas.clientHeight / 2 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    ctx.fillStyle = "#0a0b0d";
    ctx.fillRect(0, 0, w, h);

    // grid
    const gridPx = gridFt * xform.scale;
    if (gridPx > 4) {
      ctx.strokeStyle = "#1a1e25";
      ctx.lineWidth = 1;
      const startX = xform.offsetX % gridPx;
      const startY = xform.offsetY % gridPx;
      for (let gx = startX; gx < w; gx += gridPx) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, h);
        ctx.stroke();
      }
      for (let gy = startY; gy < h; gy += gridPx) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(w, gy);
        ctx.stroke();
      }
    }
    // origin crosshair
    const origin = toScreen(0, 0);
    ctx.strokeStyle = "#262b34";
    ctx.beginPath();
    ctx.moveTo(origin.x - 10, origin.y);
    ctx.lineTo(origin.x + 10, origin.y);
    ctx.moveTo(origin.x, origin.y - 10);
    ctx.lineTo(origin.x, origin.y + 10);
    ctx.stroke();

    const nodeMap = new Map<string, NetNode>(state.nodes.map((n) => [n.id, n]));
    const degree = new Map<string, number>();
    for (const seg of state.segments) {
      degree.set(seg.a, (degree.get(seg.a) ?? 0) + 1);
      degree.set(seg.b, (degree.get(seg.b) ?? 0) + 1);
    }

    // segments
    for (const seg of state.segments) {
      const a = nodeMap.get(seg.a);
      const b = nodeMap.get(seg.b);
      if (!a || !b) continue;
      const spec = ROAD_TYPE_SPECS[seg.type];
      const pa = toScreen(a.x, a.y);
      const pb = toScreen(b.x, b.y);
      ctx.strokeStyle = spec.color;
      ctx.lineWidth = Math.max(2, spec.lanes * 1.6 * Math.min(xform.scale * 8, 1.4));
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    }

    // nodes / intersections
    for (const n of state.nodes) {
      const p = toScreen(n.x, n.y);
      const deg = degree.get(n.id) ?? 0;
      ctx.fillStyle = deg >= 3 ? "#f59e0b" : "#565d68";
      ctx.beginPath();
      ctx.arc(p.x, p.y, deg >= 3 ? 4 : 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // placed interchange stamps
    for (const stamp of state.stamps) {
      drawStamp(ctx, stamp.topologyId, toScreen(stamp.x, stamp.y), stamp.footprintFt * xform.scale, stamp.rotationDeg);
    }

    // in-progress draw preview
    if (drawStart && hoverWorld && tool === "draw") {
      const p1 = toScreen(drawStart.x, drawStart.y);
      const snapped = snapPoint(hoverWorld.x, hoverWorld.y);
      const p2 = toScreen(snapped.x, snapped.y);
      ctx.strokeStyle = ROAD_TYPE_SPECS[roadType].color + "aa";
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      ctx.setLineDash([]);
      const lengthFt = Math.hypot(snapped.x - drawStart.x, snapped.y - drawStart.y);
      ctx.fillStyle = "#d4d8de";
      ctx.font = "10px monospace";
      ctx.fillText(`${lengthFt.toFixed(0)} ft`, (p1.x + p2.x) / 2 + 8, (p1.y + p2.y) / 2 - 8);
    }

    // stamp placement preview
    if (tool === "stamp" && hoverWorld) {
      const snapped = snapPoint(hoverWorld.x, hoverWorld.y);
      ctx.globalAlpha = 0.6;
      drawStamp(ctx, stampTopologyId, toScreen(snapped.x, snapped.y), stampFootprintFt * xform.scale, stampRotationDeg);
      ctx.globalAlpha = 1;
    }

    // scale bar
    const scaleBarFt = niceScaleBar(100 / xform.scale);
    const scaleBarPx = scaleBarFt * xform.scale;
    ctx.strokeStyle = "#838a97";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(16, h - 16);
    ctx.lineTo(16 + scaleBarPx, h - 16);
    ctx.stroke();
    ctx.fillStyle = "#838a97";
    ctx.font = "9px monospace";
    ctx.fillText(`${scaleBarFt.toFixed(0)} ft`, 16, h - 22);
  }, [state, xform, drawStart, hoverWorld, tool, roadType, stampTopologyId, stampFootprintFt, stampRotationDeg, gridFt, snapPoint, toScreen]);

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    if (tool === "pan" || e.button === 1) {
      panState.current = { active: true, lastX: sx, lastY: sy };
      return;
    }
    const world = toWorld(sx, sy);
    const snapped = snapPoint(world.x, world.y);

    if (tool === "draw") {
      if (!drawStart) {
        setDrawStart(snapped);
      } else {
        onChange(addSegment(state, drawStart.x, drawStart.y, snapped.x, snapped.y, roadType, gridFt / 2));
        setDrawStart(null);
      }
    } else if (tool === "delete") {
      let closestId: string | null = null;
      let closestD = 12 / xform.scale;
      const nodeMap = new Map(state.nodes.map((n) => [n.id, n]));
      for (const seg of state.segments) {
        const a = nodeMap.get(seg.a);
        const b = nodeMap.get(seg.b);
        if (!a || !b) continue;
        const d = pointToSegmentDistance(world.x, world.y, a.x, a.y, b.x, b.y);
        if (d < closestD) {
          closestD = d;
          closestId = seg.id;
        }
      }
      if (closestId) {
        onChange(removeSegment(state, closestId));
        return;
      }
      let closestStamp: string | null = null;
      let closestSD = stampFootprintFt / 2;
      for (const stamp of state.stamps) {
        const d = Math.hypot(stamp.x - world.x, stamp.y - world.y);
        if (d < closestSD) {
          closestSD = d;
          closestStamp = stamp.id;
        }
      }
      if (closestStamp) onChange(removeStamp(state, closestStamp));
    } else if (tool === "stamp") {
      onChange(
        addStamp(state, {
          id: uid("stamp"),
          topologyId: stampTopologyId,
          x: snapped.x,
          y: snapped.y,
          footprintFt: stampFootprintFt,
          rotationDeg: stampRotationDeg,
        })
      );
    }
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    if (panState.current.active) {
      const dx = sx - panState.current.lastX;
      const dy = sy - panState.current.lastY;
      panState.current.lastX = sx;
      panState.current.lastY = sy;
      setXform((t) => ({ ...t, offsetX: t.offsetX + dx, offsetY: t.offsetY + dy }));
      return;
    }
    setHoverWorld(toWorld(sx, sy));
  }

  // Native (non-passive) wheel listener — React's synthetic onWheel is attached
  // passively, so preventDefault() there silently fails and the page scrolls.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const worldBefore = toWorld(sx, sy);
      setXform((t) => {
        const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
        const newScale = Math.min(1.2, Math.max(0.01, t.scale * factor));
        const newOffsetX = sx - worldBefore.x * newScale;
        const newOffsetY = sy - worldBefore.y * newScale;
        return { offsetX: newOffsetX, offsetY: newOffsetY, scale: newScale };
      });
    };
    canvas.addEventListener("wheel", onWheelNative, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheelNative);
  }, [toWorld]);

  return (
    <canvas
      ref={canvasRef}
      className={`h-full w-full ${tool === "pan" ? "cursor-grab" : tool === "delete" ? "cursor-not-allowed" : "cursor-crosshair"}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={() => (panState.current.active = false)}
      onMouseLeave={() => {
        panState.current.active = false;
        setHoverWorld(null);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        setDrawStart(null);
      }}
    />
  );
}

function niceScaleBar(approxFt: number): number {
  const steps = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000];
  return steps.reduce((prev, cur) => (Math.abs(cur - approxFt) < Math.abs(prev - approxFt) ? cur : prev), steps[0]);
}

function drawStamp(
  ctx: CanvasRenderingContext2D,
  topologyId: TopologyId,
  center: { x: number; y: number },
  sizePx: number,
  rotationDeg: number
) {
  const topology = TOPOLOGIES[topologyId];
  const half = sizePx / 2;
  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate((rotationDeg * Math.PI) / 180);

  ctx.fillStyle = "#0f1115cc";
  ctx.fillRect(-half, -half, sizePx, sizePx);
  ctx.strokeStyle = "#34394480";
  ctx.strokeRect(-half, -half, sizePx, sizePx);

  const px = (nx: number) => -half + nx * sizePx;
  const py = (ny: number) => -half + ny * sizePx;

  for (const road of topology.roads) {
    const pts = road.points.map((p) => ({ x: px(p.x), y: py(p.y) }));
    ctx.strokeStyle = ROLE_COLOR[road.role] ?? "#838a97";
    ctx.lineWidth = road.role === "mainline" ? Math.max(2, sizePx * 0.03) : Math.max(1.2, sizePx * 0.018);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    tracePath(ctx, pts);
    ctx.stroke();
  }
  ctx.restore();

  ctx.fillStyle = "#838a97";
  ctx.font = "9px monospace";
  ctx.textAlign = "center";
  ctx.fillText(topology.label.toUpperCase(), center.x, center.y + half + 12);
  ctx.textAlign = "left";
}
