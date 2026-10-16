/**
 * Leitner scheduling for the review module.
 *
 * Every rule here is plain arithmetic: the server action only reads the current
 * row, calls `applyRating` and writes the result back. Keeping the box rules in
 * a module without database or React imports makes them unit testable and lets
 * the word detail page reuse `LEITNER_BOX_MAX` for its progress bar.
 */

import type { WordStatus } from "@/lib/wordbook/status";

/** Highest Leitner box; box 5 mastered again means the word is learned. */
export const LEITNER_BOX_MAX = 5;

/**
 * Days a card waits before it is due again, indexed by `box - 1`. Box 0 is the
 * word book state of a word that has never been reviewed.
 */
export const BOX_INTERVAL_DAYS = [1, 3, 7, 16, 35] as const;

export const REVIEW_RATINGS = ["FORGOT", "KNOWN"] as const;

export type ReviewRating = (typeof REVIEW_RATINGS)[number];

export function isReviewRating(value: unknown): value is ReviewRating {
  return (
    typeof value === "string" &&
    (REVIEW_RATINGS as readonly string[]).includes(value)
  );
}

export type ReviewScheduleInput = {
  box: number;
  /** Total answers so far. 0 means the word has never been reviewed. */
  repetitions: number;
  lapses: number;
};

export type ReviewSchedule = {
  box: number;
  status: WordStatus;
  /** Days until the next review; 0 once the word is mastered. */
  intervalDays: number;
  /** Null once the word is mastered, so it leaves the queue. */
  dueAt: Date | null;
  repetitions: number;
  lapses: number;
};

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function clampBox(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(Math.max(Math.trunc(value), 0), LEITNER_BOX_MAX);
}

/** Days a card stays in the given box; box 0 has no interval of its own. */
export function intervalDaysForBox(box: number): number {
  const clamped = Math.min(Math.max(Math.trunc(box), 1), LEITNER_BOX_MAX);

  return BOX_INTERVAL_DAYS[clamped - 1];
}

/** Box 1-2 is active learning, 3-5 is spaced review. */
export function statusForBox(box: number): WordStatus {
  return clampBox(box) <= 2 ? "LEARNING" : "REVIEWING";
}

/**
 * Applies one answer to a word book row.
 *
 * `KNOWN` moves the card one box up, and answering correctly while already in
 * the last box masters it. `FORGOT` drops the card back to box 1 but keeps the
 * answer count, so the word is no longer "new" and never counts against the
 * daily new-word budget twice.
 */
export function applyRating(
  current: ReviewScheduleInput,
  rating: ReviewRating,
  now: Date = new Date(),
): ReviewSchedule {
  const boxBefore = clampBox(current.box);
  const repetitions = current.repetitions + 1;

  if (rating === "FORGOT") {
    const box = 1;
    const intervalDays = intervalDaysForBox(box);

    return {
      box,
      status: statusForBox(box),
      intervalDays,
      // A forgotten card is due right away so it comes back immediately.
      dueAt: new Date(now.getTime()),
      repetitions,
      lapses: current.lapses + 1,
    };
  }

  if (boxBefore >= LEITNER_BOX_MAX) {
    return {
      box: LEITNER_BOX_MAX,
      status: "MASTERED",
      intervalDays: 0,
      dueAt: null,
      repetitions,
      lapses: current.lapses,
    };
  }

  const box = boxBefore + 1;
  const intervalDays = intervalDaysForBox(box);

  return {
    box,
    status: statusForBox(box),
    intervalDays,
    dueAt: new Date(now.getTime() + intervalDays * MS_PER_DAY),
    repetitions,
    lapses: current.lapses,
  };
}
