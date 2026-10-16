"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { normalizeSurface } from "@/lib/reader/tokenize";
import { invalidateUserFormIndex } from "@/lib/reader/analyze";
import { isCandidateLemma } from "@/lib/reader/candidates";
import { irregularVerbLemma } from "@/lib/reader/verb-forms";
import { READER_MAX_CHARS } from "@/lib/reader/types";
import {
  ARTICLES_CACHE_TAG,
  createArticle,
  deleteArticle as deleteArticleRow,
  updateArticleUnlearnedCount,
  updateArticle,
} from "@/lib/server/articles";
import { requireUser } from "@/lib/server/auth";
import { DictionaryUnavailableError } from "@/lib/server/dwds";
import {
  findOrCreateFormLexeme,
  findOrCreatePhraseLexeme,
  findOrCreateLexeme,
  LexemeNotFoundError,
  recordEncounter,
} from "@/lib/server/lexemes";
import { isDistinctForm } from "@/lib/wordbook/form-entry";

export type OpenReaderWordReason =
  | "invalid"
  | "not_found"
  | "service_unavailable"
  | "internal";

export type OpenReaderWordResult =
  | { ok: true; lexemeId: string }
  | { ok: false; reason: OpenReaderWordReason };

export type SaveArticleResult =
  | {
      ok: true;
      article: {
        id: string;
        excerpt: string;
        charCount: number;
        updatedAt: string;
      };
    }
  | { ok: false; reason: "invalid" | "empty" | "too_long" | "not_found" };

const uuidSchema = z.string().uuid();
const surfaceSchema = z.string().trim().min(1).max(80);
const singleWordPattern = /^[\p{L}\p{M}ßẞ'’.-]+$/u;

/**
 * Opens one word of the article: makes sure a lexeme exists (reusing the DWDS
 * pipeline only when the word is not in the dictionary yet), records the
 * encounter, and hands the id back so the client can open the detail pane.
 */
export async function openReaderWord(input: {
  surfaceForm: string;
  lexemeId?: string | null;
  /**
   * Lemma the reader analysis resolved for this surface form. Rule-derived
   * lemmas ("Häusern" → "haus") let the click land on the same entry the
   * annotation promised, even when DWDS cannot resolve the surface itself.
   */
  lemma?: string | null;
  countEncounter: boolean;
}): Promise<OpenReaderWordResult> {
  const user = await requireUser();
  const parsedSurface = surfaceSchema.safeParse(input.surfaceForm);

  if (
    !parsedSurface.success ||
    !singleWordPattern.test(parsedSurface.data)
  ) {
    return { ok: false, reason: "invalid" };
  }

  const surfaceForm = parsedSurface.data.normalize("NFC");
  const requestedLexemeId =
    input.lexemeId && uuidSchema.safeParse(input.lexemeId).success
      ? input.lexemeId
      : null;
  const lemmaHint =
    input.lemma &&
    surfaceSchema.safeParse(input.lemma).success &&
    (isCandidateLemma(surfaceForm, input.lemma) ||
      irregularVerbLemma(normalizeSurface(surfaceForm)) ===
        normalizeSurface(input.lemma))
      ? normalizeSurface(input.lemma)
      : null;
  const surfaceKey = normalizeSurface(surfaceForm);

  try {
    let lexemeId = requestedLexemeId;

    if (!lexemeId) {
      const existing = await prisma.lexeme.findUnique({
        where: { normalizedLemma: surfaceKey },
        select: { id: true },
      });

      lexemeId = existing?.id ?? null;
    }

    if (!lexemeId && lemmaHint && lemmaHint !== surfaceKey) {
      const existing = await prisma.lexeme.findUnique({
        where: { normalizedLemma: lemmaHint },
        select: { id: true },
      });

      lexemeId = existing?.id ?? null;
    }

    if (!lexemeId) {
      try {
        const lexeme = await findOrCreateLexeme(surfaceForm);
        lexemeId = lexeme.id;
      } catch (error) {
        // Fall back to the lemma the annotation resolved before giving up.
        if (
          error instanceof LexemeNotFoundError &&
          lemmaHint &&
          lemmaHint !== surfaceKey
        ) {
          const lexeme = await findOrCreateLexeme(lemmaHint);
          lexemeId = lexeme.id;
        } else {
          throw error;
        }
      }
    }

    /**
     * The word the user clicked is stored as its own entry when it is an
     * inflected form: "ist" keeps a row of its own that links to "sein" instead
     * of being merged into it.
     */
    const resolved = await prisma.lexeme.findUnique({
      where: { id: lexemeId },
      select: { canonicalLemma: true },
    });

    if (resolved && isDistinctForm(surfaceForm, resolved.canonicalLemma)) {
      const form = await findOrCreateFormLexeme({
        surfaceForm,
        baseLexemeId: lexemeId,
      });
      lexemeId = form.id;
    }

    if (input.countEncounter) {
      await recordEncounter(user.id, lexemeId, surfaceForm);
    }

    revalidatePath("/dashboard");
    revalidatePath(`/words/${lexemeId}`);
    invalidateUserFormIndex(user.id);

    return { ok: true, lexemeId };
  } catch (error) {
    if (error instanceof LexemeNotFoundError) {
      return { ok: false, reason: "not_found" };
    }

    if (error instanceof DictionaryUnavailableError) {
      return { ok: false, reason: "service_unavailable" };
    }

    console.error("openReaderWord failed", {
      userId: user.id,
      surfaceForm,
      error: error instanceof Error ? error.message : String(error),
    });

    return { ok: false, reason: "internal" };
  }
}

export type OpenReaderPhraseResult =
  | { ok: true; lexemeId: string }
  | { ok: false; reason: "invalid" | "not_found" | "internal" };

const phraseSchema = z.object({
  normalized: z.string().trim().min(3).max(120),
  canonical: z.string().trim().min(1).max(120),
  pos: z.enum(["n", "v", "a", "r", "p", "x"]).nullish(),
  surfaceForm: z.string().trim().min(1).max(120),
  countEncounter: z.boolean(),
});

const phrasePattern = /^[\p{L}\p{M}ßẞ'’.\- ]+$/u;

/**
 * Opens a detected multi-word expression: the phrase becomes a dictionary entry
 * (backed by OdeNet, so it has definitions and examples) and is recorded in the
 * word book like any single word.
 */
export async function openReaderPhrase(input: {
  normalized: string;
  canonical: string;
  pos?: string | null;
  surfaceForm: string;
  countEncounter: boolean;
}): Promise<OpenReaderPhraseResult> {
  const user = await requireUser();
  const parsed = phraseSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, reason: "invalid" };
  }

  const normalized = parsed.data.normalized.normalize("NFC").toLowerCase();

  if (!normalized.includes(" ") || !phrasePattern.test(normalized)) {
    return { ok: false, reason: "invalid" };
  }

  try {
    const lexeme = await findOrCreatePhraseLexeme({
      normalized,
      canonical: parsed.data.canonical,
      pos: parsed.data.pos ?? null,
    });

    if (!lexeme) {
      return { ok: false, reason: "not_found" };
    }

    if (parsed.data.countEncounter) {
      await recordEncounter(user.id, lexeme.id, parsed.data.surfaceForm);
    }

    revalidatePath("/dashboard");
    revalidatePath(`/words/${lexeme.id}`);
    invalidateUserFormIndex(user.id);

    return { ok: true, lexemeId: lexeme.id };
  } catch (error) {
    console.error("openReaderPhrase failed", {
      userId: user.id,
      normalized,
      error: error instanceof Error ? error.message : String(error),
    });

    return { ok: false, reason: "internal" };
  }
}

