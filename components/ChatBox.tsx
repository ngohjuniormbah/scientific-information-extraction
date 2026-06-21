"use client";

import { useRef, useState } from "react";
import type { ChatTurn, Paper } from "@/lib/types";
import Spinner from "./Spinner";

export default function ChatBox({ paper }: { paper: Paper }) {
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const scrollDown = () => {
    requestAnimationFrame(() => {
      logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
    });
  };

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || streaming) return;
    setInput("");

    const priorHistory = history;
    setHistory((h) => [...h, { role: "user", content: question }, { role: "assistant", content: "" }]);
    setStreaming(true);
    scrollDown();

    let acc = "";
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, papers: [paper], history: priorHistory }),
      });
      if (!res.ok || !res.body) throw new Error(`Request failed (${res.status})`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          if (!part.startsWith("data: ")) continue;
          const payload = part.slice(6);
          if (payload === "[DONE]") continue;
          const obj = JSON.parse(payload);
          if (obj.error) acc += `\n[${obj.error}]`;
          else if (obj.text) acc += obj.text;
          setHistory((h) => {
            const next = [...h];
            next[next.length - 1] = { role: "assistant", content: acc };
            return next;
          });
          scrollDown();
        }
      }
    } catch (err: any) {
      setHistory((h) => {
        const next = [...h];
        next[next.length - 1] = {
          role: "assistant",
          content: acc || `Error: ${err?.message ?? "chat failed"}`,
        };
        return next;
      });
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="mt-5 border-t border-ink-600 pt-4">
      <h4 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-accent-warm">
        Ask the agent about this paper
      </h4>

      {history.length > 0 && (
        <div ref={logRef} className="mb-3 flex max-h-72 flex-col gap-2.5 overflow-y-auto pr-1">
          {history.map((m, i) => (
            <div
              key={i}
              className={`whitespace-pre-wrap rounded-xl px-3 py-2 text-[13.5px] leading-relaxed ${
                m.role === "user"
                  ? "self-end bg-ink-700"
                  : "border border-ink-600 bg-[#16202e]"
              } max-w-[88%]`}
            >
              {m.content || <Spinner />}
            </div>
          ))}
        </div>
      )}

      <form onSubmit={ask} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. How does this compare to prior work?"
          autoComplete="off"
          className="flex-1 rounded-lg border border-ink-600 bg-ink-700 px-3 py-2.5 text-[13.5px] outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={streaming}
          className="rounded-lg bg-accent-warm px-4 text-[13px] font-semibold text-[#1a1208] transition hover:brightness-105 disabled:opacity-60"
        >
          Ask
        </button>
      </form>
    </div>
  );
}
