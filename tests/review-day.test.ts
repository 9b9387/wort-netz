import { describe, expect, it } from "vitest";
import {
  localDayBounds,
  localDayKey,
  previousDayKey,
  startOfLocalDay,
  streakFromDayKeys,
} from "../lib/review/day";

/** UTC+8, the value the app defaults to for Chinese-first users. */
const UTC_PLUS_8 = -480;

describe("localDayKey", () => {
  it("cuts the day in the user's timezone, not in UTC", () => {
    const instant = new Date("2026-10-16T17:30:00.000Z");

    expect(localDayKey(instant, UTC_PLUS_8)).toBe("2026-10-17");
    expect(localDayKey(instant, 0)).toBe("2026-10-16");
  });

  it("handles a western offset", () => {
    const instant = new Date("2026-10-16T02:00:00.000Z");

    // UTC-8 (getTimezoneOffset() = 480) is still the previous day.
    expect(localDayKey(instant, 480)).toBe("2026-10-15");
  });
});

describe("startOfLocalDay / localDayBounds", () => {
  it("returns the UTC instant of local midnight", () => {
    expect(startOfLocalDay("2026-10-17", UTC_PLUS_8).toISOString()).toBe(
      "2026-10-16T16:00:00.000Z",
    );
    expect(startOfLocalDay("2026-10-17", 0).toISOString()).toBe(
      "2026-10-17T00:00:00.000Z",
    );
  });

  it("returns a half-open one day range", () => {
    const { start, end } = localDayBounds("2026-10-17", UTC_PLUS_8);

    expect(end.getTime() - start.getTime()).toBe(86_400_000);
    expect(end.toISOString()).toBe("2026-10-17T16:00:00.000Z");
  });
});

describe("previousDayKey", () => {
  it("walks back over month and year boundaries", () => {
    expect(previousDayKey("2026-10-17")).toBe("2026-10-16");
    expect(previousDayKey("2026-11-01")).toBe("2026-10-31");
    expect(previousDayKey("2026-01-01")).toBe("2025-12-31");
  });
});

describe("streakFromDayKeys", () => {
  it("counts consecutive days ending today", () => {
    expect(
      streakFromDayKeys(
        ["2026-10-16", "2026-10-15", "2026-10-14"],
        "2026-10-16",
      ),
    ).toBe(3);
  });

  it("keeps the streak alive when today has no answers yet", () => {
    expect(
      streakFromDayKeys(["2026-10-15", "2026-10-14"], "2026-10-16"),
    ).toBe(2);
  });

  it("stops at the first missing day and ignores duplicate days", () => {
    expect(
      streakFromDayKeys(
        ["2026-10-16", "2026-10-16", "2026-10-15", "2026-10-13"],
        "2026-10-16",
      ),
    ).toBe(2);
  });

  it("returns zero when there is nothing or the last answer is too old", () => {
    expect(streakFromDayKeys([], "2026-10-16")).toBe(0);
    expect(streakFromDayKeys(["2026-10-10"], "2026-10-16")).toBe(0);
  });
});
