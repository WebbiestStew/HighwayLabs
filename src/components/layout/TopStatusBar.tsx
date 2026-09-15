"use client";

import { useProjectStore, DESIGN_VEHICLE_LABELS, type DesignVehicle } from "@/lib/store";
import { formatStation, mphToKmh, kmhToMph } from "@/lib/units";

export default function TopStatusBar() {
  const {
    corridorName,
    setCorridorName,
    unitSystem,
    setUnitSystem,
    designSpeedMph,
    setDesignSpeedMph,
    designVehicle,
    setDesignVehicle,
    stationStart,
    stationEnd,
  } = useProjectStore();

  const speedDisplayValue =
    unitSystem === "us" ? designSpeedMph : Math.round(mphToKmh(designSpeedMph));
  const speedUnitLabel = unitSystem === "us" ? "mph" : "km/h";

  return (
    <header className="flex h-10 shrink-0 items-center gap-4 border-b border-border-hairline bg-surface-1 px-3 text-[11px]">
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-sm bg-cyan/10 text-cyan font-bold text-[10px]">
          HL
        </span>
        <span className="font-semibold tracking-wide text-text-primary">HIGHWAYLAB</span>
      </div>

      <div className="h-4 w-px bg-border-hairline" />

      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className="shrink-0 text-text-tertiary">CORRIDOR</span>
        <input
          value={corridorName}
          onChange={(e) => setCorridorName(e.target.value)}
          className="w-full min-w-0 truncate bg-transparent text-text-primary outline-none focus:text-cyan"
        />
      </div>

      <div className="h-4 w-px bg-border-hairline" />

      <StatusField label="V DESIGN" value="" accent="cyan">
        <input
          type="number"
          value={speedDisplayValue}
          min={unitSystem === "us" ? 15 : 25}
          max={unitSystem === "us" ? 85 : 135}
          onChange={(e) => {
            const raw = Number(e.target.value);
            setDesignSpeedMph(unitSystem === "us" ? raw : kmhToMph(raw));
          }}
          className="w-12 bg-transparent text-right text-cyan outline-none"
        />
        <span className="text-[10px] text-text-tertiary">{speedUnitLabel}</span>
      </StatusField>

      <div className="h-4 w-px bg-border-hairline" />

      <StatusField label="VEHICLE" value="">
        <select
          value={designVehicle}
          onChange={(e) => setDesignVehicle(e.target.value as DesignVehicle)}
          className="bg-transparent text-text-primary outline-none"
        >
          {Object.entries(DESIGN_VEHICLE_LABELS).map(([k, v]) => (
            <option key={k} value={k} className="bg-surface-1">
              {k}
            </option>
          ))}
        </select>
      </StatusField>

      <div className="h-4 w-px bg-border-hairline" />

      <div className="flex shrink-0 items-center gap-1.5 tabular-nums">
        <span className="text-text-tertiary">STA</span>
        <span className="text-text-primary">
          {formatStation(stationStart, unitSystem)} — {formatStation(stationEnd, unitSystem)}
        </span>
      </div>

      <div className="h-4 w-px bg-border-hairline" />

      <div className="flex shrink-0 items-center rounded-sm border border-border-hairline">
        <button
          onClick={() => setUnitSystem("us")}
          className={`px-2 py-1 ${unitSystem === "us" ? "bg-cyan/15 text-cyan" : "text-text-tertiary hover:text-text-secondary"}`}
        >
          US
        </button>
        <button
          onClick={() => setUnitSystem("si")}
          className={`px-2 py-1 ${unitSystem === "si" ? "bg-cyan/15 text-cyan" : "text-text-tertiary hover:text-text-secondary"}`}
        >
          SI
        </button>
      </div>
    </header>
  );
}

function StatusField({
  label,
  value,
  accent,
  children,
}: {
  label: string;
  value: string;
  accent?: "cyan" | "amber" | "emerald";
  children?: React.ReactNode;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <span className="text-text-tertiary">{label}</span>
      {children ?? <span className="tabular-nums text-text-primary">{value}</span>}
    </div>
  );
}
