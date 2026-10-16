import "server-only";

const encoder = new TextEncoder();

export function encodeSseEvent(event: string, data: unknown): Uint8Array {
  return encoder.encode(
    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
  );
}
