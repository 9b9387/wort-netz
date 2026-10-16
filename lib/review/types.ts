/**
 * Wire shapes shared by the review server actions and the review UI.
 *
 * They live outside `lib/server/review.ts` so client components can import the
 * types without pulling a server-only module into the browser bundle.
 */

import type { WordStatus } from "@/lib/wordbook/status";
import type { EnglishDefinitionItem } from "@/lib/word-senses";

export type ReviewPlan = {
  sessionSize: number;
  newPerDay: number;
  tzOffsetMinutes: number;
};

export type ReviewOverview = {
  /** Cards whose `dueAt` has passed. */
  dueCount: number;
  /** Word book entries that were never reviewed. */
  newCount: number;
  /** New words already introduced in the user's current local day. */
  todayNewCount: number;
  todayReviewedCount: number;
  streakDays: number;
  sessionSize: number;
  newPerDay: number;
  nextDueAt: string | null;
};

/** One card of the session queue; the content arrives from `loadReviewCard`. */
export type ReviewQueueCard = {
  lexemeId: string;
  canonicalLemma: string;
  wordType: string | null;
  ipa: string | null;
  /** Lowest CEFR level of the entry, when the vocabulary list knows it. */
  level: string | null;
  isNew: boolean;
  box: number;
};

export type ReviewSentencePayload = {
  text: string;
  /** UTF-16 ranges of the target word inside `text`. */
  highlightRanges: Array<{ start: number; end: number }>;
  translation: string | null;
  source: "tatoeba" | "odenet" | "ai";
  sourceUrl: string | null;
  license: string | null;
  /** True for a sentence written by the user's own LLM. */
  generated: boolean;
};

export type ReviewCardPayload = {
  lexemeId: string;
  canonicalLemma: string;
  wordType: string | null;
  ipa: string | null;
  level: string | null;
  box: number;
  isNew: boolean;
  isFavorite: boolean;
  /** Lemma this entry is a form of, for entries stored as a form. */
  baseLemma: string | null;
  /** Curated Chinese gloss of a multi-word expression, when available. */
  gloss: string | null;
  definitionEn: string | null;
  /**
   * Every English sense of the entry, ranked so the reading the word book
   * stands for comes first. The card lists all of them, because one line can
   * never cover a spelling like "wollen" (wool *and* to want).
   */
  senses: EnglishDefinitionItem[];
  definitionsDe: string[];
  /** The user's own note for this word, empty when none was written. */
  note: string;
  genitive: string | null;
  plural: string | null;
  /**
   * Null only when the word has no usable example at all. `sentenceNotice`
   * tells the two cases apart: `none` means "skip this card", while
   * `source_unavailable` means "show the card without a sentence".
   */
  sentence: ReviewSentencePayload | null;
  sentenceNotice: "none" | "source_unavailable";
};

export type ReviewAnswerResult =
  | {
      status: "ok";
      boxAfter: number;
      statusAfter: WordStatus;
      intervalDays: number;
      dueAt: string | null;
      requeueInSession: boolean;
    }
  | { status: "duplicate" }
  | { status: "inactive" };

export type RecentReview = {
  id: string;
  rating: string;
  boxBefore: number;
  boxAfter: number;
  intervalDaysAfter: number;
  reviewedAt: Date;
};
