import { describe, it, expect } from "vitest";
import { latexToSvg } from "./latexServer";

describe("latexToSvg", () => {
  it("converts a simple AASHTO-style formula to a well-formed, explicitly-sized SVG", () => {
    const result = latexToSvg("R_{min} = \\frac{V^2}{15(0.01 e_{max} + f_{max})}");
    expect(result).not.toBeNull();
    expect(result!.svgString).toContain("<svg");
    expect(result!.svgString).toContain("</svg>");
    expect(result!.svgString).toContain('xmlns="http://www.w3.org/2000/svg"');
    // Dimensions must be plain pixel numbers (no leftover "ex" units), since
    // the caller needs them to size a jsPDF image placement.
    expect(result!.svgString).not.toMatch(/width="[\d.]+ex"/);
    expect(result!.svgString).not.toMatch(/height="[\d.]+ex"/);
    expect(result!.widthPx).toBeGreaterThan(0);
    expect(result!.heightPx).toBeGreaterThan(0);
  });

  it("produces different output for different formulas", () => {
    const a = latexToSvg("SSD = 1.47Vt + \\frac{V^2}{30(a/32.2)}");
    const b = latexToSvg("e_d = e_{max}\\left[\\frac{1/R - 1/R_0}{1/R_{min} - 1/R_0}\\right]^{1.5}");
    expect(a!.svgString).not.toEqual(b!.svgString);
  });

  it("does not throw on malformed LaTeX — MathJax renders a visible error glyph rather than failing", () => {
    const result = latexToSvg("\\frac{1}{");
    // MathJax's TeX input is lenient by default (renders an error marker
    // inline) rather than failing outright, so this should still produce valid SVG.
    expect(result).not.toBeNull();
    expect(result!.svgString).toContain("<svg");
  });
});
