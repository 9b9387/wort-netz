/**
 * Finds the span of a target word inside a German example sentence so the
 * review card can highlight it.
 *
 * The rules mirror the reader: the exact form wins, then the inflection table
 * the entry carries, then the curated irregular verb table, and finally the
 * suffix/compound candidates. Offsets are UTF-16 indices into the original
 * sentence, so the caller can slice the string directly.
 */

import { isCandidateLemma } from "@/lib/reader/candidates";
import { normalizeSurface, tokenizeWords } from "@/lib/reader/tokenize";
import { irregularVerbLemma } from "@/lib/reader/verb-forms";

export type HighlightRange = {
  /** Index of the first character, inclusive. */
  start: number;
  /** Index after the last character. */
  end: number;
};

export type HighlightTarget = {
  /** Dictionary lemma of the entry being reviewed, e.g. "Haus". */
  lemma: string;
  /** Inflected forms carried by the entry's `forms_json`. */
  forms?: readonly string[];
  /** Whole multi-word expression, when the entry itself is a phrase. */
  phrase?: string | null;
};

/** Below this length a guessed (rule-derived) match is treated as noise. */
const MIN_GUESSED_LENGTH = 3;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mergeRanges(ranges: HighlightRange[]): HighlightRange[] {
  if (ranges.length <= 1) {
    return ranges;
  }

  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: HighlightRange[] = [sorted[0]];

  for (const range of sorted.slice(1)) {
    const last = merged[merged.length - 1];

    if (range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
      continue;
    }

    merged.push({ ...range });
  }

  return merged;
}

/**
 * Every whole-word occurrence of a multi-word expression. Spaces inside the
 * entry may appear as any whitespace in running text ("Zu Hause" / "zu  Hause").
 */
function phraseRanges(sentence: string, phrase: string): HighlightRange[] {
  const parts = phrase
    .trim()
    .split(/\s+/u)
    .filter(Boolean)
    .map(escapeRegExp);

  if (parts.length === 0) {
    return [];
  }

  let pattern: RegExp;

  try {
    pattern = new RegExp(
      `(?<![\\p{L}\\p{N}])${parts.join("\\s+")}(?![\\p{L}\\p{N}])`,
      "giu",
    );
  } catch {
    return [];
  }

  const ranges: HighlightRange[] = [];

  for (const match of sentence.matchAll(pattern)) {
    if (match.index === undefined) {
      continue;
    }

    ranges.push({ start: match.index, end: match.index + match[0].length });
  }

  return ranges;
}

/** Occurrences of a single word: exact form, known inflection or lemma guess. */
function tokenRanges(sentence: string, target: HighlightTarget): HighlightRange[] {
  const lemma = normalizeSurface(target.lemma);

  if (!lemma) {
    return [];
  }

  const forms = new Set(
    (target.forms ?? []).map(normalizeSurface).filter(Boolean),
  );
  const ranges: HighlightRange[] = [];

  for (const token of tokenizeWords(sentence)) {
    const normalized = normalizeSurface(token.text);
    const exact = normalized === lemma || forms.has(normalized);
    const guessed =
      normalized.length >= MIN_GUESSED_LENGTH &&
      (irregularVerbLemma(normalized) === lemma ||
        isCandidateLemma(token.text, lemma));

    if (exact || guessed) {
      ranges.push({ start: token.start, end: token.end });
    }
  }

  return ranges;
}

/**
 * Ranges of `sentence` that should be highlighted. Returns an empty array when
 * the word cannot be located, which is how a sentence is rejected as a card.
 */
export function findHighlightRanges(
  sentence: string,
  target: HighlightTarget,
): HighlightRange[] {
  if (!sentence.trim()) {
    return [];
  }

  const ranges = target.phrase?.trim()
    ? phraseRanges(sentence, target.phrase)
    : tokenRanges(sentence, target);

  return mergeRanges(ranges);
}

/** Whether the sentence contains the target word in any inflected shape. */
export function containsTarget(
  sentence: string,
  target: HighlightTarget,
): boolean {
  return findHighlightRanges(sentence, target).length > 0;
}

export type HighlightedSegment = {
  text: string;
  /** True when this segment is the target word and should stand out. */
  highlight: boolean;
};

/**
 * Cuts a sentence into alternating plain and highlighted segments so a view can
 * render it without re-implementing the offset maths.
 */
export function splitHighlightedText(
  text: string,
  ranges: readonly HighlightRange[],
): HighlightedSegment[] {
  const usable = ranges
    .filter(
      (range) =>
        range.end > range.start &&
        range.start >= 0 &&
        range.end <= text.length,
    )
    .sort((a, b) => a.start - b.start);

  if (usable.length === 0) {
    return [{ text, highlight: false }];
  }

  const segments: HighlightedSegment[] = [];
  let cursor = 0;

  for (const range of usable) {
    if (range.start > cursor) {
      segments.push({ text: text.slice(cursor, range.start), highlight: false });
    }

    segments.push({ text: text.slice(range.start, range.end), highlight: true });
    cursor = range.end;
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), highlight: false });
  }

  return segments;
}
