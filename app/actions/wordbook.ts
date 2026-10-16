"use server";

import { z } from "zod";
import { getWordBookWords } from "@/lib/server/lexemes";
import { requireUser } from "@/lib/server/auth";
import {
  WORD_BOOK_PAGE_SIZE,
  WORD_BOOK_SORTS,
  type WordBookSort,
} from "@/lib/wordbook/sort";
import { WORD_STATUSES, type WordStatus } from "@/lib/wordbook/status";

export type WordBookPageEntry = {
  lexemeId: string;
  canonicalLemma: string;
  wordType: string | null;
  ipa: string | null;
  level: string | null;
  isFavorite: boolean;
  definitionEn: string | null;
  gloss: string | null;
  baseLemma: string | null;
  status: string;
  encounterCount: number;
  lastSeenAt: string;
};

const pageSchema = z.object({
  sort: z.enum(WORD_BOOK_SORTS),
  query: z.string().trim().max(60).nullish(),
  status: z.enum(WORD_STATUSES).nullish(),
  favorites: z.boolean().nullish(),
  offset: z.number().int().min(0).max(100_000),
});

/** Appends one page to the word book list. */
export async function loadWordBookPage(input: {
  sort: WordBookSort;
  query?: string | null;
  status?: WordStatus | null;
  favorites?: boolean;
  offset: number;
}): Promise<{ words: WordBookPageEntry[]; hasMore: boolean }> {
  const user = await requireUser();
  const parsed = pageSchema.safeParse(input);

  if (!parsed.success) {
    return { words: [], hasMore: false };
  }

  const { words, hasMore } = await getWordBookWords(user.id, {
    sort: parsed.data.sort,
    query: parsed.data.query,
    status: parsed.data.status,
    favorites: parsed.data.favorites ?? false,
    offset: parsed.data.offset,
    limit: WORD_BOOK_PAGE_SIZE,
  });

  return {
    words: words.map((word) => ({
      lexemeId: word.lexemeId,
      canonicalLemma: word.canonicalLemma,
      wordType: word.wordType,
      ipa: word.ipa,
      level: word.level,
      isFavorite: word.isFavorite,
      definitionEn: word.definitionEn,
      gloss: word.gloss,
      baseLemma: word.baseLemma,
      status: word.status,
      encounterCount: word.encounterCount,
      lastSeenAt: word.lastSeenAt.toISOString(),
    })),
    hasMore,
  };
}
