# HighwayLab

Enterprise-grade highway geometric design, traffic operations, and earthwork
engineering workstation. Next.js (App Router) + TypeScript + Tailwind CSS +
Canvas/WebGL-style vector rendering + Recharts, styled as a monochrome dark
CAD terminal.

## Modules

1. **Horizontal Alignment** — superelevation transition (AASHTO Method 5
   approximation), clothoid spiral design, tangent runout / runoff, pavement
   widening, station-by-station cross-section visualizer.
2. **Vertical Alignment** — parabolic crest/sag curves, K-factor design,
   SSD, overhead structure clearance checking.
3. **Interchange / HCM Operations** — merge/diverge influence-area density,
   weaving analysis, signalized ramp-terminal CMA (Webster), D/D/1 queuing,
   with selectable interchange topology schematics (diamond, parclo, SPUI,
   DDI, stack, turbine, TxDOT frontage/U-turn).
4. **Earthwork / Mass-Haul** — average end-area volumes, prismoidal
   correction, shrinkage/swell adjustment, interactive draggable mass-haul
   balance line with free-haul/overhaul segregation.
5. **Pavement SN Design** — 1993 AASHTO flexible pavement empirical
   equation, solved iteratively for required Structural Number, layered
   cross-section diagram.

Every module includes a **Calculation Transparency Drawer** (full
step-by-step proof with substituted values) and exports a print-ready **PE
Calculation Memorandum (PDF)** and **CSV / DXF** alignment data.

## Engineering disclaimer

Empirical coefficient curves (side friction, relative gradient, K-factors,
HCM density-LOS models, etc.) are digitized representative approximations of
published AASHTO Green Book / HCM / TxDOT RDM design values for engineering
education and preliminary design use — not a verbatim reproduction of the
copyrighted exhibits. Verify against the current governing edition and have
a licensed PE review and seal all calculations before PS&E submittal or
construction use.

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm run build   # production build + type-check
npm run lint
```
