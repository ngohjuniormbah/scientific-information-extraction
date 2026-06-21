import { XMLParser } from "fast-xml-parser";
import type { Paper, SortBy } from "./types";

const ARXIV_ENDPOINT = "http://export.arxiv.org/api/query";
const USER_AGENT = "ScholarLens/0.1 (research-paper-analysis-agent)";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

// fast-xml-parser collapses single-element arrays to a scalar; normalise.
function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function clean(text: unknown): string {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function entryToPaper(entry: any): Paper | null {
  const published = String(entry.published ?? "");
  const year = parseInt(published.slice(0, 4), 10);
  if (Number.isNaN(year)) return null;

  const rawId = String(entry.id ?? "");
  const shortId = rawId.includes("/abs/") ? rawId.split("/abs/").pop()! : rawId;

  const links = asArray<any>(entry.link);
  let pdfUrl =
    links.find((l) => l["@_type"] === "application/pdf")?.["@_href"] ?? "";
  if (!pdfUrl && shortId) pdfUrl = `https://arxiv.org/pdf/${shortId}`;

  const categories = asArray<any>(entry.category)
    .map((c) => c["@_term"])
    .filter(Boolean);

  const authors = asArray<any>(entry.author)
    .map((a) => clean(a.name))
    .filter(Boolean);

  return {
    id: shortId,
    title: clean(entry.title),
    authors,
    summary: clean(entry.summary),
    published,
    year,
    updated: String(entry.updated ?? published),
    pdfUrl,
    absUrl: rawId,
    categories,
    primaryCategory: categories[0] ?? "",
  };
}

export interface SearchOptions {
  yearFrom?: number;
  yearTo?: number;
  maxResults?: number;
  sortBy?: SortBy;
}

const SORT_MAP: Record<SortBy, string> = {
  relevance: "relevance",
  newest: "submittedDate",
  updated: "lastUpdatedDate",
};

export async function searchPapers(
  query: string,
  opts: SearchOptions = {},
): Promise<Paper[]> {
  const yearFrom = opts.yearFrom ?? 2000;
  const yearTo = opts.yearTo ?? new Date().getFullYear();
  const maxResults = Math.min(Math.max(opts.maxResults ?? 12, 1), 50);
  const sortBy = opts.sortBy ?? "relevance";

  // Over-fetch so year filtering still leaves a useful number of results.
  const fetchCount = Math.min(Math.max(maxResults * 3, 30), 100);

  const params = new URLSearchParams({
    search_query: `all:${query}`,
    start: "0",
    max_results: String(fetchCount),
    sortBy: SORT_MAP[sortBy],
    sortOrder: "descending",
  });

  const res = await fetch(`${ARXIV_ENDPOINT}?${params.toString()}`, {
    headers: { "User-Agent": USER_AGENT },
    // arXiv data is fairly static; cache briefly to be gentle with the API.
    next: { revalidate: 300 },
  });
  if (!res.ok) {
    throw new Error(`arXiv responded ${res.status}`);
  }
  const xml = await res.text();
  const parsed = parser.parse(xml);

  const entries = asArray<any>(parsed?.feed?.entry);
  const papers: Paper[] = [];
  for (const entry of entries) {
    const paper = entryToPaper(entry);
    if (!paper) continue;
    if (paper.year >= yearFrom && paper.year <= yearTo) papers.push(paper);
    if (papers.length >= maxResults) break;
  }
  return papers;
}

export async function getPaper(arxivId: string): Promise<Paper | null> {
  const params = new URLSearchParams({ id_list: arxivId, max_results: "1" });
  const res = await fetch(`${ARXIV_ENDPOINT}?${params.toString()}`, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) throw new Error(`arXiv responded ${res.status}`);
  const parsed = parser.parse(await res.text());
  const entry = asArray<any>(parsed?.feed?.entry)[0];
  return entry ? entryToPaper(entry) : null;
}
