"use client";

import { useState } from "react";
import type { Analysis, Paper } from "@/lib/types";
import SearchBar, { SearchParams } from "@/components/SearchBar";
import PaperCard from "@/components/PaperCard";
import AnalysisPanel from "@/components/AnalysisPanel";

export default function Home() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const [current, setCurrent] = useState<Paper | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  async function handleSearch(p: SearchParams) {
    setSearching(true);
    setSearchError(null);
    setSearched(true);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setPapers(data.papers);
    } catch (err: any) {
      setSearchError(err?.message ?? "Search failed");
      setPapers([]);
    } finally {
      setSearching(false);
    }
  }

  async function handleAnalyse(paper: Paper) {
    setCurrent(paper);
    setAnalysis(null);
    setAnalysisError(null);
    setAnalysing(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paper }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setAnalysis(data.analysis);
    } catch (err: any) {
      setAnalysisError(err?.message ?? "Analysis failed");
    } finally {
      setAnalysing(false);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-ink-600 px-6 py-5 sm:px-8">
        <div className="flex items-center gap-4">
          <span className="text-3xl leading-none text-accent-warm">◑</span>
          <div>
            <h1 className="font-display text-2xl tracking-tight">ScholarLens</h1>
            <p className="mt-0.5 text-[13px] text-ink-100/55">
              An AI agent that reads and explains scientific papers — 2000 to today.
            </p>
          </div>
        </div>
        <a
          href="https://arxiv.org"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-ink-600 px-3 py-1.5 text-[13px] text-ink-100/55 hover:text-ink-100"
        >
          corpus: arXiv
        </a>
      </header>

      <main className="mx-auto max-w-7xl px-6 pb-16 pt-7 sm:px-8">
        <SearchBar onSearch={handleSearch} loading={searching} />

        <div className="mt-6 flex flex-col items-start gap-6 lg:flex-row">
          <section className="grid min-w-0 flex-1 gap-4">
            {searching && (
              <p className="py-8 text-center text-ink-100/55">
                Pulling papers from arXiv…
              </p>
            )}
            {searchError && (
              <div className="rounded-xl border border-[#5a3a2a] bg-[#2a1d18] px-4 py-3 text-[13.5px] text-[#f0c9b4]">
                {searchError}
              </div>
            )}
            {!searching && !searchError && papers.length === 0 && (
              <p className="px-6 py-10 text-center text-ink-100/55">
                {searched
                  ? "No papers found in that year range. Try broadening it."
                  : "Search above to pull papers from arXiv, then click Analyse to have the agent break one down."}
              </p>
            )}
            {papers.map((paper) => (
              <PaperCard
                key={paper.id}
                paper={paper}
                onAnalyse={handleAnalyse}
                analysing={analysing && current?.id === paper.id}
                active={current?.id === paper.id}
              />
            ))}
          </section>

          {current && (
            <AnalysisPanel
              paper={current}
              analysis={analysis}
              loading={analysing}
              error={analysisError}
              onClose={() => setCurrent(null)}
            />
          )}
        </div>
      </main>
    </div>
  );
}
