# ScholarLens

An AI agent that searches, reads, and explains **scientific research papers**
from **2000 to today**, behind a clean web interface. Built with **Next.js +
TypeScript + Tailwind** and deployable to **Vercel** in one click.

It pulls real papers from the public [arXiv](https://arxiv.org) corpus and uses
**Claude Opus 4.8** (Anthropic) to produce a rigorous, structured breakdown of
any paper, plus a streaming chat agent for follow-up questions.

## What it does

- **Search** any topic across arXiv, filtered to a year window (default 2000→present).
- **Analyse** a paper into a structured card — TL;DR, plain-language explainer,
  key contributions, methodology, findings, limitations, significance, future
  work, field + keywords.
- **Chat** with the agent about the paper — answers stream in token-by-token and
  stay grounded in the paper's own claims.

## Tech / architecture

```
Next.js App Router (TypeScript, Tailwind)
├── app/page.tsx + components/      → React UI (client components)
├── app/api/search/route.ts         → arXiv search (fast-xml-parser)
├── app/api/analyze/route.ts        → Claude · structured outputs (JSON schema)
├── app/api/chat/route.ts           → Claude · streaming (SSE ReadableStream)
└── lib/
    ├── arxiv.ts                    → arXiv Atom API client (no key)
    └── anthropic.ts                → Anthropic SDK · Claude Opus 4.8
```

- **Analysis** uses Claude **structured outputs** (`output_config.format`) so the
  model returns schema-valid JSON the UI renders directly.
- **Chat** uses **adaptive thinking** + **streaming**, piped through a Next.js
  Edge-style `ReadableStream` as Server-Sent Events.
- API routes run on the Node.js runtime with `maxDuration` raised for model calls.

## Run locally

Requires Node 18.18+ (Node 20 recommended).

```bash
npm install
cp .env.example .env.local      # add your ANTHROPIC_API_KEY
npm run dev                     # http://localhost:3000
```

Search works without a key. **Analyse** and **Chat** require `ANTHROPIC_API_KEY`.

## Deploy to Vercel

1. Push this repo to GitHub (already set up if you're reading this on GitHub).
2. In Vercel, **New Project → Import** this repo. Framework preset: **Next.js**
   (auto-detected). No build settings to change.
3. Add an environment variable **`ANTHROPIC_API_KEY`** in
   *Project → Settings → Environment Variables*.
4. Deploy. That's it.

> Model calls can take longer than the default serverless timeout on the Hobby
> plan. The analyze/chat routes set `maxDuration = 60`; if you hit timeouts,
> Vercel's Fluid Compute / Pro plan allows longer durations.

## Notes & extensions

- The agent grounds analysis on each paper's **abstract and metadata** (what
  arXiv returns). To analyse full text, fetch the PDF and pass it to Claude via
  document blocks — `lib/anthropic.ts` is the place to add it.
- Swap the model via `MODEL` in `lib/anthropic.ts`.
- Add other corpora (Semantic Scholar, PubMed) as new clients alongside `lib/arxiv.ts`.

## License

MIT
