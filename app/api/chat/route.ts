import { NextRequest } from "next/server";
import { chatStream } from "@/lib/anthropic";
import type { ChatTurn, Paper } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body.", { status: 400 });
  }

  const question = String(body?.question ?? "").trim();
  if (!question) {
    return new Response("A question is required.", { status: 400 });
  }
  const papers: Paper[] = Array.isArray(body?.papers) ? body.papers : [];
  const history: ChatTurn[] = Array.isArray(body?.history) ? body.history : [];

  const encoder = new TextEncoder();
  const send = (obj: unknown) => encoder.encode(`data: ${JSON.stringify(obj)}\n\n`);

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const claude = chatStream(question, papers, history);
        for await (const event of claude) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(send({ text: event.delta.text }));
          }
        }
      } catch (err: any) {
        controller.enqueue(send({ error: err?.message ?? "Chat failed." }));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
