/**
 * Local-day bucketing for the review stats.
 *
 * Review timestamps are stored in UTC, but "today" has to follow the user, so
 * every calculation shifts the instant by the user's UTC offset. The offset uses
 * the JavaScript `Date#getTimezoneOffset()` sign convention: UTC+8 is -480 and
 * local time is `utc - offset`.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function offsetMs(tzOffsetMinutes: number): number {
  return Number.isFinite(tzOffsetMinutes) ? tzOffsetMinutes * 60_000 : 0;
}

/** Shifts the instant into the user's wall clock, keeping UTC getters valid. */
function shiftToLocal(date: Date, tzOffsetMinutes: number): Date {
  return new Date(date.getTime() - offsetMs(tzOffsetMinutes));
}

/** `2026-10-16` for the local day the instant falls into. */
export function localDayKey(date: Date, tzOffsetMinutes: number): string {
  const local = shiftToLocal(date, tzOffsetMinutes);

  return [
    local.getUTCFullYear(),
    pad(local.getUTCMonth() + 1),
    pad(local.getUTCDate()),
  ].join("-");
}

/** The UTC instant when the given local day starts. */
export function startOfLocalDay(
  dayKey: string,
  tzOffsetMinutes: number,
): Date {
  const [year, month, day] = dayKey.split("-").map(Number);
  const utcMidnight = Date.UTC(year, (month ?? 1) - 1, day ?? 1);

  return new Date(utcMidnight + offsetMs(tzOffsetMinutes));
}

/** Half-open `[start, end)` range of a local day, for `reviewedAt` filters. */
export function localDayBounds(
  dayKey: string,
  tzOffsetMinutes: number,
): { start: Date; end: Date } {
  const start = startOfLocalDay(dayKey, tzOffsetMinutes);

  return { start, end: new Date(start.getTime() + DAY_MS) };
}

/** The day before `dayKey`, used by the streak walk. */
export function previousDayKey(dayKey: string): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  const previous = new Date(Date.UTC(year, (month ?? 1) - 1, (day ?? 1) - 1));

  return [
    previous.getUTCFullYear(),
    pad(previous.getUTCMonth() + 1),
    pad(previous.getUTCDate()),
  ].join("-");
}

/**
 * Consecutive review days ending today, or ending yesterday when today has no
 * answers yet — a streak stays alive until the day is over.
 */
export function streakFromDayKeys(
  dayKeys: readonly string[],
  todayKey: string,
): number {
  const days = new Set(dayKeys.filter(Boolean));

  if (days.size === 0) {
    return 0;
  }

  let cursor = days.has(todayKey) ? todayKey : previousDayKey(todayKey);
  let streak = 0;

  while (days.has(cursor)) {
    streak += 1;
    cursor = previousDayKey(cursor);
  }

  return streak;
}
