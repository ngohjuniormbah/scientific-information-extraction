"use strict";

const $ = (sel) => document.querySelector(sel);

const state = {
  papers: [],
  current: null, // the paper being viewed in the detail panel
  chat: [], // [{role, content}]
};

// ---------- search ----------

$("#search-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const query = $("#query").value.trim();
  if (!query) return;

  const btn = $("#search-btn");
  btn.disabled = true;
  btn.textContent = "Searching…";
  renderResults({ loading: true });

  const body = {
    query,
    year_from: parseInt($("#year-from").value || "2000", 10),
    max_results: parseInt($("#max-results").value, 10),
    sort_by: $("#sort-by").value,
  };
  const yt = $("#year-to").value;
  if (yt) body.year_to = parseInt(yt, 10);

  try {
    const res = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Search failed");
    state.papers = data.papers;
    renderResults({ papers: data.papers, query });
  } catch (err) {
    renderResults({ error: err.message });
  } finally {
    btn.disabled = false;
    btn.textContent = "Search";
  }
});

function renderResults({ loading, papers, error, query }) {
  const el = $("#results");
  if (loading) {
    el.innerHTML = `<p class="loading"><span class="spinner"></span>Pulling papers from arXiv…</p>`;
    return;
  }
  if (error) {
    el.innerHTML = `<div class="banner">${escapeHtml(error)}</div>`;
    return;
  }
  if (!papers || papers.length === 0) {
    el.innerHTML = `<p class="hint">No papers found for “${escapeHtml(query || "")}” in that year range. Try broadening it.</p>`;
    return;
  }

  el.innerHTML = "";
  const tpl = $("#paper-card");
  papers.forEach((p, i) => {
    const node = tpl.content.cloneNode(true);
    node.querySelector(".card-title").textContent = p.title;
    node.querySelector(".card-meta").textContent =
      `${(p.authors || []).slice(0, 4).join(", ")}${p.authors.length > 4 ? " et al." : ""} · ${p.year} · ${p.primary_category}`;
    node.querySelector(".card-abstract").textContent = p.summary;
    const pdf = node.querySelector(".pdf-link");
    pdf.href = p.pdf_url;
    node.querySelector(".analyse-btn").addEventListener("click", (ev) =>
      analysePaper(p, ev.currentTarget),
    );
    el.appendChild(node);
  });
}

// ---------- analysis ----------

async function analysePaper(paper, btn) {
  state.current = paper;
  state.chat = [];
  openDetail();
  $("#detail-body").innerHTML = `
    <h2>${escapeHtml(paper.title)}</h2>
    <p class="sub">${escapeHtml((paper.authors || []).join(", "))} · ${paper.year}</p>
    <p class="loading"><span class="spinner"></span>ScholarLens is reading the paper…</p>`;
  if (btn) { btn.disabled = true; btn.textContent = "Analysing…"; }

  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paper }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Analysis failed");
    renderAnalysis(paper, data.analysis);
  } catch (err) {
    $("#detail-body").innerHTML = `
      <h2>${escapeHtml(paper.title)}</h2>
      <div class="banner">${escapeHtml(err.message)}</div>`;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Analyse"; }
  }
}

function listSection(title, items) {
  if (!items || items.length === 0) return "";
  const lis = items.map((x) => `<li>${escapeHtml(x)}</li>`).join("");
  return `<div class="an-section"><h4>${title}</h4><ul>${lis}</ul></div>`;
}

function textSection(title, text) {
  if (!text) return "";
  return `<div class="an-section"><h4>${title}</h4><p>${escapeHtml(text)}</p></div>`;
}

function renderAnalysis(paper, a) {
  const keywords = (a.keywords || []).map((k) => `<span class="tag">${escapeHtml(k)}</span>`).join("");
  $("#detail-body").innerHTML = `
    <h2>${escapeHtml(paper.title)}</h2>
    <p class="sub">${escapeHtml((paper.authors || []).slice(0, 6).join(", "))} · ${paper.year} · ${escapeHtml(a.field || paper.primary_category)}</p>
    <div class="an-section"><div class="tldr">${escapeHtml(a.tldr || "")}</div></div>
    ${textSection("In plain language", a.plain_language)}
    ${listSection("Key contributions", a.key_contributions)}
    ${textSection("Methodology", a.methodology)}
    ${listSection("Findings", a.findings)}
    ${listSection("Limitations", a.limitations)}
    ${textSection("Why it matters", a.significance)}
    ${listSection("Future work", a.future_work)}
    ${keywords ? `<div class="an-section"><h4>Keywords</h4>${keywords}</div>` : ""}
    <div class="chat">
      <h4>Ask the agent about this paper</h4>
      <div class="chat-log" id="chat-log"></div>
      <form class="chat-form" id="chat-form">
        <input id="chat-input" type="text" placeholder="e.g. How does this compare to prior work?" autocomplete="off" />
        <button type="submit">Ask</button>
      </form>
    </div>`;
  $("#chat-form").addEventListener("submit", onChatSubmit);
}

// ---------- chat (streaming) ----------

async function onChatSubmit(e) {
  e.preventDefault();
  const input = $("#chat-input");
  const question = input.value.trim();
  if (!question) return;
  input.value = "";

  state.chat.push({ role: "user", content: question });
  appendMsg("user", question);
  const assistantEl = appendMsg("assistant", "");
  assistantEl.innerHTML = `<span class="spinner"></span>`;

  let acc = "";
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        papers: state.current ? [state.current] : [],
        history: state.chat.slice(0, -1),
      }),
    });
    if (!res.ok || !res.body) throw new Error("Chat request failed");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6);
        if (payload === "[DONE]") continue;
        const obj = JSON.parse(payload);
        if (obj.error) { acc += `\n[${obj.error}]`; }
        else if (obj.text) { acc += obj.text; }
        assistantEl.textContent = acc;
        $("#chat-log").scrollTop = $("#chat-log").scrollHeight;
      }
    }
  } catch (err) {
    assistantEl.textContent = acc || `Error: ${err.message}`;
  }
  state.chat.push({ role: "assistant", content: acc });
}

function appendMsg(role, text) {
  const log = $("#chat-log");
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.textContent = text;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
  return div;
}

// ---------- detail panel ----------

function openDetail() { $("#detail").classList.remove("hidden"); }
$("#detail-close").addEventListener("click", () => $("#detail").classList.add("hidden"));

// ---------- util ----------

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
