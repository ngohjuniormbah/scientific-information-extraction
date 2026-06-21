import { NextRequest, NextResponse } from "next/server";
import { searchPapers } from "@/lib/arxiv";
import type { SortBy } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const query = String(body?.query ?? "").trim();
  if (!query) {
    return NextResponse.json({ error: "A search query is required." }, { status: 400 });
  }

  try {
    const papers = await searchPapers(query, {
      yearFrom: Number(body?.yearFrom) || 2000,
      yearTo: body?.yearTo ? Number(body.yearTo) : undefined,
      maxResults: Number(body?.maxResults) || 12,
      sortBy: (body?.sortBy as SortBy) || "relevance",
    });
    return NextResponse.json({ count: papers.length, papers });
  } catch (err: any) {
    return NextResponse.json(
      { error: `arXiv search failed: ${err?.message ?? "unknown error"}` },
      { status: 502 },
    );
  }
}
