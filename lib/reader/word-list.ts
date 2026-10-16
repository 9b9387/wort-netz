import { normalizeSurface } from "./tokenize";
import type { ReaderCategory, ReaderToken } from "./types";

export type ReaderWordEntry = {
  key: string;
  /** Canonical lemma when resolved, otherwise the surface form. */
  lemma: string;
  /** First surface form as it appeared in the text. */
  surface: string;
  start: number;
  category: ReaderCategory;
  count: number;
  level: string | null;
  pos: string | null;
  inWordBook: boolean;
  lexemeId: string | null;
};

const CATEGORY_RANK: Record<ReaderCategory, number> = {
  unlearned: 0,
  unrecognized: 1,
  learned: 2,
};

/**
 * Vocabulary inventory of the article. Unlearned words come first so the list
 * doubles as the study queue; ties break on frequency in the text.
 */
export function buildWordEntries(
  tokens: readonly ReaderToken[],
): ReaderWordEntry[] {
  const entries = new Map<string, ReaderWordEntry>();

  for (const token of tokens) {
    const key = token.lemma
      ? normalizeSurface(token.lemma)
      : normalizeSurface(token.text);
    const current = entries.get(key);

    if (current) {
      current.count += 1;
      continue;
    }

    entries.set(key, {
      key,
      lemma: token.lemma ?? token.text,
      surface: token.text,
      start: token.start,
      category: token.category,
      count: 1,
      level: token.level,
      pos: token.pos,
      inWordBook: token.inWordBook,
      lexemeId: token.lexemeId,
    });
  }

  return Array.from(entries.values()).sort(
    (a, b) =>
      CATEGORY_RANK[a.category] - CATEGORY_RANK[b.category] ||
      b.count - a.count ||
      a.start - b.start,
  );
}

/**
 * The study list. Unrecognized words (typos, proper nouns, foreign words) have
 * no dictionary entry to learn from, so they are left out; the text still lets
 * you click them, and the legend keeps counting them.
 */
export function selectStudyEntries(
  entries: readonly ReaderWordEntry[],
): ReaderWordEntry[] {
  return entries.filter((entry) => entry.category !== "unrecognized");
}

export function countUnrecognizedEntries(
  entries: readonly ReaderWordEntry[],
): number {
  return entries.filter((entry) => entry.category === "unrecognized").length;
}
