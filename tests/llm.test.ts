import { describe, expect, it } from "vitest";
import {
  parseOpenAiSseStream,
  parseOpenAiSseStreamDetailed,
} from "../lib/server/llm";

function streamFrom(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }

      controller.close();
    },
  });
}

describe("parseOpenAiSseStream", () => {
  it("joins streamed text deltas", async () => {
    const stream = streamFrom([
      'data: {"choices":[{"delta":{"content":"Hallo"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" Welt"}}]}\n\n',
      "data: [DONE]\n\n",
    ]);
    const chunks: string[] = [];

    for await (const chunk of parseOpenAiSseStream(stream)) {
      chunks.push(chunk);
    }

    expect(chunks.join("")).toBe("Hallo Welt");
  });

  it("handles content parts and split SSE frames", async () => {
    const stream = streamFrom([
      'data: {"choices":[{"delta":{"content":[{"text":"Guten ',
      'Tag"}]}}]}\n\n',
    ]);
    const chunks: string[] = [];

    for await (const chunk of parseOpenAiSseStream(stream)) {
      chunks.push(chunk);
    }

    expect(chunks.join("")).toBe("Guten Tag");
  });

  it("reports reasoning-only chunks and a length finish reason", async () => {
    const stream = streamFrom([
      'data: {"choices":[{"delta":{"content":null,"reasoning_content":"thinking"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":null},"finish_reason":"length"}]}\n\n',
    ]);
    const events = [];

    for await (const event of parseOpenAiSseStreamDetailed(stream)) {
      events.push(event);
    }

    expect(events.map((event) => event.reasoningText).join("")).toBe(
      "thinking",
    );
    expect(events.at(-1)?.finishReason).toBe("length");
    expect(events.map((event) => event.text).join("")).toBe("");
  });
});
