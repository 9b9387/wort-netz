/**
 * Learning status of a word book entry.
 *
 * A server-action module may only export async functions, so the status list
 * lives here and both the server action and the client buttons import it.
 */
export const WORD_STATUSES = [
  "NEW",
  "LEARNING",
  "REVIEWING",
  "MASTERED",
  "SUSPENDED",
] as const;

export type WordStatus = (typeof WORD_STATUSES)[number];

export function isWordStatus(value: unknown): value is WordStatus {
  return (
    typeof value === "string" &&
    (WORD_STATUSES as readonly string[]).includes(value)
  );
}
