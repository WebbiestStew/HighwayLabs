"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/horizontal-alignment", label: "01 · HORIZONTAL ALIGNMENT", accent: "cyan" },
  { href: "/vertical-alignment", label: "02 · VERTICAL ALIGNMENT", accent: "cyan" },
  { href: "/interchange-ops", label: "03 · INTERCHANGE / HCM OPS", accent: "amber" },
  { href: "/earthwork", label: "04 · EARTHWORK / MASS-HAUL", accent: "emerald" },
  { href: "/pavement", label: "05 · PAVEMENT SN DESIGN", accent: "emerald" },
] as const;

export default function TabNav() {
  const pathname = usePathname();

  return (
    <nav className="flex h-9 shrink-0 items-stretch border-b border-border-hairline bg-surface-1 text-[11px]">
      {TABS.map((tab) => {
        const active = pathname?.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex items-center gap-1.5 border-r border-border-hairline px-4 tracking-wide transition-colors ${
              active
                ? "bg-surface-2 text-cyan"
                : "text-text-tertiary hover:bg-surface-2/50 hover:text-text-secondary"
            }`}
          >
            {active && <span className="h-1 w-1 rounded-full bg-cyan" />}
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
