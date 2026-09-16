"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";
import { subscribeToasts, type ToastPayload } from "@/lib/toast";

const STYLES: Record<ToastPayload["kind"], { border: string; text: string; icon: React.ReactNode }> = {
  info: { border: "border-cyan/40", text: "text-cyan", icon: <Info size={13} /> },
  ok: { border: "border-emerald/40", text: "text-emerald", icon: <CheckCircle2 size={13} /> },
  warn: { border: "border-amber/40", text: "text-amber", icon: <AlertTriangle size={13} /> },
  fail: { border: "border-crimson/40", text: "text-crimson", icon: <XCircle size={13} /> },
};

export default function Toaster() {
  const [items, setItems] = useState<ToastPayload[]>([]);

  useEffect(() => {
    return subscribeToasts((t) => {
      setItems((prev) => [...prev, t]);
      setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== t.id)), 3200);
    });
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {items.map((t) => {
        const style = STYLES[t.kind];
        return (
          <div
            key={t.id}
            className={`animate-panel-in pointer-events-auto flex items-center gap-2 rounded-sm border bg-surface-1 px-3 py-2 text-[11px] shadow-2xl ${style.border} ${style.text}`}
          >
            {style.icon}
            {t.message}
          </div>
        );
      })}
    </div>
  );
}
