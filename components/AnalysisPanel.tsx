"use client";

import type { Analysis, Paper } from "@/lib/types";
import Spinner from "./Spinner";
import ChatBox from "./ChatBox";

function ListSection({ title, items }: { title: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <section className="mb-4">
      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-accent-warm">
        {title}
      </h4>
      <ul className="list-disc space-y-1.5 pl-5 marker:text-ink-100/40">
        {items.map((x, i) => (
          <li key={i} className="text-[13.5px] leading-relaxed text-ink-100/85">
            {x}
          </li>
        ))}
      </ul>
    </section>
  );
}

function TextSection({ title, text }: { title: string; text: string }) {
  if (!text) return null;
  return (
    <section className="mb-4">
      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-accent-warm">
        {title}
      </h4>
      <p className="text-sm leading-relaxed text-ink-100/85">{text}</p>
    </section>
  );
}

export default function AnalysisPanel({
  paper,
  analysis,
  loading,
  error,
  onClose,
}: {
  paper: Paper;
  analysis: Analysis | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  return (
    <aside className="animate-fade-up sticky top-5 max-h-[calc(100vh-2.5rem)] w-full shrink-0 overflow-y-auto rounded-2xl border border-ink-600 bg-ink-800 p-5 shadow-2xl shadow-black/30 lg:w-[460px]">
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-3.5 text-xl leading-none text-ink-100/50 hover:text-ink-100"
      >
        ×
      </button>

      <h2 className="mr-8 font-display text-xl leading-snug">{paper.title}</h2>
      <p className="mb-4 mt-1 text-[12.5px] text-ink-100/55">
        {paper.authors.slice(0, 6).join(", ")} · {paper.year}
        {analysis?.field ? ` · ${analysis.field}` : ` · ${paper.primaryCategory}`}
      </p>

      {loading && (
        <p className="py-5 text-sm text-ink-100/60">
          <Spinner className="mr-2" />
          ScholarLens is reading the paper…
        </p>
      )}

      {error && (
        <div className="rounded-xl border border-[#5a3a2a] bg-[#2a1d18] px-4 py-3 text-[13.5px] text-[#f0c9b4]">
          {error}
        </div>
      )}

      {analysis && (
        <>
          <div className="mb-4 rounded-xl border border-ink-600 border-l-[3px] border-l-accent bg-gradient-to-b from-[#1d2533] to-[#1a212d] px-4 py-3.5 text-[14.5px] leading-relaxed">
            {analysis.tldr}
          </div>

          <TextSection title="In plain language" text={analysis.plainLanguage} />
          <ListSection title="Key contributions" items={analysis.keyContributions} />
          <TextSection title="Methodology" text={analysis.methodology} />
          <ListSection title="Findings" items={analysis.findings} />
          <ListSection title="Limitations" items={analysis.limitations} />
          <TextSection title="Why it matters" text={analysis.significance} />
          <ListSection title="Future work" items={analysis.futureWork} />

          {analysis.keywords?.length > 0 && (
            <section className="mb-1">
              <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-accent-warm">
                Keywords
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {analysis.keywords.map((k, i) => (
                  <span
                    key={i}
                    className="rounded-full border border-ink-600 bg-ink-700 px-2 py-0.5 text-[11px] text-ink-100/60"
                  >
                    {k}
                  </span>
                ))}
              </div>
            </section>
          )}

          <ChatBox paper={paper} />
        </>
      )}
    </aside>
  );
}
