import type { MemoImage } from "./memo";

/** Rasterizes an on-page <canvas> element (already drawn) into a memo image. */
export function captureCanvasImage(canvas: HTMLCanvasElement | null, label: string): MemoImage | null {
  if (!canvas || canvas.width === 0 || canvas.height === 0) return null;
  try {
    return {
      label,
      dataUrl: canvas.toDataURL("image/png"),
      widthPx: canvas.width,
      heightPx: canvas.height,
    };
  } catch {
    return null;
  }
}

/** Rasterizes an inline SVG (e.g. a Recharts chart) into a memo image via an offscreen canvas. */
export async function captureSvgImage(svg: SVGSVGElement | null, label: string, scale = 2): Promise<MemoImage | null> {
  if (!svg) return null;
  try {
    const rect = svg.getBoundingClientRect();
    const widthPx = Math.max(1, Math.round(rect.width * scale));
    const heightPx = Math.max(1, Math.round(rect.height * scale));

    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("width", String(rect.width));
    clone.setAttribute("height", String(rect.height));
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    // Recharts text/lines rely on currentColor / CSS classes that won't resolve
    // off-DOM; bake a dark background so the raster isn't transparent-on-white.
    const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bg.setAttribute("width", "100%");
    bg.setAttribute("height", "100%");
    bg.setAttribute("fill", "#0f1115");
    clone.insertBefore(bg, clone.firstChild);

    const svgString = new XMLSerializer().serializeToString(clone);
    const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;

    const img = new Image();
    const loaded = new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("SVG rasterization failed"));
    });
    img.src = svgDataUrl;
    await loaded;

    const canvas = document.createElement("canvas");
    canvas.width = widthPx;
    canvas.height = heightPx;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, widthPx, heightPx);

    return { label, dataUrl: canvas.toDataURL("image/png"), widthPx, heightPx };
  } catch {
    return null;
  }
}

/** Convenience: find a canvas by a data-capture attribute within a container ref. */
export function findCanvas(container: HTMLElement | null, selector = "canvas"): HTMLCanvasElement | null {
  return container?.querySelector<HTMLCanvasElement>(selector) ?? null;
}
export function findSvg(container: HTMLElement | null, selector = "svg"): SVGSVGElement | null {
  return container?.querySelector<SVGSVGElement>(selector) ?? null;
}
