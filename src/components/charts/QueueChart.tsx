"use client";

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";

export default function QueueChart({ series, qMax }: { series: { tMin: number; queueVeh: number }[]; qMax: number }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={series} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <defs>
          <linearGradient id="queueFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#1a1e25" />
        <XAxis dataKey="tMin" stroke="#565d68" tick={{ fill: "#838a97", fontSize: 10 }} unit=" min" />
        <YAxis stroke="#565d68" tick={{ fill: "#838a97", fontSize: 10 }} width={40} unit=" veh" />
        <Tooltip contentStyle={{ background: "#15181e", border: "1px solid #262b34", fontSize: 11 }} />
        <ReferenceLine y={qMax} stroke="#ef4444" strokeDasharray="3 3" label={{ value: "Q_max", fill: "#ef4444", fontSize: 9 }} />
        <Area type="monotone" dataKey="queueVeh" stroke="#f59e0b" fill="url(#queueFill)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
