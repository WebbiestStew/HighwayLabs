"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
} from "recharts";
import { slopesAtOffset, TRANSITION_STAGES, type TransitionGeometry, type TransitionType } from "@/lib/engineering/superelevationProfile";
import { formatStation, type UnitSystem } from "@/lib/units";

const REF_ELEV_FT = 100.0;

export type AxisOfRotation = "centerline" | "inside-edge" | "outside-edge";

export default function SuperelevationDiagram({
  geometry,
  lanesPerDirection,
  laneWidthFt,
  shoulderOutsideFt,
  tsStationFt,
  unitSystem,
  axisOfRotation = "centerline",
  transitionType = "spiral",
}: {
  geometry: TransitionGeometry;
  lanesPerDirection: number;
  laneWidthFt: number;
  shoulderOutsideFt: number;
  tsStationFt: number;
  unitSystem: UnitSystem;
  axisOfRotation?: AxisOfRotation;
  transitionType?: TransitionType;
}) {
  const totalLength = geometry.tangentRunoutFt + geometry.superelevationRunoffFt;
  const samples = 40;
  const pavementWidth = lanesPerDirection * laneWidthFt;
  const outsideShoulderDist = pavementWidth + shoulderOutsideFt;

  // The axis of rotation is the point held on the profile grade line (flat);
  // every other point's elevation is computed outward from that pivot using
  // each side's independent cross slope, rather than always pivoting on CL.
  const data = Array.from({ length: samples + 1 }, (_, i) => {
    const x = (i / samples) * totalLength;
    const { lowSidePercent, highSidePercent } = slopesAtOffset(x, geometry);

    let CL: number, LEP: number, REP: number;
    if (axisOfRotation === "inside-edge") {
      LEP = REF_ELEV_FT;
      CL = LEP + (pavementWidth * lowSidePercent) / 100;
      REP = CL + (pavementWidth * highSidePercent) / 100;
    } else if (axisOfRotation === "outside-edge") {
      REP = REF_ELEV_FT;
      CL = REP - (pavementWidth * highSidePercent) / 100;
      LEP = CL - (pavementWidth * lowSidePercent) / 100;
    } else {
      CL = REF_ELEV_FT;
      LEP = CL - (pavementWidth * lowSidePercent) / 100;
      REP = CL + (pavementWidth * highSidePercent) / 100;
    }
    const OuterShoulder = REP + (shoulderOutsideFt * highSidePercent) / 100;

    return { x, station: tsStationFt + x, CL, LEP, REP, OuterShoulder };
  });

  const stages = TRANSITION_STAGES(geometry, transitionType).filter((s) => s.x >= 0);

  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid stroke="#1a1e25" />
          <XAxis
            dataKey="x"
            stroke="#565d68"
            tick={{ fill: "#838a97", fontSize: 10 }}
            tickFormatter={(v) => formatStation(tsStationFt + v, unitSystem)}
          />
          <YAxis
            stroke="#565d68"
            tick={{ fill: "#838a97", fontSize: 10 }}
            domain={["auto", "auto"]}
            tickFormatter={(v) => v.toFixed(2)}
            width={55}
          />
          <Tooltip
            contentStyle={{ background: "#15181e", border: "1px solid #262b34", fontSize: 11 }}
            labelFormatter={(v) => `STA ${formatStation(tsStationFt + Number(v), unitSystem)}`}
          />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          {stages.map((s) => (
            <ReferenceLine
              key={s.label}
              x={s.x}
              stroke="#34394480"
              strokeDasharray="3 3"
              label={{ value: s.label, position: "insideTop", fill: "#565d68", fontSize: 8, angle: -90 }}
            />
          ))}
          <Line type="linear" dataKey="CL" stroke="#22d3ee" dot={false} strokeWidth={2} name="Centerline" />
          <Line type="linear" dataKey="LEP" stroke="#10b981" dot={false} strokeWidth={1.5} name="Low-Side Edge (LEP)" />
          <Line type="linear" dataKey="REP" stroke="#f59e0b" dot={false} strokeWidth={1.5} name="High-Side Edge (REP)" />
          <Line type="linear" dataKey="OuterShoulder" stroke="#ef4444" dot={false} strokeWidth={1} strokeDasharray="4 2" name="Outside Shoulder" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
