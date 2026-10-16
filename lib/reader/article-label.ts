export const ARTICLE_EXCERPT_MAX = 40;
export const ARTICLE_EMPTY_LABEL = "（空文章）";

/**
 * The article has no separate title column: the list shows a preview derived
 * from the first non-empty line of the content.
 */
export function deriveArticleExcerpt(content: string): string {
  const trimmed = content.trim();

  if (!trimmed) {
    return ARTICLE_EMPTY_LABEL;
  }

  const firstLine =
    trimmed
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? trimmed;
  const collapsed = firstLine.replace(/\s+/g, " ");

  return collapsed.length > ARTICLE_EXCERPT_MAX
    ? `${collapsed.slice(0, ARTICLE_EXCERPT_MAX)}…`
    : collapsed;
}

export function countArticleChars(content: string): number {
  return content.trim().length;
}

export function summarizeArticle(content: string): {
  excerpt: string;
  charCount: number;
} {
  return {
    excerpt: deriveArticleExcerpt(content),
    charCount: countArticleChars(content),
  };
}
