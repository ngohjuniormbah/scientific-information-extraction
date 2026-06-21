"use client";

import type { Paper } from "@/lib/types";

export default function PaperCard({
  paper,
  onAnalyse,
  analysing,
  active,
}: {
  paper: Paper;
  onAnalyse: (p: Paper) => void;
  analysing: boolean;
  active: boolean;
}) {
  const authors =
    paper.authors.slice(0, 4).join(", ") +
    (paper.authors.length > 4 ? " et al." : "");

  return (
    <article
      className={`rounded-2xl border bg-ink-800 p-5 transition hover:-translate-y-0.5 ${
        active ? "border-accent" : "border-ink-600 hover:border-accent/60"
      }`}
    >
      <h3 className="font-display text-lg leading-snug">{paper.title}</h3>
      <p className="mt-1.5 text-xs text-ink-100/55">
        {authors} · {paper.year} · {paper.primaryCategory}
      </p>
      <p className="mt-2.5 line-clamp-3 text-[13.5px] leading-relaxed text-ink-100/75">
        {paper.summary}
      </p>
      <div className="mt-3.5 flex items-center gap-3.5">
        <button
          onClick={() => onAnalyse(paper)}
          disabled={analysing}
          className="rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-[#07101f] transition hover:brightness-105 disabled:cursor-wait disabled:opacity-60"
        >
          {analysing ? "Analysing…" : "Analyse"}
        </button>
        <a
          href={paper.pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[12.5px] text-ink-100/55 hover:text-ink-100"
        >
          PDF ↗
        </a>
      </div>
    </article>
  );
}
