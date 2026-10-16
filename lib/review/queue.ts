/**
 * Session planning for the review module: which words are due, which new words
 * fill the remaining slots, and where a forgotten card comes back.
 *
 * Pure sorting and slicing, so the daily budget can be unit tested without a
 * database.
 */

import type { ReviewRating } from "./schedule";

/** Cards a forgotten word waits for before it shows up again in the session. */
export const REQUEUE_GAP = 5;

export type ReviewQueueCandidate = {
  lexemeId: string;
  canonicalLemma: string;
  wordType: string | null;
  ipa: string | null;
  /** Lowest CEFR level of the entry, when the vocabulary list knows it. */
  level: string | null;
  isNew: boolean;
  box: number;
  lastSeenAt: Date;
  dueAt: Date | null;
};

/** CEFR order used for introducing new words from easiest to hardest. */
const LEVEL_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

const UNKNOWN_LEVEL_RANK = LEVEL_ORDER.length;

export function levelRank(level: string | null): number {
  if (!level) {
    return UNKNOWN_LEVEL_RANK;
  }

  const index = LEVEL_ORDER.indexOf(level.trim().toUpperCase() as never);

  return index === -1 ? UNKNOWN_LEVEL_RANK : index;
}

export function compareByLexemeId(
  a: ReviewQueueCandidate,
  b: ReviewQueueCandidate,
): number {
  return a.lexemeId.localeCompare(b.lexemeId);
}

/** Most overdue first, newest first on a tie. */
export function compareDue(
  a: ReviewQueueCandidate,
  b: ReviewQueueCandidate,
): number {
  const aDue = a.dueAt ? a.dueAt.getTime() : Number.POSITIVE_INFINITY;
  const bDue = b.dueAt ? b.dueAt.getTime() : Number.POSITIVE_INFINITY;

  return (
    aDue - bDue ||
    b.lastSeenAt.getTime() - a.lastSeenAt.getTime() ||
    compareByLexemeId(a, b)
  );
}

/** Easiest level first, newest first on a tie. */
export function compareNew(
  a: ReviewQueueCandidate,
  b: ReviewQueueCandidate,
): number {
  return (
    levelRank(a.level) - levelRank(b.level) ||
    b.lastSeenAt.getTime() - a.lastSeenAt.getTime() ||
    compareByLexemeId(a, b)
  );
}

/**
 * The session queue: every due card first (most overdue wins), then new words
 * until the session is full, capped by the new words the user has left today.
 */
export function planSession({
  due,
  newCandidates,
  sessionSize,
  newRemaining,
}: {
  due: readonly ReviewQueueCandidate[];
  newCandidates: readonly ReviewQueueCandidate[];
  sessionSize: number;
  newRemaining: number;
}): ReviewQueueCandidate[] {
  const size = Math.max(0, Math.trunc(sessionSize));

  if (size === 0) {
    return [];
  }

  const queue = [...due].sort(compareDue).slice(0, size);
  const slots = size - queue.length;
  const newQuota = Math.min(Math.max(0, Math.trunc(newRemaining)), slots);

  if (newQuota <= 0) {
    return queue;
  }

  queue.push(...[...newCandidates].sort(compareNew).slice(0, newQuota));

  return queue;
}

/**
 * Puts a forgotten card back into the remaining queue so it shows up again
 * after `gap` other cards instead of at the very end of a long session.
 */
export function insertRequeue<T>(
  queue: readonly T[],
  item: T,
  gap: number = REQUEUE_GAP,
): T[] {
  const index = Math.min(Math.max(0, Math.trunc(gap)), queue.length);

  return [...queue.slice(0, index), item, ...queue.slice(index)];
}

/** A card that was just answered belongs back in the queue when forgotten. */
export function requeuesInSession(rating: ReviewRating): boolean {
  return rating === "FORGOT";
}
