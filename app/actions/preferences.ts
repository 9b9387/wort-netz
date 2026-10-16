"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server/auth";

const panelSchema = z.object({
  open: z.boolean(),
});

/**
 * Remembers whether the AI assistant sidebar is expanded. It is a single global
 * preference per user, stored on the profile.
 */
export async function setAiPanelOpen(open: boolean): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const parsed = panelSchema.safeParse({ open });

  if (!parsed.success) {
    return { ok: false };
  }

  await prisma.profile.update({
    where: { id: user.id },
    data: { aiPanelOpen: parsed.data.open },
  });

  return { ok: true };
}
