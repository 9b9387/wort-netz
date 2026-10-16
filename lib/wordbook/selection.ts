/**
 * Which entry the detail pane shows: the requested one when it is still in the
 * book, otherwise the newest entry — the list arrives sorted by `lastSeenAt`
 * descending, so the first item is the most recently collected word.
 */
export function selectWordBookEntry(
  lexemeIds: readonly string[],
  requested: string | null,
): string | null {
  if (requested && lexemeIds.includes(requested)) {
    return requested;
  }

  return lexemeIds[0] ?? null;
}
