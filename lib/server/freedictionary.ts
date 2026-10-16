import "server-only";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import { fetchJson } from "@/lib/server/http";
import { normalizeLexeme } from "@/lib/server/dwds";
import {
  parseFreeDictionaryResponse,
  type EnglishDictionaryResult,
  type FreeDictionaryResponse,
} from "@/lib/server/freedictionary-parser";

const FREE_DICTIONARY_BASE_URL = "https://freedictionaryapi.com/api/v1";
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/**
 * The parsed payload gained structured senses and a part-of-speech aware entry
 * choice, so the old cache rows must not be reused. Bumping the endpoint retires
 * them without a data migration. `v3` also flattens Wiktionary's grouped label
 * senses down to their subsenses.
 */
const CACHE_ENDPOINT = "freedictionary:v3";

export type { EnglishDictionaryResult };

export async function getEnglishDictionaryEntry(
  lemma: string,
  wordType: string | null,
): Promise<EnglishDictionaryResult | null> {
  const normalizedLemma = normalizeLexeme(lemma);
  const cached = await prisma.dwdsCache.findUnique({
    where: {
      endpoint_query: {
        endpoint: CACHE_ENDPOINT,
        query: normalizedLemma,
      },
    },
  });

  if (
    cached &&
    cached.fetchedAt.getTime() > Date.now() - CACHE_TTL_MS
  ) {
    return cached.payload as unknown as EnglishDictionaryResult;
  }

  const response = await fetchJson<FreeDictionaryResponse>(
    `${FREE_DICTIONARY_BASE_URL}/entries/de/${encodeURIComponent(lemma)}`,
  );
  const result = parseFreeDictionaryResponse(response, lemma, wordType);

  if (!result) {
    return null;
  }

  await prisma.dwdsCache.upsert({
    where: {
      endpoint_query: {
        endpoint: CACHE_ENDPOINT,
        query: normalizedLemma,
      },
    },
    update: {
      payload: result as unknown as Prisma.InputJsonValue,
      fetchedAt: new Date(),
    },
    create: {
      endpoint: CACHE_ENDPOINT,
      query: normalizedLemma,
      payload: result as unknown as Prisma.InputJsonValue,
    },
  });

  return result;
}
