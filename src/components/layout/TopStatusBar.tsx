"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useProjectStore } from "@/lib/store";
import { formatStation, mphToKmh, kmhToMph } from "@/lib/units";
import ProjectManager from "@/components/layout/ProjectManager";
import SettingsMenu from "@/components/layout/SettingsMenu";
import { openCommandPalette } from "@/components/layout/CommandPalette";

export default function TopStatusBar() {
  const {
    corridorName,
    setCorridorName,
    unitSystem,
    setUnitSystem,
    designSpeedMph,
    setDesignSpeedMph,
    stationStart,
    stationEnd,
  } = useProjectStore();

  const speedDisplayValue =
    unitSystem === "us" ? designSpeedMph : Math.round(mphToKmh(designSpeedMph));
  const speedUnitLabel = unitSystem === "us" ? "mph" : "km/h";

  return (
    <header className="flex h-10 shrink-0 items-center gap-4 overflow-x-auto border-b border-border-hairline bg-surface-1 px-3 text-[11px]">
      <Link href="/start" className="flex shrink-0 items-center gap-2" aria-label="Back to start screen" title="Back to start screen">
        <span className="flex h-5 w-5 items-center justify-center rounded-sm bg-cyan/10 text-cyan font-bold text-[10px]">
          HL
        </span>
        <span className="font-semibold tracking-wide text-text-primary hover:text-cyan">HIGHWAYLAB</span>
      </Link>

      <div className="flex shrink-0 items-center gap-2">
        <ProjectManager />
        <SettingsMenu />
      </div>

      <div className="h-4 w-px shrink-0 bg-border-hairline" />

      <div className="flex min-w-[140px] flex-1 items-center gap-1.5">
        <span className="shrink-0 text-text-tertiary">CORRIDOR</span>
        <input
          aria-label="Corridor name"
          value={corridorName}
          onChange={(e) => setCorridorName(e.target.value)}
          className="w-full min-w-0 truncate bg-transparent text-text-primary outline-none focus:text-cyan"
        />
      </div>

      <div className="h-4 w-px shrink-0 bg-border-hairline" />

      <div className="flex shrink-0 items-center gap-1.5">
        <span className="text-text-tertiary">V DESIGN</span>
        <input
          type="number"
          aria-label={`Design speed (${speedUnitLabel})`}
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
      </div>

      <div className="h-4 w-px shrink-0 bg-border-hairline" />

      <div className="flex shrink-0 items-center gap-1.5 tabular-nums">
        <span className="text-text-tertiary">STA</span>
        <span className="text-text-primary">
          {formatStation(stationStart, unitSystem)} — {formatStation(stationEnd, unitSystem)}
        </span>
      </div>

      <div className="h-4 w-px shrink-0 bg-border-hairline" />

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

      <div className="h-4 w-px shrink-0 bg-border-hairline" />

      <button
        onClick={openCommandPalette}
        className="flex shrink-0 items-center gap-1.5 rounded-sm border border-border-hairline px-2 py-1 text-text-tertiary hover:border-cyan/40 hover:text-cyan"
        title="Search / jump to a module"
      >
        <Search size={11} />
        <kbd className="text-[9px]">⌘K</kbd>
      </button>
    </header>
  );
}
