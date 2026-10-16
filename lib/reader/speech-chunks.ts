export type SpeechRange = { start: number; end: number };

/** Chrome cuts long utterances off, so sentences are merged up to this size. */
export const MAX_SPEECH_CHUNK_CHARS = 180;

const SENTENCE_SEGMENTER = new Intl.Segmenter("de", {
  granularity: "sentence",
});

/**
 * Splits a text range into speakable sentence chunks, keeping absolute offsets
 * so the reader can highlight what is currently being read.
 */
export function buildSpeechChunks(
  text: string,
  range?: SpeechRange,
): SpeechRange[] {
  const from = Math.max(0, range?.start ?? 0);
  const to = Math.min(text.length, range?.end ?? text.length);

  if (to <= from) {
    return [];
  }

  const slice = text.slice(from, to);
  const chunks: SpeechRange[] = [];
  let chunkStart: number | null = null;
  let chunkEnd = from;

  const flush = () => {
    if (chunkStart !== null) {
      chunks.push({ start: chunkStart, end: chunkEnd });
      chunkStart = null;
    }
  };

  for (const segment of SENTENCE_SEGMENTER.segment(slice)) {
    if (!segment.segment.trim()) {
      continue;
    }

    const start = from + segment.index;
    const end = start + segment.segment.length;

    if (chunkStart === null) {
      chunkStart = start;
    }

    chunkEnd = end;

    if (chunkEnd - chunkStart >= MAX_SPEECH_CHUNK_CHARS) {
      flush();
    }
  }

  flush();
  return chunks;
}
