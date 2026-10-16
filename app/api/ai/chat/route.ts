import { z } from "zod";
import {
  buildAssistantSystemPrompt,
  createAiMessage,
  deleteAiThread,
  getAiThreadWithMessages,
  getAiWordIntroContext,
  getLatestAiThread,
  getOrCreateAiThread,
} from "@/lib/server/ai";
import { getCurrentUser } from "@/lib/server/auth";
import {
  getUserLlmRuntimeConfig,
  llmConfigHash,
} from "@/lib/server/llm-config";
import {
  DEFAULT_ASSISTANT_SYSTEM_PROMPT,
  LlmRequestError,
  streamLlmChat,
  type LlmChatMessage,
} from "@/lib/server/llm";
import { encodeSseEvent } from "@/lib/server/sse";

const chatSchema = z.object({
  threadId: z.string().uuid().nullish(),
  lexemeId: z.string().uuid().nullish(),
  kind: z.enum(["general", "word", "grammar"]).optional(),
  message: z.string().trim().min(1).max(4_000),
});

function streamHeaders(): HeadersInit {
  return {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  };
}

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const threadId = url.searchParams.get("threadId");
  const lexemeId = url.searchParams.get("lexemeId");

  if (threadId) {
    const thread = await getAiThreadWithMessages(user.id, threadId);

    if (!thread) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }

    return Response.json(thread);
  }

  const latest = await getLatestAiThread(user.id, lexemeId || null);

  if (!latest) {
    return Response.json({ thread: null, messages: [] });
  }

  const thread = await getAiThreadWithMessages(user.id, latest.id);
  return Response.json(thread);
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const threadId = new URL(request.url).searchParams.get("threadId");
  const parsed = z.string().uuid().safeParse(threadId);

  if (!parsed.success) {
    return Response.json({ error: "invalid_thread" }, { status: 400 });
  }

  await deleteAiThread(user.id, parsed.data);
  return new Response(null, { status: 204 });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const config = await getUserLlmRuntimeConfig(user.id);

  if (!config) {
    return Response.json({ error: "not_configured" }, { status: 409 });
  }

  let json: unknown;

  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = chatSchema.safeParse(json);

  if (!parsed.success) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const { threadId, lexemeId, kind, message } = parsed.data;
  let thread: { id: string };
  let messages: LlmChatMessage[];

  try {
    thread = await getOrCreateAiThread(user.id, {
      threadId,
      lexemeId,
      kind: kind ?? (lexemeId ? "word" : "general"),
    });
    await createAiMessage(user.id, {
      threadId: thread.id,
      role: "user",
      content: message,
    });

    const history = await getAiThreadWithMessages(user.id, thread.id);
    const context = lexemeId ? await getAiWordIntroContext(lexemeId) : null;
    messages = [
      {
        role: "system",
        content: context
          ? buildAssistantSystemPrompt(context)
          : DEFAULT_ASSISTANT_SYSTEM_PROMPT,
      },
      ...(history?.messages ?? []).map((item) => ({
        role: item.role,
        content: item.content,
      })),
    ];
  } catch (error) {
    console.error("ai chat setup failed", {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json({ error: "server_error" }, { status: 500 });
  }

  const configHash = llmConfigHash(config);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(
        encodeSseEvent("meta", {
          threadId: thread.id,
          model: config.model,
        }),
      );

      let fullContent = "";

      try {
        for await (const delta of streamLlmChat({
          config,
          messages,
          signal: request.signal,
          maxTokens: Math.max(config.maxTokens, 4096),
        })) {
          fullContent += delta;
          controller.enqueue(
            encodeSseEvent("delta", {
              text: delta,
            }),
          );
        }

        if (fullContent.trim()) {
          const assistantMessage = await createAiMessage(user.id, {
            threadId: thread.id,
            role: "assistant",
            content: fullContent,
            model: config.model,
            configHash,
          });
          controller.enqueue(
            encodeSseEvent("done", {
              messageId: assistantMessage.id,
            }),
          );
        } else {
          controller.enqueue(
            encodeSseEvent("error", {
              message: "模型没有返回内容。",
            }),
          );
        }
      } catch (error) {
        console.error("ai chat stream failed", {
          userId: user.id,
          threadId: thread.id,
          error: error instanceof Error ? error.message : String(error),
        });
        const messageText =
          error instanceof LlmRequestError
            ? error.message
            : error instanceof Error
              ? error.message
              : "AI 请求失败。";
        controller.enqueue(
          encodeSseEvent("error", {
            message: messageText,
          }),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: streamHeaders(),
  });
}
