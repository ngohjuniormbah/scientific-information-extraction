# ScholarLens

An AI agent that searches, reads, and explains **scientific research papers**
published from **2000 to today**, behind a clean web interface.

It pulls real papers from the public [arXiv](https://arxiv.org) corpus and uses
**Claude Opus 4.8** (Anthropic) to produce a rigorous, structured breakdown of
any paper — plus a streaming chat agent you can ask follow-up questions.

## What it does

- **Search** any topic across arXiv, filtered to a year window (default 2000→present).
- **Analyse** a paper into a structured card:
  - one-line TL;DR + a plain-language explainer
  - key contributions, methodology, findings, limitations
  - why it matters, and suggested future work
  - field classification + keywords
- **Chat** with the agent about the paper — answers stream in token-by-token and
  stay grounded in the paper's own claims.

## Architecture

```
Browser (static/ — vanilla HTML/CSS/JS, no build step)
        │  fetch /api/*
        ▼
FastAPI (app/main.py)
   ├── app/arxiv_client.py   → arXiv Atom API (free, no key)
   └── app/analyzer.py       → Anthropic SDK · Claude Opus 4.8
                                · structured outputs for analysis
                                · streaming (SSE) for chat
```

The analysis endpoint uses **structured outputs** (`output_config.format`) so the
model returns schema-valid JSON the UI can render directly. Chat uses
**adaptive thinking** + **streaming** so long answers don't hit request timeouts.

## Quick start

Requires Python 3.10+.

```bash
# 1. Install
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# 2. Configure your Anthropic API key
cp .env.example .env
# edit .env and paste your key

# 3. Run
uvicorn app.main:app --reload
```

Open <http://localhost:8000>.

> Search works without a key. **Analyse** and **Chat** require `ANTHROPIC_API_KEY`.
> Check configuration at <http://localhost:8000/api/health>.

## Deploy (Render or Railway)

This is a normal long-running ASGI server, so it deploys cleanly on any host
that runs a persistent process. Streaming chat (SSE) works fully.

**Render** (one-click via the included `render.yaml` blueprint):

1. Push this repo to GitHub.
2. In Render: **New → Blueprint**, pick this repo. It reads `render.yaml`
   (build, start command, health check, Python version).
3. Set **`ANTHROPIC_API_KEY`** in the service's Environment settings.
4. Create. Render builds and serves it.

**Railway:**

1. **New Project → Deploy from GitHub repo**, pick this repo.
2. Railway detects Python and uses the included `Procfile` to start it.
3. Add **`ANTHROPIC_API_KEY`** under Variables. Deploy.

Both bind to the platform-provided `$PORT` automatically (see `Procfile` /
`render.yaml`). The start command is:

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

## API

| Method | Path           | Purpose                                            |
| ------ | -------------- | -------------------------------------------------- |
| POST   | `/api/search`  | Search arXiv: `{query, year_from, year_to, max_results, sort_by}` |
| POST   | `/api/analyze` | Structured analysis: `{paper}` or `{arxiv_id}`     |
| POST   | `/api/chat`    | Streaming Q&A (SSE): `{question, papers, history}` |
| GET    | `/api/health`  | Status + whether the API key is configured         |

## Notes & extensions

- The agent currently grounds analysis on each paper's **abstract and metadata**
  (what arXiv returns). To analyse full text, download the PDF and pass it to
  Claude via the Files API / document blocks — `analyzer.py` is the place to add it.
- Swap the model by editing `MODEL` in `app/analyzer.py`.
- The corpus is arXiv; other sources (Semantic Scholar, PubMed) can be added as
  new clients alongside `arxiv_client.py`.

## License

MIT
