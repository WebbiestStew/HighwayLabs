"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, FileText, Download } from "lucide-react";

export default function ModuleShell({
  sidebar,
  children,
  onOpenCalcDrawer,
  onExportMemo,
  onExportCsv,
  moduleTag,
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
  onOpenCalcDrawer: () => void;
  onExportMemo: () => void;
  onExportCsv: () => void;
  moduleTag: string;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-full">
      <aside
        className={`relative flex shrink-0 flex-col border-r border-border-hairline bg-surface-1 transition-all ${
          sidebarOpen ? "w-[300px]" : "w-0"
        }`}
      >
        {sidebarOpen && (
          <>
            <div className="flex items-center justify-between border-b border-border-hairline px-3 py-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">
                {moduleTag} — Parameters
              </span>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-3">{sidebar}</div>
          </>
        )}
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          className="absolute -right-3 top-1/2 flex h-8 w-6 -translate-y-1/2 items-center justify-center rounded-sm border border-border-hairline bg-surface-2 text-text-tertiary hover:text-cyan"
        >
          {sidebarOpen ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-9 shrink-0 items-center justify-end gap-2 border-b border-border-hairline bg-surface-1 px-3">
          <button
            onClick={onOpenCalcDrawer}
            className="flex items-center gap-1.5 rounded-sm border border-border-hairline px-2 py-1 text-[10px] text-text-secondary hover:border-cyan/40 hover:text-cyan"
          >
            <FileText size={11} /> CALCULATION PROOF
          </button>
          <button
            onClick={onExportCsv}
            className="flex items-center gap-1.5 rounded-sm border border-border-hairline px-2 py-1 text-[10px] text-text-secondary hover:border-emerald/40 hover:text-emerald"
          >
            <Download size={11} /> CSV / DXF
          </button>
          <button
            onClick={onExportMemo}
            className="flex items-center gap-1.5 rounded-sm border border-cyan/40 bg-cyan/10 px-2 py-1 text-[10px] font-medium text-cyan hover:bg-cyan/20"
          >
            <FileText size={11} /> EXPORT PE MEMORANDUM
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-3">{children}</div>
      </div>
    </div>
  );
}
