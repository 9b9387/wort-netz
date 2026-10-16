"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { usePathname } from "next/navigation";
import {
  BotIcon,
  ChevronRightIcon,
  PlusIcon,
  SendIcon,
  SparklesIcon,
} from "lucide-react";
import { MarkdownContent } from "@/components/markdown-content";
import { setAiPanelOpen } from "@/app/actions/preferences";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { readAiSse, type AiStreamEvent } from "@/lib/ai-client";
import { getDictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

function uuid(): string {
  return crypto.randomUUID();
}

export function AiAssistant({ defaultOpen = true }: { defaultOpen?: boolean }) {
  const pathname = usePathname();
  const lexemeId =
    pathname.match(
      /^\/words\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
    )?.[1] ?? null;

  return (
    <AiAssistantPanel
      key={lexemeId ?? "general"}
      lexemeId={lexemeId}
      defaultOpen={defaultOpen}
    />
  );
}

function AiAssistantPanel({
  lexemeId,
  defaultOpen,
}: {
  lexemeId: string | null;
  defaultOpen: boolean;
}) {
  const t = getDictionary("zh");
  const [open, setOpen] = useState(defaultOpen);
  // The expanded state is a global user preference, so it survives reloads and
  // applies to every page.
  const toggleOpen = (next: boolean) => {
    setOpen(next);
    void setAiPanelOpen(next);
  };
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const query = lexemeId ? `?lexemeId=${encodeURIComponent(lexemeId)}` : "";

    void fetch(`/api/ai/chat${query}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`history_${response.status}`);
        }

        return (await response.json()) as {
          thread: { id: string } | null;
          messages: ChatMessage[];
        };
      })
      .then((data) => {
        if (cancelled) {
          return;
        }

        setThreadId(data.thread?.id ?? null);
        setMessages(data.messages ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setError(t.aiAssistantLoadFailed);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingHistory(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [lexemeId, t.aiAssistantLoadFailed]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, pending]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = input.trim();

    if (!message || pending) {
      return;
    }

    setInput("");
    await sendMessage(message);
  }

  async function sendMessage(message: string) {
    if (!message || pending) {
      return;
    }

    const assistantId = uuid();
    setError(null);
    setPending(true);
    setMessages((current) => [
      ...current,
      { id: uuid(), role: "user", content: message },
      { id: assistantId, role: "assistant", content: "" },
    ]);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          threadId: threadId ?? undefined,
          lexemeId: lexemeId ?? undefined,
          message,
        }),
      });

      if (response.status === 409) {
        setError(t.aiNotConfigured);
        setMessages((current) =>
          current.filter((item) => item.id !== assistantId),
        );
        return;
      }

      if (!response.ok) {
        let detail = `AI 请求失败（${response.status}）`;

        try {
          const payload = (await response.json()) as { error?: unknown };

          if (payload.error === "not_configured") {
            detail = t.aiNotConfigured;
          }
        } catch {
          // Keep the status-based message.
        }

        throw new Error(detail);
      }

      await readAiSse(response, (payload: AiStreamEvent) => {
        if (payload.type === "meta") {
          if (payload.threadId) {
            setThreadId(payload.threadId);
          }
          return;
        }

        if (payload.type === "delta") {
          setMessages((current) =>
            current.map((item) =>
              item.id === assistantId
                ? { ...item, content: item.content + payload.text }
                : item,
            ),
          );
          return;
        }

        if (payload.type === "done") {
          setPending(false);
          return;
        }

        if (payload.type === "error") {
          setError(payload.message);
          setMessages((current) =>
            current.filter((item) => item.id !== assistantId),
          );
          setPending(false);
        }
      });
    } catch (error) {
      setError(
        error instanceof Error && !(error instanceof TypeError)
          ? error.message
          : t.aiRequestFailed,
      );
      setMessages((current) =>
        current.filter((item) => item.id !== assistantId),
      );
    } finally {
      setPending(false);
    }
  }

  function onNewChat() {
    setThreadId(null);
    setMessages([]);
    setInput("");
    setError(null);
  }

  return (
    <aside
      className={cn(
        "order-first flex w-full shrink-0 flex-col border-t bg-background",
        "xl:order-last xl:sticky xl:top-16 xl:h-[calc(100svh-4rem)] xl:border-l xl:border-t-0",
        open ? "xl:w-[380px]" : "xl:w-14",
      )}
    >
      {open ? (
        <>
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <BotIcon />
              <span className="font-medium">{t.aiAssistant}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={onNewChat}
                disabled={pending}
                title={t.aiNewChat}
              >
                <PlusIcon />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => toggleOpen(false)}
                title={t.aiCollapse}
              >
                <ChevronRightIcon />
              </Button>
            </div>
          </div>

          <div
            ref={scrollRef}
            className="flex max-h-[70svh] min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-5 xl:max-h-none"
          >
            {loadingHistory && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner />
                {t.aiLoadingHistory}
              </div>
            )}

            {!loadingHistory && messages.length === 0 && (
              <div className="flex flex-col gap-3">
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  {t.aiAssistantEmpty}
                </div>

                {lexemeId && (
                  <div className="flex flex-wrap gap-2">
                    {[
                      t.aiPromptExplain,
                      t.aiPromptExamples,
                      t.aiPromptSynonyms,
                    ].map((prompt) => (
                      <Button
                        key={prompt}
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() => {
                          void sendMessage(prompt);
                        }}
                      >
                        {prompt}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "max-w-[94%] rounded-xl px-3.5 py-3",
                  message.role === "user"
                    ? "self-end bg-primary text-primary-foreground"
                    : "self-start bg-muted text-foreground",
                )}
              >
                {message.role === "assistant" ? (
                  message.content ? (
                    <MarkdownContent content={message.content} />
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Spinner />
                      {t.aiThinking}
                    </div>
                  )
                ) : (
                  <p className="whitespace-pre-wrap text-sm">
                    {message.content}
                  </p>
                )}
              </div>
            ))}
          </div>

          {error && (
            <div className="px-4 pb-3">
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          )}

          <form onSubmit={onSubmit} className="border-t p-4">
            <div className="mb-3 text-xs text-muted-foreground">
              {lexemeId
                ? t.aiAssistantWordContext
                : t.aiAssistantGeneralContext}
            </div>
            <Textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={t.aiAssistantPlaceholder}
              disabled={pending}
              maxLength={4000}
              rows={3}
              className="resize-none"
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                {t.aiAssistantHint}
              </span>
              <Button
                type="submit"
                size="sm"
                disabled={pending || !input.trim()}
              >
                {pending ? (
                  <>
                    <Spinner data-icon="inline-start" />
                    {t.aiThinking}
                  </>
                ) : (
                  <>
                    <SendIcon data-icon="inline-start" />
                    {t.aiSend}
                  </>
                )}
              </Button>
            </div>
          </form>
        </>
      ) : (
        <div className="flex items-center justify-between px-4 py-3 xl:flex-col xl:justify-start xl:gap-3 xl:px-0 xl:py-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => toggleOpen(true)}
            title={t.aiExpand}
          >
            <SparklesIcon data-icon="inline-start" />
            <span className="xl:hidden">{t.aiAssistant}</span>
          </Button>
          <span className="hidden text-xs text-muted-foreground [writing-mode:vertical-rl] xl:block">
            {t.aiAssistant}
          </span>
        </div>
      )}
    </aside>
  );
}
