import { describe, it, expect } from "vitest";
import { POST } from "./route";

function postRequest(body: unknown): Request {
  return new Request("http://localhost/api/render-formula", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/render-formula", () => {
  it("renders a valid LaTeX formula to SVG with pixel dimensions", async () => {
    const res = await POST(postRequest({ latex: "R_{min} = \\frac{V^2}{15}" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.svgString).toContain("<svg");
    expect(json.widthPx).toBeGreaterThan(0);
    expect(json.heightPx).toBeGreaterThan(0);
  });

  it("rejects a missing latex field", async () => {
    const res = await POST(postRequest({}));
    expect(res.status).toBe(400);
  });

  it("rejects a non-string latex field", async () => {
    const res = await POST(postRequest({ latex: 12345 }));
    expect(res.status).toBe(400);
  });

  it("rejects an oversized latex payload", async () => {
    const res = await POST(postRequest({ latex: "x".repeat(5000) }));
    expect(res.status).toBe(400);
  });

  it("rejects invalid JSON", async () => {
    const res = await POST(
      new Request("http://localhost/api/render-formula", { method: "POST", body: "not json" })
    );
    expect(res.status).toBe(400);
  });
});
