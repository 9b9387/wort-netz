import { describe, expect, it } from "vitest";
import {
  BOX_INTERVAL_DAYS,
  LEITNER_BOX_MAX,
  applyRating,
  clampBox,
  intervalDaysForBox,
  isReviewRating,
  statusForBox,
} from "../lib/review/schedule";

const NOW = new Date("2026-10-16T08:00:00.000Z");

describe("intervalDaysForBox", () => {
  it("follows the Leitner ladder", () => {
    expect(BOX_INTERVAL_DAYS).toEqual([1, 3, 7, 16, 35]);
    expect(intervalDaysForBox(1)).toBe(1);
    expect(intervalDaysForBox(3)).toBe(7);
    expect(intervalDaysForBox(LEITNER_BOX_MAX)).toBe(35);
  });

  it("clamps out-of-range boxes into the ladder", () => {
    expect(intervalDaysForBox(0)).toBe(1);
    expect(intervalDaysForBox(99)).toBe(35);
    expect(clampBox(-3)).toBe(0);
    expect(clampBox(7)).toBe(LEITNER_BOX_MAX);
  });
});

describe("statusForBox", () => {
  it("treats boxes 1-2 as learning and 3-5 as reviewing", () => {
    expect(statusForBox(1)).toBe("LEARNING");
    expect(statusForBox(2)).toBe("LEARNING");
    expect(statusForBox(3)).toBe("REVIEWING");
    expect(statusForBox(5)).toBe("REVIEWING");
  });
});

describe("isReviewRating", () => {
  it("accepts only the two ratings", () => {
    expect(isReviewRating("FORGOT")).toBe(true);
    expect(isReviewRating("KNOWN")).toBe(true);
    expect(isReviewRating("EASY")).toBe(false);
    expect(isReviewRating(null)).toBe(false);
  });
});

describe("applyRating", () => {
  it("moves a new word into box 1 and schedules it tomorrow", () => {
    const schedule = applyRating(
      { box: 0, repetitions: 0, lapses: 0 },
      "KNOWN",
      NOW,
    );

    expect(schedule.box).toBe(1);
    expect(schedule.status).toBe("LEARNING");
    expect(schedule.intervalDays).toBe(1);
    expect(schedule.dueAt?.toISOString()).toBe("2026-10-17T08:00:00.000Z");
    expect(schedule.repetitions).toBe(1);
  });

  it("masters a word that is answered again in the last box", () => {
    const schedule = applyRating(
      { box: LEITNER_BOX_MAX, repetitions: 5, lapses: 0 },
      "KNOWN",
      NOW,
    );

    expect(schedule.box).toBe(LEITNER_BOX_MAX);
    expect(schedule.status).toBe("MASTERED");
    expect(schedule.intervalDays).toBe(0);
    expect(schedule.dueAt).toBeNull();
  });

  it("drops a forgotten word back to box 1 and keeps the answer count", () => {
    const schedule = applyRating(
      { box: 4, repetitions: 3, lapses: 1 },
      "FORGOT",
      NOW,
    );

    expect(schedule.box).toBe(1);
    expect(schedule.status).toBe("LEARNING");
    expect(schedule.intervalDays).toBe(1);
    // Due immediately so the card comes back inside the same session.
    expect(schedule.dueAt?.getTime()).toBe(NOW.getTime());
    expect(schedule.lapses).toBe(2);
    // A forgotten word is no longer "new", so it never counts twice.
    expect(schedule.repetitions).toBe(4);
  });
});
