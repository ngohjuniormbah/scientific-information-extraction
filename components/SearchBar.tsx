"use client";

import { useState } from "react";
import type { SortBy } from "@/lib/types";

export interface SearchParams {
  query: string;
  yearFrom: number;
  yearTo?: number;
  maxResults: number;
  sortBy: SortBy;
}

export default function SearchBar({
  onSearch,
  loading,
}: {
  onSearch: (p: SearchParams) => void;
  loading: boolean;
}) {
  const [query, setQuery] = useState("");
  const [yearFrom, setYearFrom] = useState(2000);
  const [yearTo, setYearTo] = useState<string>("");
  const [maxResults, setMaxResults] = useState(12);
  const [sortBy, setSortBy] = useState<SortBy>("relevance");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    onSearch({
      query: query.trim(),
      yearFrom,
      yearTo: yearTo ? Number(yearTo) : undefined,
      maxResults,
      sortBy,
    });
  };

  const fieldCls =
    "rounded-lg border border-ink-600 bg-ink-700 px-2.5 py-1.5 text-sm text-ink-100 outline-none focus:border-accent";

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-ink-600 bg-ink-800 p-4 shadow-2xl shadow-black/30"
    >
      <div className="flex gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a topic — e.g. “transformer attention”, “CRISPR off-target”, “dark matter halos”"
          autoComplete="off"
          className="flex-1 rounded-xl border border-ink-600 bg-ink-700 px-4 py-3.5 text-[15px] text-ink-100 outline-none placeholder:text-ink-100/40 focus:border-accent"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-accent px-6 font-semibold text-[#07101f] transition hover:brightness-105 disabled:opacity-60"
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-4 text-[13px] text-ink-100/60">
        <label className="flex items-center gap-1.5">
          From
          <input
            type="number"
            min={2000}
            max={2100}
            value={yearFrom}
            onChange={(e) => setYearFrom(Number(e.target.value))}
            className={`${fieldCls} w-20`}
          />
        </label>
        <label className="flex items-center gap-1.5">
          To
          <input
            type="number"
            min={2000}
            max={2100}
            placeholder="now"
            value={yearTo}
            onChange={(e) => setYearTo(e.target.value)}
            className={`${fieldCls} w-20`}
          />
        </label>
        <label className="flex items-center gap-1.5">
          Results
          <select
            value={maxResults}
            onChange={(e) => setMaxResults(Number(e.target.value))}
            className={fieldCls}
          >
            {[8, 12, 20, 30].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          Sort
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className={fieldCls}
          >
            <option value="relevance">Relevance</option>
            <option value="newest">Newest</option>
            <option value="updated">Recently updated</option>
          </select>
        </label>
      </div>
    </form>
  );
}
