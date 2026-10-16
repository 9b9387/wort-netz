"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import {
  REVIEW_NEW_PER_DAY_LIMIT,
  REVIEW_SESSION_SIZE_LIMIT,
  applyReviewAnswer,
  buildReviewSession,
  getReviewPlan,
  getReviewOverview,
  loadReviewCard,
  saveReviewPlan,
  saveReviewTimeZone,
} from "@/lib/server/review";
import { REVIEW_RATINGS } from "@/lib/review/schedule";
import type {
  ReviewAnswerResult,
  ReviewCardPayload,
  ReviewOverview,
  ReviewPlan,
  ReviewQueueCard,
} from "@/lib/review/types";

const tzOffsetSchema = z.number().int().min(-840).max(840);
const overviewSchema = z.object({ tzOffsetMinutes: tzOffsetSchema.nullish() });
const cardSchema = z.object({
  lexemeId: z.string().uuid(),
  allowGeneration: z.boolean().optional(),
});
const submitSchema = z.object({
  sessionId: z.string().uuid(),
  clientCardId: z.string().uuid(),
  lexemeId: z.string().uuid(),
  rating: z.enum(REVIEW_RATINGS),
  elapsedMs: z.number().int().min(0).max(3_600_000).nullish(),
  tzOffsetMinutes: tzOffsetSchema,
});
const planSchema = z.object({
  sessionSize: z.number().int().min(1).max(REVIEW_SESSION_SIZE_LIMIT),
  newPerDay: z.number().int().min(0).max(REVIEW_NEW_PER_DAY_LIMIT),
});
const timeZoneSchema = z.object({ tzOffsetMinutes: tzOffsetSchema });

export async function fetchReviewOverview(input: {
  tzOffsetMinutes?: number | null;
}): Promise<ReviewOverview> {
  const user = await requireUser();
  const parsed = overviewSchema.safeParse(input);
  const tzOffsetMinutes = parsed.success
    ? parsed.data.tzOffsetMinutes ?? null
    : null;

  return getReviewOverview(user.id, tzOffsetMinutes);
}

export type ReviewSessionStart = {
  sessionId: string;
  cards: ReviewQueueCard[];
  plan: ReviewPlan;
  /** Content of the first card, so the session can start without a roundtrip. */
  firstCard: ReviewCardPayload | null;
};

/**
 * Builds the queue for one session. Read-only: nothing is scheduled until the
 * first answer arrives, so an abandoned session changes no state.
 */
export async function startReviewSession(input: {
  tzOffsetMinutes?: number | null;
  mode?: "due" | "ahead";
}): Promise<ReviewSessionStart> {
  const user = await requireUser();
  const parsed = overviewSchema.safeParse({
    tzOffsetMinutes: input.tzOffsetMinutes,
  });
  const tzOffsetMinutes = parsed.success
    ? parsed.data.tzOffsetMinutes ?? null
    : null;
  const { cards, plan } = await buildReviewSession({
    userId: user.id,
    requestedTzOffset: tzOffsetMinutes,
    mode: input.mode === "ahead" ? "ahead" : "due",
  });
  const firstCard = cards[0]
    ? await loadReviewCard({
        userId: user.id,
        lexemeId: cards[0].lexemeId,
        allowGeneration: true,
      })
    : null;

  return { sessionId: randomUUID(), cards, plan, firstCard };
}

export async function fetchReviewCard(input: {
  lexemeId: string;
  allowGeneration?: boolean;
}): Promise<ReviewCardPayload | null> {
  const user = await requireUser();
  const parsed = cardSchema.safeParse(input);

  if (!parsed.success) {
    return null;
  }

  return loadReviewCard({
    userId: user.id,
    lexemeId: parsed.data.lexemeId,
    allowGeneration: parsed.data.allowGeneration,
  });
}

export async function submitReviewAnswer(input: {
  sessionId: string;
  clientCardId: string;
  lexemeId: string;
  rating: string;
  elapsedMs?: number | null;
  tzOffsetMinutes: number;
}): Promise<ReviewAnswerResult> {
  const user = await requireUser();
  const parsed = submitSchema.safeParse(input);

  if (!parsed.success) {
    return { status: "inactive" };
  }

  const result = await applyReviewAnswer({
    userId: user.id,
    ...parsed.data,
  });

  if (result.status === "ok") {
    revalidatePath("/review");
    revalidatePath("/words");
    revalidatePath(`/words/${parsed.data.lexemeId}`);
  }

  return result;
}

export async function updateReviewPlan(input: {
  sessionSize: number;
  newPerDay: number;
}): Promise<ReviewPlan> {
  const user = await requireUser();
  const parsed = planSchema.safeParse(input);
  const plan = parsed.success
    ? await saveReviewPlan(user.id, parsed.data)
    : await getReviewPlan(user.id);

  revalidatePath("/review");

  return plan;
}

export async function syncReviewTimeZone(input: {
  tzOffsetMinutes: number;
}): Promise<number> {
  const user = await requireUser();
  const parsed = timeZoneSchema.safeParse(input);

  if (!parsed.success) {
    return 0;
  }

  return saveReviewTimeZone(user.id, parsed.data.tzOffsetMinutes);
}
