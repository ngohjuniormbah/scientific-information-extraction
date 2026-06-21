import { NextRequest, NextResponse } from "next/server";
import { analyzePaper, getClient } from "@/lib/anthropic";
import { getPaper } from "@/lib/arxiv";
import type { Paper } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  let paper: Paper | null = body?.paper ?? null;
  if (!paper && body?.arxivId) {
    try {
      paper = await getPaper(String(body.arxivId));
    } catch (err: any) {
      return NextResponse.json(
        { error: `Could not fetch paper: ${err?.message}` },
        { status: 502 },
      );
    }
  }
  if (!paper) {
    return NextResponse.json(
      { error: "Provide a paper object or a valid arxivId." },
      { status: 400 },
    );
  }

  // Surface a clear message when the key is missing, before calling the model.
  try {
    getClient();
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 503 });
  }

  try {
    const analysis = await analyzePaper(paper);
    return NextResponse.json({ paper, analysis });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Analysis failed: ${err?.message ?? "unknown error"}` },
      { status: 502 },
    );
  }
}
