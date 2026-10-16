"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/server/auth";
import {
  findOrCreateLexeme,
  LexemeNotFoundError,
  recordEncounter,
} from "@/lib/server/lexemes";
import { DictionaryUnavailableError } from "@/lib/server/dwds";
import { getDictionary } from "@/lib/i18n";

export type CaptureWordState = {
  message?: string;
};

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

  try {
    const lexeme = await findOrCreateLexeme(rawQuery);
    await recordEncounter(user.id, lexeme.id, rawQuery);
    lexemeId = lexeme.id;
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

  redirect(`/words/${lexemeId}`);
}