const saveSchema = z.object({
  id: z.string().uuid().nullish(),
  content: z.string().max(READER_MAX_CHARS),
});

export async function saveArticle(input: {
  id?: string | null;
  content: string;
}): Promise<SaveArticleResult> {
  const user = await requireUser();
  const parsed = saveSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, reason: "invalid" };
  }

  const result = parsed.data.id
    ? await updateArticle(user.id, parsed.data.id, parsed.data.content)
    : await createArticle(user.id, parsed.data.content);

  if (!result.ok) {
    return result;
  }

  revalidatePath("/reader");
  updateTag(ARTICLES_CACHE_TAG);

  return {
    ok: true,
    article: {
      id: result.article.id,
      excerpt: result.article.excerpt,
      charCount: result.article.charCount,
      updatedAt: result.article.updatedAt.toISOString(),
    },
  };
}

const unlearnedCountSchema = z.object({
  articleId: z.string().uuid(),
  unlearnedCount: z.number().int().min(0).max(100_000),
});

/**
 * Records the annotation snapshot of the article that is open in the reader.
 * The article list shows this number, so it has to survive a reload without
 * re-analyzing every article.
 */
export async function saveArticleUnlearnedCount(input: {
  articleId: string;
  unlearnedCount: number;
}): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const parsed = unlearnedCountSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false };
  }

  const changed = await updateArticleUnlearnedCount(
    user.id,
    parsed.data.articleId,
    parsed.data.unlearnedCount,
  );

  if (changed) {
    // The list is cached; drop it so the next render shows the new number.
    updateTag(ARTICLES_CACHE_TAG);
  }

  return { ok: true };
}

export async function deleteArticle(
  id: string,
): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const parsed = uuidSchema.safeParse(id);

  if (!parsed.success) {
    return { ok: false };
  }

  const deleted = await deleteArticleRow(user.id, parsed.data);

  if (deleted) {
    revalidatePath("/reader");
    updateTag(ARTICLES_CACHE_TAG);
  }

  return { ok: deleted };
}
