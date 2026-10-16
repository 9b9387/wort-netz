import "server-only";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import { normalizeLexeme } from "@/lib/server/dwds";
import { fetchJson } from "@/lib/server/http";
import {
  parseTatoebaSentences,
  type TatoebaSentence,
} from "@/lib/server/tatoeba-parser";

const TATOEBA_BASE_URL =
  process.env.TATOEBA_BASE_URL ?? "https://tatoeba.org/en/api_v0";

/** Sentences rarely change, so cached payloads stay valid for a month. */
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CACHE_VERSION = 1;
const SOURCE_LANGUAGE = "deu";
/** Server-side sentence-length window; mirrors the parser guards. */
const MIN_WORDS = 4;
const MAX_WORDS = 16;
/** Sentences stored per lemma, so different page limits reuse one payload. */
const CACHED_LIMIT = 6;
const MIN_TRANSLATED_SENTENCES = 3;

type CachedPayload = {
  version: number;
  sentences: TatoebaSentence[];
};

/**
 * Set when the cache table is missing (migration not applied yet). Example
 * sentences then keep working straight from the API, without repeated logs.
 */
let cacheDisabled = false;
let cacheDisabledLogged = false;

function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const { code, message } = error as { code?: unknown; message?: unknown };

  if (code === "P2021") {
    return true;
  }

  return (
    typeof message === "string" &&
    /(does not exist|doesn't exist|undefined table)/i.test(message)
  );
}

function disableCache(): void {
  cacheDisabled = true;

  if (cacheDisabledLogged) {
    return;
  }

  cacheDisabledLogged = true;
  console.warn(
    "tatoeba_cache table is missing, so Tatoeba example sentences are fetched without caching. Run `npm run db:migrate` to create it.",
  );
}

function logFailure(message: string, error: unknown): void {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`${message}: ${detail}`);
}

function searchUrl(lemma: string, withTranslation: boolean): string {
  const url = new URL(`${TATOEBA_BASE_URL}/search`);
  url.searchParams.set("from", SOURCE_LANGUAGE);
  url.searchParams.set("query", lemma);
  url.searchParams.set("word_count_min", String(MIN_WORDS));
  url.searchParams.set("word_count_max", String(MAX_WORDS));

  if (withTranslation) {
    // Restrict to sentences that already have a community Chinese translation.
    url.searchParams.set("to", "cmn");
  }

  return url.toString();
}

async function fetchSentences(
  input: {
    lemma: string;
    forms?: readonly string[];
    limit: number;
  },
  withTranslation: boolean,
): Promise<TatoebaSentence[]> {
  const raw = await fetchJson<unknown>(searchUrl(input.lemma, withTranslation));

  return parseTatoebaSentences(raw, {
    lemma: input.lemma,
    forms: input.forms,
    limit: input.limit,
  });
}

function mergeSentences(
  primary: readonly TatoebaSentence[],
  secondary: readonly TatoebaSentence[],
  limit: number,
): TatoebaSentence[] {
  const merged: TatoebaSentence[] = [];
  const seen = new Set<string>();

  for (const sentence of [...primary, ...secondary]) {
    const key = sentence.text.normalize("NFC").trim().toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    merged.push(sentence);

    if (merged.length >= limit) {
      break;
    }
  }

  return merged;
}

function readCachedPayload(payload: unknown): TatoebaSentence[] | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const record = payload as Partial<CachedPayload>;

  if (record.version !== CACHE_VERSION || !Array.isArray(record.sentences)) {
    return null;
  }

  return record.sentences;
}

async function readCache(
  query: string,
): Promise<{ sentences: TatoebaSentence[]; fresh: boolean } | null> {
  if (cacheDisabled) {
    return null;
  }

  try {
    const cached = await prisma.tatoebaCache.findUnique({ where: { query } });

    if (!cached) {
      return null;
    }

    const sentences = readCachedPayload(cached.payload);

    if (!sentences) {
      return null;
    }

    return {
      sentences,
      fresh: cached.fetchedAt.getTime() > Date.now() - CACHE_TTL_MS,
    };
  } catch (error) {
    if (isMissingTableError(error)) {
      disableCache();
      return null;
    }

    logFailure(`Tatoeba cache read failed for "${query}"`, error);
    return null;
  }
}

async function writeCache(
  query: string,
  sentences: TatoebaSentence[],
): Promise<void> {
  if (cacheDisabled) {
    return;
  }

  const payload = {
    version: CACHE_VERSION,
    sentences,
  } satisfies CachedPayload;

  try {
    await prisma.tatoebaCache.upsert({
      where: { query },
      update: {
        payload: payload as unknown as Prisma.InputJsonValue,
        fetchedAt: new Date(),
      },
      create: {
        query,
        payload: payload as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    if (isMissingTableError(error)) {
      disableCache();
      return;
    }

    logFailure(`Tatoeba cache write failed for "${query}"`, error);
  }
}

/**
 * Example sentences for a lemma, served from the `tatoeba_cache` table when a
 * fresh payload exists. Network failures degrade to an empty list so the word
 * page keeps rendering with the other sources.
 */
export async function getTatoebaSentences(input: {
  lemma: string;
  forms?: readonly string[];
  limit?: number;
}): Promise<TatoebaSentence[]> {
  const query = normalizeLexeme(input.lemma);
  const limit = input.limit ?? CACHED_LIMIT;

  if (!query) {
    return [];
  }

  const cached = await readCache(query);

  if (cached?.fresh) {
    return cached.sentences.slice(0, limit);
  }

  try {
    const fetchLimit = Math.max(limit, CACHED_LIMIT);
    const withTranslation = await fetchSentences(
      { lemma: input.lemma, forms: input.forms, limit: fetchLimit },
      true,
    );
    // Rare lemmas often have no Chinese translation, so widen to all German
    // sentences before giving up.
    const sentences =
      withTranslation.length >= Math.min(MIN_TRANSLATED_SENTENCES, limit)
        ? withTranslation
        : mergeSentences(
            withTranslation,
            await fetchSentences(
              { lemma: input.lemma, forms: input.forms, limit: fetchLimit },
              false,
            ),
            fetchLimit,
          );

    await writeCache(query, sentences);

    return sentences.slice(0, limit);
  } catch (error) {
    logFailure(`Tatoeba lookup failed for "${input.lemma}"`, error);

    return cached?.sentences.slice(0, limit) ?? [];
  }
}
