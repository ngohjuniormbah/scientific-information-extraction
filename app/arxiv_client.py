"""Thin client over the public arXiv API.

The arXiv Atom API is free and needs no key. We use it as the corpus of
scientific papers and filter results to the requested year window
(default: 2000 → present).
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass, asdict
from datetime import datetime, timezone

import feedparser
import httpx

ARXIV_ENDPOINT = "http://export.arxiv.org/api/query"
# arXiv asks callers to identify themselves and to be gentle with the API.
_USER_AGENT = "ScholarLens/0.1 (research-paper-analysis-agent)"


@dataclass
class Paper:
    id: str
    title: str
    authors: list[str]
    summary: str
    published: str  # ISO date
    year: int
    updated: str
    pdf_url: str
    abs_url: str
    categories: list[str]
    primary_category: str

    def to_dict(self) -> dict:
        return asdict(self)


def _entry_to_paper(entry) -> Paper | None:
    published = entry.get("published", "")
    try:
        year = int(published[:4])
    except (ValueError, TypeError):
        return None

    arxiv_id = entry.get("id", "")
    # entry.id looks like http://arxiv.org/abs/2401.01234v1 — keep the bare id.
    short_id = arxiv_id.rsplit("/abs/", 1)[-1] if "/abs/" in arxiv_id else arxiv_id

    pdf_url = ""
    for link in entry.get("links", []):
        if link.get("type") == "application/pdf":
            pdf_url = link.get("href", "")
    if not pdf_url and short_id:
        pdf_url = f"https://arxiv.org/pdf/{short_id}"

    categories = [t.get("term", "") for t in entry.get("tags", []) if t.get("term")]

    return Paper(
        id=short_id,
        title=" ".join(entry.get("title", "").split()),
        authors=[a.get("name", "") for a in entry.get("authors", [])],
        summary=" ".join(entry.get("summary", "").split()),
        published=published,
        year=year,
        updated=entry.get("updated", published),
        pdf_url=pdf_url,
        abs_url=arxiv_id,
        categories=categories,
        primary_category=categories[0] if categories else "",
    )


async def search_papers(
    query: str,
    *,
    year_from: int = 2000,
    year_to: int | None = None,
    max_results: int = 12,
    sort_by: str = "relevance",
) -> list[dict]:
    """Search arXiv and return papers within the [year_from, year_to] window."""
    year_to = year_to or datetime.now(timezone.utc).year
    # Over-fetch so that year filtering still leaves a useful number of results.
    fetch = min(max(max_results * 3, 30), 100)

    sort_map = {
        "relevance": "relevance",
        "newest": "submittedDate",
        "updated": "lastUpdatedDate",
    }
    params = {
        "search_query": f"all:{query}",
        "start": 0,
        "max_results": fetch,
        "sortBy": sort_map.get(sort_by, "relevance"),
        "sortOrder": "descending",
    }

    async with httpx.AsyncClient(timeout=30, headers={"User-Agent": _USER_AGENT}) as client:
        resp = await client.get(ARXIV_ENDPOINT, params=params)
        resp.raise_for_status()
        raw = resp.text

    # feedparser is synchronous CPU work; keep the event loop responsive.
    feed = await asyncio.to_thread(feedparser.parse, raw)

    papers: list[dict] = []
    for entry in feed.entries:
        paper = _entry_to_paper(entry)
        if paper is None:
            continue
        if year_from <= paper.year <= year_to:
            papers.append(paper.to_dict())
        if len(papers) >= max_results:
            break
    return papers


async def get_paper(arxiv_id: str) -> dict | None:
    """Fetch a single paper by its arXiv id."""
    params = {"id_list": arxiv_id, "max_results": 1}
    async with httpx.AsyncClient(timeout=30, headers={"User-Agent": _USER_AGENT}) as client:
        resp = await client.get(ARXIV_ENDPOINT, params=params)
        resp.raise_for_status()
        raw = resp.text

    feed = await asyncio.to_thread(feedparser.parse, raw)
    if not feed.entries:
        return None
    paper = _entry_to_paper(feed.entries[0])
    return paper.to_dict() if paper else None
