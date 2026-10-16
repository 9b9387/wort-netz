"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/server/auth";
import {
  findOrCreateFormLexeme,
  findOrCreateLexeme,
  LexemeNotFoundError,
  recordEncounter,
} from "@/lib/server/lexemes";
import { isDistinctForm } from "@/lib/wordbook/form-entry";
import { invalidateUserFormIndex } from "@/lib/reader/analyze";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DictionaryUnavailableError } from "@/lib/server/dwds";
import { getDictionary } from "@/lib/i18n";

export type CaptureWordState = {
  message?: string;
};

export type AddWordToBookResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "internal" };

const addToBookSchema = z.object({
  lexemeId: z.string().uuid(),
  surfaceForm: z.string().trim().max(80).nullish(),
});

/**
 * Adds an existing entry to the user's word book. Looking a word up (for example
 * from a definition or a synonym chip) does not do this on its own — the user
 * has to press the button.
 */
export async function addWordToBook(input: {
  lexemeId: string;
  surfaceForm?: string | null;
}): Promise<AddWordToBookResult> {
  const user = await requireUser();
  const parsed = addToBookSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, reason: "invalid" };
  }

  const lexeme = await prisma.lexeme.findUnique({
    where: { id: parsed.data.lexemeId },
    select: { canonicalLemma: true },
  });

  if (!lexeme) {
    return { ok: false, reason: "invalid" };
  }

  await recordEncounter(
    user.id,
    parsed.data.lexemeId,
    parsed.data.surfaceForm?.trim() || lexeme.canonicalLemma,
  );

  revalidatePath("/words");
  revalidatePath("/dashboard");
  // The reader annotates from a cached word book; drop it so the word shows as
  // learned the next time an article is analyzed.
  invalidateUserFormIndex(user.id);

  return { ok: true };
}

export async function captureWord(
  _previousState: CaptureWordState,
  formData: FormData,
): Promise<CaptureWordState> {
  const t = getDictionary("zh");
  const user = await requireUser();
  const rawQuery = String(formData.get("query") ?? "").normalize("NFC").trim();
  const singleWordPattern = /^[\p{L}\p{M}ßẞ'’.-]+$/u;

  if (
    rawQuery.length === 0 ||
    rawQuery.length > 80 ||
    !singleWordPattern.test(rawQuery)
  ) {
    return { message: t.invalidQuery };
  }

  let lexemeId: string | null = null;
  let canonicalLemma: string | null = null;

  try {
    const lexeme = await findOrCreateLexeme(rawQuery);

    // Searching an inflected form stores that form as its own entry linked to
    // the lemma: "ist" stays "ist" instead of becoming "sein".
    if (isDistinctForm(rawQuery, lexeme.canonicalLemma)) {
      const form = await findOrCreateFormLexeme({
        surfaceForm: rawQuery,
        baseLexemeId: lexeme.id,
      });

      lexemeId = form.id;
      canonicalLemma = form.canonicalLemma;
    } else {
      lexemeId = lexeme.id;
      canonicalLemma = lexeme.canonicalLemma;
    }

    await recordEncounter(user.id, lexemeId, rawQuery);
  } catch (error) {
    if (error instanceof LexemeNotFoundError) {
      return { message: t.notFound };
    }

    if (error instanceof DictionaryUnavailableError) {
      return { message: t.serviceUnavailable };
    }

    console.error("captureWord failed", {
      query: rawQuery,
      error: error instanceof Error ? error.message : String(error),
    });

    return { message: t.internalError };
  }

  if (!lexemeId) {
    return { message: t.internalError };
  }

  // Carry the searched form along when it is an inflected form of the entry, so
  // the word card can show "ist" with "原型: sein" instead of only "sein".
  const searched = rawQuery.normalize("NFC").trim().toLowerCase();
  const canonical = (canonicalLemma ?? "").normalize("NFC").trim().toLowerCase();

  redirect(
    searched && searched !== canonical
      ? `/words/${lexemeId}?s=${encodeURIComponent(rawQuery)}`
      : `/words/${lexemeId}`,
  );
}
