// Server-only: converts a LaTeX formula string to a standalone SVG string
// using MathJax's SVG output (pure vector <path>/<use> glyphs — real
// typeset math for the PE memorandum PDF, not plain monospace text).
//
// This must run server-side (called from the /api/render-formula route
// handler) rather than in the browser: mathjax-full ships plain CommonJS
// with literal `require()` calls throughout its module graph, which Next.js
// (Turbopack, even with transpilePackages) does not reliably rewrite for a
// client bundle — it throws "require is not defined" at runtime in the
// browser. A Node.js server runtime (this file's actual home) has real
// `require` natively, so the exact same code just works there.

import { mathjax } from "mathjax-full/js/mathjax.js";
import { TeX } from "mathjax-full/js/input/tex.js";
import { SVG } from "mathjax-full/js/output/svg.js";
import { liteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "mathjax-full/js/handlers/html.js";
import { AllPackages } from "mathjax-full/js/input/tex/AllPackages.js";

let mathDocument: ReturnType<typeof mathjax.document> | null = null;
function getMathDocument() {
  if (mathDocument) return mathDocument;
  const adaptor = liteAdaptor();
  RegisterHTMLHandler(adaptor);
  const tex = new TeX({ packages: AllPackages });
  const svg = new SVG({ fontCache: "local" });
  mathDocument = mathjax.document("", { InputJax: tex, OutputJax: svg });
  return mathDocument;
}

export interface FormulaSvg {
  svgString: string;
  widthPx: number;
  heightPx: number;
}

/**
 * Converts a LaTeX string to a standalone, explicitly-sized SVG string.
 * Returns null on an unexpected MathJax output shape.
 */
export function latexToSvg(latex: string): FormulaSvg | null {
  try {
    const doc = getMathDocument();
    const node = doc.convert(latex, { display: true });
    const adaptor = doc.adaptor;
    let svgString = adaptor.outerHTML(node);

    // MathJax's lite adaptor emits <mjx-container><svg>...; the caller only
    // needs the inner <svg>, and we need explicit pixel dimensions (MathJax
    // sizes it in "ex" units, meaningless outside a real document).
    const svgMatch = svgString.match(/<svg[\s\S]*<\/svg>/);
    if (!svgMatch) return null;
    svgString = svgMatch[0];

    const widthExMatch = svgString.match(/width="([\d.]+)ex"/);
    const heightExMatch = svgString.match(/height="([\d.]+)ex"/);
    const widthEx = widthExMatch ? parseFloat(widthExMatch[1]) : 10;
    const heightEx = heightExMatch ? parseFloat(heightExMatch[1]) : 3;
    const exPx = 8; // 1ex ~= 8px at a comfortable base formula size
    const widthPx = Math.max(1, Math.ceil(widthEx * exPx));
    const heightPx = Math.max(1, Math.ceil(heightEx * exPx));

    svgString = svgString
      .replace(/width="[\d.]+ex"/, `width="${widthPx}"`)
      .replace(/height="[\d.]+ex"/, `height="${heightPx}"`);
    if (!svgString.includes("xmlns=")) {
      svgString = svgString.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
    }

    return { svgString, widthPx, heightPx };
  } catch {
    return null;
  }
}
