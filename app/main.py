"""FastAPI application wiring the arXiv corpus + Claude agent to a web UI."""
from __future__ import annotations

import json
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import arxiv_client
from . import analyzer

load_dotenv()

app = FastAPI(title="ScholarLens", description="AI agent for analysing scientific papers.")

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"


# ---------- request models ----------


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
    year_from: int = 2000
    year_to: int | None = None
    max_results: int = Field(12, ge=1, le=50)
    sort_by: str = "relevance"


class AnalyzeRequest(BaseModel):
    paper: dict | None = None
    arxiv_id: str | None = None


class ChatTurn(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1)
    papers: list[dict] = Field(default_factory=list)
    history: list[ChatTurn] = Field(default_factory=list)


# ---------- API ----------


@app.get("/api/health")
async def health() -> dict:
    import os

    return {"status": "ok", "model": analyzer.MODEL, "api_key_configured": bool(os.getenv("ANTHROPIC_API_KEY"))}


@app.post("/api/search")
async def search(req: SearchRequest) -> dict:
    try:
        papers = await arxiv_client.search_papers(
            req.query,
            year_from=req.year_from,
            year_to=req.year_to,
            max_results=req.max_results,
            sort_by=req.sort_by,
        )
    except Exception as exc:  # network / parse failures
        raise HTTPException(status_code=502, detail=f"arXiv search failed: {exc}") from exc
    return {"count": len(papers), "papers": papers}


@app.post("/api/analyze")
async def analyze(req: AnalyzeRequest) -> dict:
    paper = req.paper
    if paper is None and req.arxiv_id:
        paper = await arxiv_client.get_paper(req.arxiv_id)
    if not paper:
        raise HTTPException(status_code=400, detail="Provide a paper object or a valid arxiv_id.")
    try:
        analysis = await analyzer.analyze_paper(paper)
    except RuntimeError as exc:  # missing API key
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Analysis failed: {exc}") from exc
    return {"paper": paper, "analysis": analysis}


@app.post("/api/chat")
async def chat(req: ChatRequest) -> StreamingResponse:
    history = [t.model_dump() for t in req.history]

    async def gen():
        try:
            async for chunk in analyzer.stream_chat(req.question, req.papers, history):
                yield f"data: {json.dumps({'text': chunk})}\n\n"
        except RuntimeError as exc:
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'error': f'Chat failed: {exc}'})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream")


# Static UI (mounted last so /api/* takes precedence).
app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
