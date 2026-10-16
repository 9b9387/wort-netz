/**
 * Shared shapes for the reader annotation pipeline. Kept free of React,
 * Prisma and server-only imports so the client, the route handler and the
 * unit tests can all use them.
 */

export type ReaderCategory = "learned" | "unlearned" | "unrecognized";

/**
 * How a token was resolved to a dictionary entry:
 * - `exact`: the surface form is the canonical lemma itself.
 * - `form`: a recorded surface form or a `forms_json` inflection of the entry.
 * - `rule`: derived by the suffix/umlaut/participle/compound rules.
 * - `none`: nothing matched.
 */
export type ReaderMatch = "exact" | "form" | "rule" | "none";

export type ReaderToken = {
  text: string;
  /** UTF-16 offsets into the analyzed text, matching `String.prototype.slice`. */
  start: number;
  end: number;
  category: ReaderCategory;
  lemma: string | null;
  /** Present only when a `lexemes` row exists for the resolved lemma. */
  lexemeId: string | null;
  match: ReaderMatch;
  pos: string | null;
  level: string | null;
  /** Function words are dimmed and filterable, never a highlight color. */
  isFunctionWord: boolean;
  inWordBook: boolean;
  isFavorite: boolean;
  dueAt: string | null;
};

export type ReaderStats = {
  totalWords: number;
  uniqueWords: number;
  learnedWords: number;
  learnedUnique: number;
  unlearnedUnique: number;
  unrecognizedUnique: number;
  /** Distinct function words (der, und, ich, …) in the article. */
  functionWordUnique: number;
  coverageTokenRatio: number;
  coverageUniqueRatio: number;
  /** Share of the identifiable words that are still unlearned (unique words). */
  unlearnedRateRatio: number;
  /** Unlearned unique words per CEFR level plus `unknown`. */
  levelHistogram: Record<string, number>;
  /** Median CEFR level of the unlearned unique words, `null` when unknown. */
  estimatedLevel: string | null;
};

/**
 * A detected multi-word expression (fixed phrase / collocation) inside the
 * article. `start`/`end` cover only the words that actually appear in the text.
 */
export type ReaderPhrase = {
  start: number;
  end: number;
  /** Normalized dictionary form, e.g. "zur verfügung stehen". */
  normalized: string;
  /** Display form, e.g. "zur Verfügung stehen". */
  canonical: string;
  pos: string | null;
  /** Present once the phrase exists as an entry in the dictionary. */
  lexemeId: string | null;
  inWordBook: boolean;
  isFavorite: boolean;
  dueAt: string | null;
};

export type ReaderAnalysis = {
  tokens: ReaderToken[];
  phrases: ReaderPhrase[];
  stats: ReaderStats;
};

/** Longer texts are rejected instead of analyzed, to bound query size. */
export const READER_MAX_CHARS = 20_000;
