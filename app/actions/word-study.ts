"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server/auth";

export type WordStudyState = {
  message?: string;
};

const lexemeIdSchema = z.string().uuid();
const noteSchema = z.object({
  lexemeId: z.string().uuid(),
  content: z.string().trim().max(5000),
});
export async function saveWordNote(
  _previousState: WordStudyState,
  formData: FormData,
): Promise<WordStudyState> {
  const user = await requireUser();
  const parsed = noteSchema.safeParse({
    lexemeId: formData.get("lexemeId"),
    content: formData.get("content"),
  });

  if (!parsed.success) {
    return { message: "invalid" };
  }

  const lexeme = await prisma.lexeme.findUnique({
    where: { id: parsed.data.lexemeId },
    select: { id: true },
  });

  if (!lexeme) {
    return { message: "not_found" };
  }

  await prisma.userWordNote.upsert({
    where: {
      userId_lexemeId: {
        userId: user.id,
        lexemeId: parsed.data.lexemeId,
      },
    },
    update: {
      content: parsed.data.content,
    },
    create: {
      userId: user.id,
      lexemeId: parsed.data.lexemeId,
      content: parsed.data.content,
    },
  });

  revalidatePath(`/words/${parsed.data.lexemeId}`);

  return { message: "saved" };
}

export async function toggleFavorite(
  lexemeId: string,
  currentValue: boolean,
): Promise<void> {
  const user = await requireUser();
  const parsed = lexemeIdSchema.safeParse(lexemeId);

  if (!parsed.success) {
    return;
  }

  await prisma.userLexeme.upsert({
    where: {
      userId_lexemeId: {
        userId: user.id,
        lexemeId: parsed.data,
      },
    },
    update: {
      isFavorite: !currentValue,
    },
    create: {
      userId: user.id,
      lexemeId: parsed.data,
      isFavorite: true,
    },
  });

  revalidatePath(`/words/${parsed.data}`);
}
