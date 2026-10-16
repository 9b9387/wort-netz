export type AiStreamEvent =
  | { type: "meta"; threadId?: string; lexemeId?: string; model?: string }
  | { type: "delta"; text: string }
  | { type: "done"; messageId?: string; configHash?: string }
  | { type: "error"; message: string };

export async function readAiSse(
  response: Response,
  onEvent: (payload: AiStreamEvent) => void,
): Promise<void> {
  if (!response.body) {
    throw new Error("empty_stream");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const rawEvent of events) {
      let eventName = "message";
      const dataLines: string[] = [];

      for (const line of rawEvent.split(/\r?\n/)) {
        if (line.startsWith("event:")) {
          eventName = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          dataLines.push(line.slice(5).trim());
        }
      }

      if (dataLines.length === 0) {
        continue;
      }

      try {
        const data = JSON.parse(dataLines.join("\n")) as Record<
          string,
          unknown
        >;
        onEvent({ type: eventName, ...data } as AiStreamEvent);
      } catch {
        // Ignore malformed chunks from a provider or proxy.
      }
    }
  }
}
