import { isWordStatus, type WordStatus } from "./status";

export const WORD_BOOK_SORTS = [
  "recent",
  "alphabet",
  "encounters",
  "due",
] as const;

export type WordBookSort = (typeof WORD_BOOK_SORTS)[number];

export const DEFAULT_WORD_BOOK_SORT: WordBookSort = "recent";

/** Entries loaded per page; the list appends further pages on demand. */
export const WORD_BOOK_PAGE_SIZE = 30;

export type WordBookQuery = {
  sort?: WordBookSort;
  w?: string | null;
  q?: string | null;
  status?: WordStatus | null;
  favorites?: boolean;
};

export function parseWordBookSort(value: unknown): WordBookSort {
  const raw = Array.isArray(value) ? value[0] : value;

  return typeof raw === "string" &&
    (WORD_BOOK_SORTS as readonly string[]).includes(raw)
    ? (raw as WordBookSort)
    : DEFAULT_WORD_BOOK_SORT;
}

/**
 * Builds a word book URL. The default sort is left out so plain links stay
 * short; the selected word is preserved unless it is explicitly replaced.
 */
export function wordBookHref(
  query: WordBookQuery,
  next: WordBookQuery = {},
): string {
  const params = new URLSearchParams();
  const sort = next.sort ?? query.sort ?? DEFAULT_WORD_BOOK_SORT;
  const word = next.w === undefined ? query.w ?? null : next.w;
  const term = (
    next.q === undefined ? query.q ?? "" : next.q ?? ""
  ).trim();
  const status =
    next.status === undefined ? query.status ?? null : next.status;
  const favorites =
    next.favorites === undefined
      ? (query.favorites ?? false)
      : next.favorites;

  if (sort !== DEFAULT_WORD_BOOK_SORT) {
    params.set("sort", sort);
  }

  if (word) {
    params.set("w", word);
  }

  if (term) {
    params.set("q", term);
  }

  if (status) {
    params.set("status", status);
  }

  if (favorites) {
    params.set("fav", "1");
  }

  const search = params.toString();
  return search ? `/words?${search}` : "/words";
}

/** Learning-status filter of the list; `null` means "all statuses". */
export function parseWordBookStatus(value: unknown): WordStatus | null {
  const raw = Array.isArray(value) ? value[0] : value;

  return isWordStatus(raw) ? raw : null;
}

export function parseWordBookFavorites(value: unknown): boolean {
  const raw = Array.isArray(value) ? value[0] : value;

  return raw === "1" || raw === "true";
}

/** Search term for the list filter, capped so it stays a sane query parameter. */
export function parseWordBookQuery(value: unknown): string | null {
  const raw = Array.isArray(value) ? value[0] : value;

  if (typeof raw !== "string") {
    return null;
  }

  const trimmed = raw.trim().slice(0, 60);

  return trimmed ? trimmed : null;
}
