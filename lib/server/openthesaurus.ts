import "server-only";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import { fetchJson } from "@/lib/server/http";
import { normalizeLexeme } from "@/lib/server/dwds";

const DEFAULT_BASE_URL =
  process.env.OPENTHESAURUS_BASE_URL ??
  "https://www.openthesaurus.de/synonyme/search";
const CACHE_ENDPOINT = "openthesaurus";
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_SYNONYMS = 24;
const SINGLE_WORD_PATTERN = /^[\p{L}\p{M}ßẞ'’.-]+$/u;
const USER_AGENT =
  process.env.OPENTHESAURUS_USER_AGENT ??
  "WortNetz/0.1 (+https://wortnetz.example)";

type OpenThesaurusTerm = {
  term?: string;
};

type OpenThesaurusSynset = {
  id?: number | string;
  terms?: OpenThesaurusTerm[];
};

export type OpenThesaurusResponse = {
  synsets?: OpenThesaurusSynset[];
};

export type ThesaurusRelatedWord = {
  lemma: string;
  normalizedLemma: string;
  lexemeId: string | null;
};

export class OpenThesaurusUnavailableError extends Error {
  constructor(message = "OpenThesaurus unavailable") {
    super(message);
    this.name = "OpenThesaurusUnavailableError";
  }
}

export function parseOpenThesaurusSynonyms(
  response: OpenThesaurusResponse,
  sourceLemma: string,
): string[] {
  const source = normalizeLexeme(sourceLemma);
  const words = new Map<string, string>();

  for (const synset of response.synsets ?? []) {
    for (const term of synset.terms ?? []) {
      if (typeof term.term !== "string") {
        continue;
      }

      const lemma = term.term.normalize("NFC").trim();

      if (
        lemma.length === 0 ||
        lemma.length > 80 ||
        !SINGLE_WORD_PATTERN.test(lemma)
      ) {
        continue;
      }

      const normalized = normalizeLexeme(lemma);

      if (normalized !== source && !words.has(normalized)) {
        words.set(normalized, lemma);
      }

      if (words.size >= MAX_SYNONYMS) {
        break;
      }
    }

    if (words.size >= MAX_SYNONYMS) {
      break;
    }
  }

  return Array.from(words.values());
}

async function fetchSynonyms(query: string): Promise<string[]> {
  const url = new URL(DEFAULT_BASE_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "application/json");

  const response = await fetchJson<OpenThesaurusResponse>(
    url.toString(),
    undefined,
    { "User-Agent": USER_AGENT },
  );
  return parseOpenThesaurusSynonyms(response, query);
}

async function getSynonymsCached(query: string): Promise<string[]> {
  const normalizedQuery = normalizeLexeme(query);
  const cached = await prisma.dwdsCache.findUnique({
    where: {
      endpoint_query: {
        endpoint: CACHE_ENDPOINT,
        query: normalizedQuery,
      },
    },
  });

  if (
    cached &&
    cached.fetchedAt.getTime() > Date.now() - CACHE_TTL_MS
  ) {
    return cached.payload as unknown as string[];
  }

  const synonyms = await fetchSynonyms(query);

  await prisma.dwdsCache.upsert({
    where: {
      endpoint_query: {
        endpoint: CACHE_ENDPOINT,
        query: normalizedQuery,
      },
    },
    update: {
      payload: synonyms as unknown as Prisma.InputJsonValue,
      fetchedAt: new Date(),
    },
    create: {
      endpoint: CACHE_ENDPOINT,
      query: normalizedQuery,
      payload: synonyms as unknown as Prisma.InputJsonValue,
    },
  });

  return synonyms;
}

async function attachLexemeIds(
  words: string[],
): Promise<ThesaurusRelatedWord[]> {
  const normalizedLemmas = words.map(normalizeLexeme);
  const lexemes =
    normalizedLemmas.length === 0
      ? []
      : await prisma.lexeme.findMany({
          where: {
            normalizedLemma: {
              in: normalizedLemmas,
            },
          },
          select: {
            id: true,
            normalizedLemma: true,
          },
        });
  const idByLemma = new Map(
    lexemes.map((lexeme) => [lexeme.normalizedLemma, lexeme.id]),
  );

  return words.map((word) => {
    const normalized = normalizeLexeme(word);

    return {
      lemma: word,
      normalizedLemma: normalized,
      lexemeId: idByLemma.get(normalized) ?? null,
    };
  });
}

async function syncRelations(
  lexeme: { id: string; canonicalLemma: string },
  words: string[],
): Promise<ThesaurusRelatedWord[]> {
  const wordsWithIds = await attachLexemeIds(words);

  await prisma.$transaction(async (tx) => {
    await tx.lexemeRelation.deleteMany({
      where: {
        sourceLexemeId: lexeme.id,
        relationType: "synonym",
        sourceName: "openthesaurus",
      },
    });

    if (wordsWithIds.length > 0) {
      await tx.lexemeRelation.createMany({
        data: wordsWithIds.map((word) => ({
          sourceLexemeId: lexeme.id,
          targetLexemeId: word.lexemeId,
          targetLemma: word.lemma,
          targetNormalizedLemma: word.normalizedLemma,
          relationType: "synonym",
          sourceName: "openthesaurus",
          sourceData: {
            source: "OpenThesaurus",
            sourceUrl: "https://www.openthesaurus.de",
            license: "CC BY-SA 4.0",
          },
        })),
        skipDuplicates: true,
      });
    }
  });

  return wordsWithIds;
}

export async function getOpenThesaurusSynonyms(lexeme: {
  id: string;
  canonicalLemma: string;
}): Promise<ThesaurusRelatedWord[]> {
  const stored = await prisma.lexemeRelation.findMany({
    where: {
      sourceLexemeId: lexeme.id,
      relationType: "synonym",
      sourceName: "openthesaurus",
    },
    orderBy: {
      targetLemma: "asc",
    },
    take: MAX_SYNONYMS,
  });

  if (stored.length > 0) {
    return stored.map((relation) => ({
      lemma: relation.targetLemma,
      normalizedLemma: relation.targetNormalizedLemma,
      lexemeId: relation.targetLexemeId,
    }));
  }

  try {
    const words = await getSynonymsCached(lexeme.canonicalLemma);
    return await syncRelations(lexeme, words);
  } catch (error) {
    console.error("OpenThesaurus lookup failed", {
      lemma: lexeme.canonicalLemma,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}
