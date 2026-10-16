import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { summarizeArticle } from "@/lib/reader/article-label";
import { READER_MAX_CHARS } from "@/lib/reader/types";

export const ARTICLE_LIST_LIMIT = 30;

/**
 * Reader screens re-read the article list and the open article on every word
 * click, so both reads are cached per user for a short window and invalidated
 * explicitly whenever an article is saved or deleted.
 */
export const ARTICLES_CACHE_TAG = "articles";

export type ArticleSummary = {
  id: string;
  excerpt: string;
  charCount: number;
  /** Unlearned words from the last annotation, `null` before the first open. */
  unlearnedCount: number | null;
  updatedAt: Date;
};

export type ArticleRecord = {
  id: string;
  content: string;
  updatedAt: Date;
};

export type SaveArticleOutcome =
  | { ok: true; article: ArticleSummary }
  | { ok: false; reason: "empty" | "too_long" | "not_found" };

export async function listArticles(
  userId: string,
  limit = ARTICLE_LIST_LIMIT,
): Promise<ArticleSummary[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(ARTICLES_CACHE_TAG);

  return prisma.article.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      excerpt: true,
      charCount: true,
      unlearnedCount: true,
      updatedAt: true,
    },
  });
}

/**
 * Stores the annotation snapshot of one article. Called when the reader opens
 * (and thus analyzes) an article, so the list can show the number without
 * re-analyzing every article on every page view.
 */
export async function updateArticleUnlearnedCount(
  userId: string,
  id: string,
  unlearnedCount: number,
): Promise<boolean> {
  const existing = await prisma.article.findFirst({
    where: { id, userId },
    select: { unlearnedCount: true },
  });

  if (!existing || existing.unlearnedCount === unlearnedCount) {
    return false;
  }

  await prisma.article.update({
    where: { id },
    data: { unlearnedCount },
  });

  return true;
}

export async function getArticle(
  userId: string,
  id: string,
): Promise<ArticleRecord | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(ARTICLES_CACHE_TAG);

  return prisma.article.findFirst({
    where: { id, userId },
    select: {
      id: true,
      content: true,
      updatedAt: true,
    },
  });
}

function validateContent(
  content: string,
): { ok: true; content: string } | { ok: false; reason: "empty" | "too_long" } {
  if (content.length > READER_MAX_CHARS) {
    return { ok: false, reason: "too_long" };
  }

  if (!content.trim()) {
    return { ok: false, reason: "empty" };
  }

  return { ok: true, content };
}

export async function createArticle(
  userId: string,
  content: string,
): Promise<SaveArticleOutcome> {
  const validated = validateContent(content);

  if (!validated.ok) {
    return validated;
  }

  const derived = summarizeArticle(validated.content);
  const article = await prisma.article.create({
    data: {
      userId,
      content: validated.content,
      excerpt: derived.excerpt,
      charCount: derived.charCount,
    },
    select: {
      id: true,
      excerpt: true,
      charCount: true,
      unlearnedCount: true,
      updatedAt: true,
    },
  });

  return { ok: true, article };
}

export async function updateArticle(
  userId: string,
  id: string,
  content: string,
): Promise<SaveArticleOutcome> {
  const validated = validateContent(content);

  if (!validated.ok) {
    return validated;
  }

  const existing = await prisma.article.findFirst({
    where: { id, userId },
    select: { id: true },
  });

  if (!existing) {
    return { ok: false, reason: "not_found" };
  }

  const derived = summarizeArticle(validated.content);
  const article = await prisma.article.update({
    where: { id },
    data: {
      content: validated.content,
      excerpt: derived.excerpt,
      charCount: derived.charCount,
      // The stored annotation no longer matches the edited text.
      unlearnedCount: null,
    },
    select: {
      id: true,
      excerpt: true,
      charCount: true,
      unlearnedCount: true,
      updatedAt: true,
    },
  });

  return { ok: true, article };
}

export async function deleteArticle(
  userId: string,
  id: string,
): Promise<boolean> {
  const existing = await prisma.article.findFirst({
    where: { id, userId },
    select: { id: true },
  });

  if (!existing) {
    return false;
  }

  await prisma.article.delete({ where: { id } });
  return true;
}
