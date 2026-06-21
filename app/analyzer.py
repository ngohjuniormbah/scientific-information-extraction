"""The AI agent — Claude-powered analysis of scientific papers.

Uses the Anthropic Python SDK with Claude Opus 4.8. Two capabilities:

  * ``analyze_paper``  — structured, schema-validated breakdown of a paper.
  * ``stream_chat``    — a streaming Q&A agent grounded in selected papers.
"""
from __future__ import annotations

import os
from typing import AsyncIterator

import anthropic

MODEL = "claude-opus-4-8"

# JSON schema the analysis must conform to. Structured outputs guarantee the
# first text block is valid JSON matching this shape, so the UI can render it
# without defensive parsing.
ANALYSIS_SCHEMA = {
    "type": "object",
    "properties": {
        "tldr": {"type": "string"},
        "plain_language": {"type": "string"},
        "key_contributions": {"type": "array", "items": {"type": "string"}},
        "methodology": {"type": "string"},
        "findings": {"type": "array", "items": {"type": "string"}},
        "limitations": {"type": "array", "items": {"type": "string"}},
        "significance": {"type": "string"},
        "future_work": {"type": "array", "items": {"type": "string"}},
        "field": {"type": "string"},
        "keywords": {"type": "array", "items": {"type": "string"}},
    },
    "required": [
        "tldr",
        "plain_language",
        "key_contributions",
        "methodology",
        "findings",
        "limitations",
        "significance",
        "future_work",
        "field",
        "keywords",
    ],
    "additionalProperties": False,
}

_ANALYST_SYSTEM = (
    "You are ScholarLens, an expert research analyst. You read scientific "
    "papers and explain them rigorously but accessibly. Ground every statement "
    "in the provided text; never invent results that are not supported by it. "
    "When the abstract is all you have, reason from it carefully and say so "
    "rather than fabricating specifics."
)

_CHAT_SYSTEM = (
    "You are ScholarLens, a research assistant agent. You answer questions "
    "about the scientific paper(s) the user is viewing. Be precise, cite the "
    "paper's own claims, and distinguish what the paper states from your own "
    "inference. If something isn't covered by the provided material, say so."
)


def _client() -> anthropic.AsyncAnthropic:
    if not os.getenv("ANTHROPIC_API_KEY"):
        raise RuntimeError(
            "ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key."
        )
    return anthropic.AsyncAnthropic()


def _paper_block(paper: dict) -> str:
    authors = ", ".join(paper.get("authors", [])) or "Unknown"
    return (
        f"Title: {paper.get('title', '')}\n"
        f"Authors: {authors}\n"
        f"Year: {paper.get('year', '')}\n"
        f"Category: {paper.get('primary_category', '')}\n"
        f"arXiv id: {paper.get('id', '')}\n\n"
        f"Abstract:\n{paper.get('summary', '')}"
    )


async def analyze_paper(paper: dict) -> dict:
    """Return a structured analysis of a single paper as a dict."""
    client = _client()
    prompt = (
        "Analyse the following scientific paper and produce a structured "
        "breakdown. Write the plain_language field for an interested "
        "non-specialist.\n\n"
        f"{_paper_block(paper)}"
    )

    # Stream to stay under HTTP timeouts on long reasoning, then take the
    # accumulated final message.
    async with client.messages.stream(
        model=MODEL,
        max_tokens=8000,
        system=_ANALYST_SYSTEM,
        thinking={"type": "adaptive"},
        output_config={"format": {"type": "json_schema", "schema": ANALYSIS_SCHEMA}},
        messages=[{"role": "user", "content": prompt}],
    ) as stream:
        message = await stream.get_final_message()

    import json

    text = next((b.text for b in message.content if b.type == "text"), "{}")
    return json.loads(text)


async def stream_chat(
    question: str,
    papers: list[dict],
    history: list[dict] | None = None,
) -> AsyncIterator[str]:
    """Stream a grounded answer to a question about the given papers."""
    client = _client()

    context = "\n\n---\n\n".join(_paper_block(p) for p in papers) if papers else ""
    grounding = (
        f"You are currently discussing the following paper(s):\n\n{context}\n\n"
        if context
        else ""
    )

    messages: list[dict] = []
    for turn in history or []:
        role = "assistant" if turn.get("role") == "assistant" else "user"
        messages.append({"role": role, "content": turn.get("content", "")})
    messages.append({"role": "user", "content": f"{grounding}Question: {question}"})

    async with client.messages.stream(
        model=MODEL,
        max_tokens=4000,
        system=_CHAT_SYSTEM,
        thinking={"type": "adaptive"},
        messages=messages,
    ) as stream:
        async for text in stream.text_stream:
            yield text
