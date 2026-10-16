export type ReaderPaneView = "list" | "word" | "words";

/**
 * Only these interactions move the layout into the detail state; reading
 * tools (speech, filters, stats, font size, copy) never change the layout.
 */
export const READER_DETAIL_ACTIONS = ["select-word", "open-word-list"] as const;

export type ReaderDetailAction = (typeof READER_DETAIL_ACTIONS)[number];

export type ReaderNavigation =
  | { kind: "select-article"; articleId: string }
  | {
      kind: ReaderDetailAction;
      lexemeId?: string;
      /** The form as it appears in the article, e.g. "willst" for "wollen". */
      surface?: string | null;
    }
  | { kind: "back-to-list" }
  | { kind: "close-detail" }
  /** Opens a brand-new, unsaved draft (`/reader?draft=1`). */
  | { kind: "new-draft" }
  /** Clears the selection entirely (`/reader`), used by narrow layouts. */
  | { kind: "clear-article" };

export type ReaderPaneQuery = {
  article?: string | null;
  w?: string | null;
  pane?: string | null;
  draft?: string | null;
};

export function opensDetailPane(action: ReaderNavigation): boolean {
  return action.kind === "select-word" || action.kind === "open-word-list";
}

export function deriveReaderPaneView(query: ReaderPaneQuery): ReaderPaneView {
  if (query.w) {
    return "word";
  }

  return query.pane === "words" ? "words" : "list";
}

export function readerHref(
  query: ReaderPaneQuery,
  action: ReaderNavigation,
): string {
  if (action.kind === "clear-article") {
    return "/reader";
  }

  if (action.kind === "new-draft") {
    return "/reader?draft=1";
  }

  const params = new URLSearchParams();
  const article =
    action.kind === "select-article" ? action.articleId : query.article ?? null;

  if (article) {
    params.set("article", article);
  }

  if (action.kind === "select-word" && action.lexemeId) {
    params.set("w", action.lexemeId);

    const surface = action.surface?.trim();

    if (surface) {
      params.set("s", surface);
    }
  }

  if (action.kind === "open-word-list") {
    params.set("pane", "words");
  }

  const search = params.toString();
  return search ? `/reader?${search}` : "/reader";
}
