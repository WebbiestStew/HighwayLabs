"use client";

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Line, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import { offsetPoint, type AlignmentParams, type AlignmentResult } from "@/lib/engineering/alignmentGeometry";
import { terrainElevationAt, type TerrainSample } from "@/lib/terrain";

interface Props {
  result: AlignmentResult;
  params: AlignmentParams;
  /** Multiplies (z - baseline) before rendering so superelevation roll and grade are visible at highway scale — real elevation changes (feet) are tiny next to plan length (hundreds/thousands of feet). */
  verticalExaggeration: number;
  /** Real-world ground elevation along the alignment (from the Terrain / GIS Import panel) — drawn as a natural-ground line under the design ribbon so the corridor visibly cuts through real topography instead of flat space. */
  terrainProfile?: TerrainSample[];
}

function exaggFn(baselineZ: number, exaggeration: number) {
  return (z: number) => baselineZ + (z - baselineZ) * exaggeration;
}

function buildRibbonGeometry(result: AlignmentResult, params: AlignmentParams, exaggeration: number, baselineZ: number) {
  const halfWidth = params.pavementWidthFt / 2;
  const n = result.points.length;
  const positions = new Float32Array(n * 2 * 3);
  const colors = new Float32Array(n * 2 * 3);
  const indices: number[] = [];

  const exagg = exaggFn(baselineZ, exaggeration);
  const laneColor = new THREE.Color("#3a3f48");
  const edgeColor = new THREE.Color("#565d68");

  for (let i = 0; i < n; i++) {
    const p = result.points[i];
    const left = offsetPoint(p, halfWidth, params.turnDirection);
    const right = offsetPoint(p, -halfWidth, params.turnDirection);
    // Three.js Y is up; our local Z is elevation, our local Y is the plan-view northing.
    positions.set([left.x, exagg(left.z), -left.y], i * 6);
    positions.set([right.x, exagg(right.z), -right.y], i * 6 + 3);
    const c = i % 4 < 2 ? laneColor : edgeColor;
    colors.set([c.r, c.g, c.b], i * 6);
    colors.set([c.r, c.g, c.b], i * 6 + 3);
    if (i < n - 1) {
      const a = i * 2;
      const b = i * 2 + 1;
      const c2 = (i + 1) * 2;
      const d = (i + 1) * 2 + 1;
      indices.push(a, c2, b, b, c2, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function buildCenterlinePoints(result: AlignmentResult, exaggeration: number, baselineZ: number): [number, number, number][] {
  const exagg = exaggFn(baselineZ, exaggeration);
  return result.points.map((p) => [p.x, exagg(p.z) + 0.15, -p.y]);
}

/** Natural-ground line: same plan-view (x, y) as the design centerline, but real terrain elevation for z — the vertical gap between this and the design ribbon at any station IS the cut (ground above design) or fill (ground below design) depth. */
function buildTerrainPoints(result: AlignmentResult, profile: TerrainSample[], exaggeration: number, baselineZ: number): [number, number, number][] {
  const exagg = exaggFn(baselineZ, exaggeration);
  return result.points.map((p) => [p.x, exagg(terrainElevationAt(profile, p.arcLengthFt)), -p.y]);
}

/** The point of maximum superelevation roll (mid circular-arc/spiral-only curve) — where the ribbon is most worth looking at, so the default view frames it instead of a flat overview. */
function focusPoint(result: AlignmentResult, exaggeration: number, baselineZ: number) {
  const midArc = (result.scArcLength + result.csArcLength) / 2;
  const p = result.points.reduce((closest, pt) => (Math.abs(pt.arcLengthFt - midArc) < Math.abs(closest.arcLengthFt - midArc) ? pt : closest));
  const exagg = exaggFn(baselineZ, exaggeration);
  return { x: p.x, y: exagg(p.z), z: -p.y, headingRad: p.headingRad };
}

function Scene({ result, params, verticalExaggeration, terrainProfile }: Props) {
  const baselineZ = params.startElevationFt;
  const ribbon = useMemo(() => buildRibbonGeometry(result, params, verticalExaggeration, baselineZ), [result, params, verticalExaggeration, baselineZ]);
  const centerlinePoints = useMemo(() => buildCenterlinePoints(result, verticalExaggeration, baselineZ), [result, verticalExaggeration, baselineZ]);
  const terrainPoints = useMemo(
    () => (terrainProfile && terrainProfile.length > 1 ? buildTerrainPoints(result, terrainProfile, verticalExaggeration, baselineZ) : null),
    [result, terrainProfile, verticalExaggeration, baselineZ]
  );
  const focus = useMemo(() => focusPoint(result, verticalExaggeration, baselineZ), [result, verticalExaggeration, baselineZ]);

  const spanX = result.points[result.points.length - 1].x - result.points[0].x;
  const overviewDist = Math.max(spanX * 0.6, 200);
  const closeDist = Math.max(params.pavementWidthFt * 10, 150);
  const far = overviewDist * 20;
  const camPos: [number, number, number] = [
    focus.x - closeDist * Math.sin(focus.headingRad + 0.6),
    focus.y + closeDist * 0.5,
    focus.z + closeDist * Math.cos(focus.headingRad + 0.6),
  ];

  return (
    <>
      <PerspectiveCamera makeDefault position={camPos} fov={50} near={1} far={far} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[focus.x + closeDist, focus.y + closeDist, focus.z + closeDist]} intensity={1.1} />
      <mesh geometry={ribbon}>
        <meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={0.9} />
      </mesh>
      <Line points={centerlinePoints} color="#22d3ee" lineWidth={1.5} />
      {terrainPoints && <Line points={terrainPoints} color="#92764e" lineWidth={2} />}
      <Grid args={[Math.max(spanX * 2, 1000), Math.max(spanX * 2, 1000)]} cellColor="#1a1e25" sectionColor="#262b33" fadeDistance={overviewDist * 3} position={[0, baselineZ - 0.5, 0]} />
      <OrbitControls target={[focus.x, focus.y, focus.z]} maxDistance={overviewDist * 6} minDistance={20} />
    </>
  );
}

export default function AlignmentViewer3D(props: Props) {
  return (
    <Canvas className="!bg-[#0f1115]">
      <Scene {...props} />
    </Canvas>
  );
}
