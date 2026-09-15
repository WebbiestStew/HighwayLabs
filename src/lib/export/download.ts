export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadCsv(rows: (string | number)[][], filename: string) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(",")
    )
    .join("\n");
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), filename);
}

/** Minimal ASCII DXF (R12) writer: POINT + TEXT entities for alignment stationing. */
export function buildDxf(
  points: { x: number; y: number; z?: number; label?: string }[]
): string {
  const lines: string[] = [];
  const push = (code: number | string, value: string | number) => {
    lines.push(String(code), String(value));
  };
  push(0, "SECTION");
  push(2, "ENTITIES");
  for (const p of points) {
    push(0, "POINT");
    push(8, "ALIGNMENT");
    push(10, p.x.toFixed(4));
    push(20, p.y.toFixed(4));
    push(30, (p.z ?? 0).toFixed(4));
    if (p.label) {
      push(0, "TEXT");
      push(8, "ALIGNMENT-LABELS");
      push(10, p.x.toFixed(4));
      push(20, (p.y + 1).toFixed(4));
      push(30, (p.z ?? 0).toFixed(4));
      push(40, "1.0");
      push(1, p.label);
    }
  }
  push(0, "ENDSEC");
  push(0, "EOF");
  return lines.join("\n");
}

export function downloadDxf(
  points: { x: number; y: number; z?: number; label?: string }[],
  filename: string
) {
  const dxf = buildDxf(points);
  downloadBlob(new Blob([dxf], { type: "application/dxf" }), filename);
}
