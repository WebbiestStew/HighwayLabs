import { NextResponse } from "next/server";
import { latexToSvg } from "@/lib/export/latexServer";

const MAX_LATEX_LENGTH = 2000;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const latex = (body as { latex?: unknown })?.latex;
  if (typeof latex !== "string" || latex.length === 0 || latex.length > MAX_LATEX_LENGTH) {
    return NextResponse.json({ error: "`latex` must be a non-empty string" }, { status: 400 });
  }

  const result = latexToSvg(latex);
  if (!result) {
    return NextResponse.json({ error: "Could not render formula" }, { status: 422 });
  }
  return NextResponse.json(result);
}
