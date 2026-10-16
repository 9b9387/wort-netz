import { describe, expect, it } from "vitest";
import {
  REQUEUE_GAP,
  insertRequeue,
  levelRank,
  planSession,
  requeuesInSession,
  type ReviewQueueCandidate,
} from "../lib/review/queue";

function candidate(
  lexemeId: string,
  overrides: Partial<ReviewQueueCandidate> = {},
): ReviewQueueCandidate {
  return {
    lexemeId,
    canonicalLemma: lexemeId,
    wordType: null,
    ipa: null,
    level: null,
    isNew: false,
    box: 1,
    lastSeenAt: new Date("2026-10-01T00:00:00.000Z"),
    dueAt: new Date("2026-10-10T00:00:00.000Z"),
    ...overrides,
  };
}

describe("levelRank", () => {
  it("orders CEFR levels and pushes unknown levels last", () => {
    expect(levelRank("A1")).toBeLessThan(levelRank("B2"));
    expect(levelRank("b1")).toBe(levelRank("B1"));
    expect(levelRank(null)).toBeGreaterThan(levelRank("C2"));
    expect(levelRank("X9")).toBeGreaterThan(levelRank("C2"));
  });
});

describe("planSession", () => {
  it("takes due cards first, most overdue first", () => {
    const queue = planSession({
      due: [
        candidate("late", { dueAt: new Date("2026-10-15T00:00:00.000Z") }),
        candidate("overdue", { dueAt: new Date("2026-10-01T00:00:00.000Z") }),
      ],
      newCandidates: [],
      sessionSize: 10,
      newRemaining: 10,
    });

    expect(queue.map((item) => item.lexemeId)).toEqual(["overdue", "late"]);
  });

  it("fills the remaining slots with the easiest new words", () => {
    const queue = planSession({
      due: [candidate("due")],
      newCandidates: [
        candidate("hard", { isNew: true, box: 0, level: "C1" }),
        candidate("easy", { isNew: true, box: 0, level: "A1" }),
      ],
      sessionSize: 3,
      newRemaining: 5,
    });

    expect(queue.map((item) => item.lexemeId)).toEqual([
      "due",
      "easy",
      "hard",
    ]);
  });

  it("never introduces more new words than the daily budget allows", () => {
    const queue = planSession({
      due: [],
      newCandidates: [
        candidate("a", { isNew: true, box: 0 }),
        candidate("b", { isNew: true, box: 0 }),
      ],
      sessionSize: 10,
      newRemaining: 1,
    });

    expect(queue).toHaveLength(1);
    expect(queue[0].lexemeId).toBe("a");
  });

  it("caps the session size and tolerates a zero-size session", () => {
    const due = [
      candidate("a"),
      candidate("b"),
      candidate("c"),
    ];

    expect(
      planSession({ due, newCandidates: [], sessionSize: 2, newRemaining: 0 }),
    ).toHaveLength(2);
    expect(
      planSession({ due, newCandidates: [], sessionSize: 0, newRemaining: 5 }),
    ).toEqual([]);
  });
});

describe("insertRequeue", () => {
  it("brings a forgotten card back after the configured gap", () => {
    const queue = ["a", "b", "c", "d", "e", "f"];
    const next = insertRequeue(queue, "x");

    expect(REQUEUE_GAP).toBe(5);
    expect(next).toEqual(["a", "b", "c", "d", "e", "x", "f"]);
  });

  it("appends when the remaining queue is shorter than the gap", () => {
    expect(insertRequeue(["a", "b"], "x")).toEqual(["a", "b", "x"]);
    expect(insertRequeue([], "x")).toEqual(["x"]);
  });
});

describe("requeuesInSession", () => {
  it("only repeats forgotten cards inside the session", () => {
    expect(requeuesInSession("FORGOT")).toBe(true);
    expect(requeuesInSession("KNOWN")).toBe(false);
  });
});
