// Renders a LaTeX formula string to a rasterized PNG for embedding in the PE
// memorandum PDF, so the governing AASHTO/HCM formulas appear real
// typeset — not monospace plain text.
//
// The LaTeX -> SVG conversion (MathJax) happens server-side via
// /api/render-formula — see src/lib/export/latexServer.ts for why (mathjax-full
// ships plain CommonJS with literal require() calls that a browser bundle
// can't run). This module only does the browser-side half: take that SVG
// and rasterize it to a PNG via an offscreen canvas.
//
// KaTeX was considered first for the whole pipeline and rejected: it renders
// to styled HTML that needs an <svg><foreignObject> wrapper to rasterize,
// and Chrome does not paint foreignObject content inside an SVG loaded via
// `new Image().src = "data:image/svg+xml,..."` — a well-known trap for
// exactly this "formula to PDF image" pipeline. MathJax's pure SVG paths
// sidestep that entirely and rasterize reliably via canvas.

export interface RenderedFormula {
  dataUrl: string; // PNG data URL
  widthPx: number;
  heightPx: number;
}

/**
 * Converts a LaTeX string to a PNG data URL. Returns null on any failure
 * (malformed LaTeX, network error, non-browser environment, canvas
 * unavailable) — this is a typesetting nicety, and the caller must fall
 * back to plain text rather than let a bad formula string break memo
 * generation.
 */
export async function renderLatexToPng(latex: string, scale = 4): Promise<RenderedFormula | null> {
  if (typeof document === "undefined") return null;
  try {
    const res = await fetch("/api/render-formula", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latex }),
    });
    if (!res.ok) return null;
    const { svgString, widthPx, heightPx } = (await res.json()) as { svgString: string; widthPx: number; heightPx: number };

    const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
    const img = new Image();
    const loaded = new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Formula rasterization failed"));
    });
    img.src = svgDataUrl;
    await loaded;

    const canvas = document.createElement("canvas");
    canvas.width = widthPx * scale;
    canvas.height = heightPx * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    return { dataUrl: canvas.toDataURL("image/png"), widthPx: canvas.width, heightPx: canvas.height };
  } catch {
    return null;
  }
}
