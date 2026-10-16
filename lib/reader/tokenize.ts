export type RawToken = {
  text: string;
  start: number;
  end: number;
};

const WORD_SEGMENTER = new Intl.Segmenter("de", { granularity: "word" });
const LETTER_PATTERN = /\p{L}/u;
const MAX_TOKEN_LENGTH = 40;

/**
 * Mirrors `normalizeLexeme` from `lib/server/dwds.ts`. Duplicated here because
 * that module is `server-only` while this one also runs in the browser and in
 * plain vitest tests.
 */
export function normalizeSurface(surface: string): string {
  return surface.normalize("NFC").trim().toLowerCase();
}

function isWordToken(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= MAX_TOKEN_LENGTH &&
    LETTER_PATTERN.test(value)
  );
}

/**
 * Splits `text` into German word tokens with UTF-16 offsets that line up with
 * `text.slice(start, end)`, the Selection API and React keys.
 */
export function tokenizeWords(text: string): RawToken[] {
  const tokens: RawToken[] = [];

  for (const segment of WORD_SEGMENTER.segment(text)) {
    const value = segment.segment;

    if (!segment.isWordLike || !isWordToken(value)) {
      continue;
    }

    tokens.push({
      text: value,
      start: segment.index,
      end: segment.index + value.length,
    });
  }

  return tokens;
}
