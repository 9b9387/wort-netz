import "server-only";

import { prisma } from "@/lib/prisma";
import { parseFormsJson } from "@/lib/word-detail-data";
import { resolveDefinitionSets } from "@/lib/word-display";
import { DAY_MS, localDayBounds, localDayKey, streakFromDayKeys } from "@/lib/review/day";
import {
  applyRating,
  clampBox,
  isReviewRating,
  type ReviewRating,
} from "@/lib/review/schedule";
import { findHighlightRanges } from "@/lib/review/highlight";
import {
  planSession,
  requeuesInSession,
  type ReviewQueueCandidate,
} from "@/lib/review/queue";
import {
  buildHighlightTarget,
  highlightText,
  parseGeneratedSentence,
  selectReviewSentence,
  validateGeneratedSentence,
} from "@/lib/review/sentence";
import {
  getUserLlmRuntimeConfig,
  llmConfigHash,
  type LlmRuntimeConfig,
} from "@/lib/server/llm-config";
import {
  DEFAULT_ASSISTANT_SYSTEM_PROMPT,
  streamLlmChat,
  type LlmChatMessage,
} from "@/lib/server/llm";
import { loadTatoebaSentences } from "@/lib/server/tatoeba";
import { sortVocabularyLevels } from "@/lib/server/vocabulary-levels";
import { getWordnetContentForLexeme } from "@/lib/server/wordnet";
import {
  buildEnglishDefinitions,
  primarySenseText,
  readLexemeSenses,
} from "@/lib/word-senses";
import type {
  RecentReview,
  ReviewAnswerResult,
  ReviewCardPayload,
  ReviewOverview,
  ReviewPlan,
  ReviewQueueCard,
} from "@/lib/review/types";

/** Values used when a profile row is missing or holds something unreadable. */
export const REVIEW_DEFAULTS = {
  sessionSize: 20,
  newPerDay: 20,
  tzOffsetMinutes: -480,
} as const;

export const REVIEW_SESSION_SIZE_LIMIT = 100;
export const REVIEW_NEW_PER_DAY_LIMIT = 100;

/** How many words the streak lookup walks back over. */
const STREAK_WINDOW_DAYS = 400;
/** Upper bound on the rows the streak lookup reads. */
const STREAK_LOG_LIMIT = 5000;

function clampInt(
  value: number | null | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(value), min), max);
}

function normalizeTzOffset(value: number | null | undefined): number {
  return clampInt(value, -840, 840, REVIEW_DEFAULTS.tzOffsetMinutes);
}

function readPhraseGloss(sourceJson: unknown): string | null {
  if (!sourceJson || typeof sourceJson !== "object" || Array.isArray(sourceJson)) {
    return null;
  }

  const gloss = (sourceJson as { gloss?: unknown }).gloss;

  return typeof gloss === "string" && gloss.trim() ? gloss.trim() : null;
}

function isUniqueConstraintError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const { code, message } = error as { code?: unknown; message?: unknown };

  if (code === "P2002") {
    return true;
  }

  return (
    typeof message === "string" &&
    /unique constraint|duplicate key/i.test(message)
  );
}

/**
 * True when a query hit a table the migration has not created yet. The word
 * page reads the review history, so it must keep rendering while the review
 * migration is still pending — the same tolerance the Tatoeba cache has.
 */
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

export async function getReviewPlan(userId: string): Promise<ReviewPlan> {
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: {
      reviewSessionSize: true,
      reviewNewPerDay: true,
      reviewTzOffsetMinutes: true,
    },
  });

  return {
    sessionSize: clampInt(
      profile?.reviewSessionSize,
      1,
      REVIEW_SESSION_SIZE_LIMIT,
      REVIEW_DEFAULTS.sessionSize,
    ),
    newPerDay: clampInt(
      profile?.reviewNewPerDay,
      0,
      REVIEW_NEW_PER_DAY_LIMIT,
      REVIEW_DEFAULTS.newPerDay,
    ),
    tzOffsetMinutes: normalizeTzOffset(profile?.reviewTzOffsetMinutes),
  };
}

export async function saveReviewPlan(
  userId: string,
  input: { sessionSize: number; newPerDay: number },
): Promise<ReviewPlan> {
  const sessionSize = clampInt(
    input.sessionSize,
    1,
    REVIEW_SESSION_SIZE_LIMIT,
    REVIEW_DEFAULTS.sessionSize,
  );
  const newPerDay = clampInt(
    input.newPerDay,
    0,
    REVIEW_NEW_PER_DAY_LIMIT,
    REVIEW_DEFAULTS.newPerDay,
  );

  await prisma.profile.update({
    where: { id: userId },
    data: { reviewSessionSize: sessionSize, reviewNewPerDay: newPerDay },
  });

  const plan = await getReviewPlan(userId);

  return { ...plan, sessionSize, newPerDay };
}

export async function saveReviewTimeZone(
  userId: string,
  tzOffsetMinutes: number,
): Promise<number> {
  const offset = normalizeTzOffset(tzOffsetMinutes);

  await prisma.profile.update({
    where: { id: userId },
    data: { reviewTzOffsetMinutes: offset },
  });

  return offset;
}

/** New words introduced so far in the user's current local day. */
export async function countNewWordsToday(
  userId: string,
  tzOffsetMinutes: number,
  now: Date = new Date(),
): Promise<number> {
  const { start, end } = localDayBounds(
    localDayKey(now, tzOffsetMinutes),
    tzOffsetMinutes,
  );

  return prisma.reviewLog.count({
    where: {
      userId,
      boxBefore: 0,
      reviewedAt: { gte: start, lt: end },
    },
  });
}

export async function getReviewStreak(
  userId: string,
  tzOffsetMinutes: number,
  now: Date = new Date(),
): Promise<number> {
  const logs = await prisma.reviewLog.findMany({
    where: {
      userId,
      reviewedAt: { gte: new Date(now.getTime() - STREAK_WINDOW_DAYS * DAY_MS) },
    },
    orderBy: { reviewedAt: "desc" },
    take: STREAK_LOG_LIMIT,
    select: { reviewedAt: true, tzOffsetMinutes: true },
  });

  const dayKeys = logs.map((log) =>
    localDayKey(log.reviewedAt, log.tzOffsetMinutes),
  );

  return streakFromDayKeys(dayKeys, localDayKey(now, tzOffsetMinutes));
}

export async function getReviewOverview(
  userId: string,
  requestedTzOffset?: number | null,
): Promise<ReviewOverview> {
  const plan = await getReviewPlan(userId);
  const tzOffsetMinutes = normalizeTzOffset(
    requestedTzOffset ?? plan.tzOffsetMinutes,
  );
  const now = new Date();
  const { start, end } = localDayBounds(
    localDayKey(now, tzOffsetMinutes),
    tzOffsetMinutes,
  );

  const [
    dueCount,
    newCount,
    todayNewCount,
    todayReviewedCount,
    streakDays,
    nextDue,
  ] = await Promise.all([
    prisma.userLexeme.count({
      where: {
        userId,
        status: { in: ["LEARNING", "REVIEWING"] },
        dueAt: { lte: now },
      },
    }),
    prisma.userLexeme.count({
      where: { userId, status: "NEW", repetitions: 0 },
    }),
    prisma.reviewLog.count({
      where: { userId, boxBefore: 0, reviewedAt: { gte: start, lt: end } },
    }),
    prisma.reviewLog.count({
      where: { userId, reviewedAt: { gte: start, lt: end } },
    }),
    getReviewStreak(userId, tzOffsetMinutes, now),
    prisma.userLexeme.findFirst({
      where: {
        userId,
        status: { in: ["LEARNING", "REVIEWING"] },
        dueAt: { gt: now },
      },
      orderBy: { dueAt: "asc" },
      select: { dueAt: true },
    }),
  ]);

  return {
    dueCount,
    newCount,
    todayNewCount,
    todayReviewedCount,
    streakDays,
    sessionSize: plan.sessionSize,
    newPerDay: plan.newPerDay,
    nextDueAt: nextDue?.dueAt ? nextDue.dueAt.toISOString() : null,
  };
}

const REVIEW_QUEUE_SELECT = {
  lexemeId: true,
  lastSeenAt: true,
  leitnerBox: true,
  dueAt: true,
  lexeme: {
    select: {
      canonicalLemma: true,
      wordType: true,
      ipa: true,
      vocabularyLevels: { select: { level: true } },
      relationsFrom: {
        where: { relationType: "form-of" },
        take: 1,
        select: { targetLemma: true },
      },
    },
  },
} as const;

type ReviewQueueRow = {
  lexemeId: string;
  lastSeenAt: Date;
  leitnerBox: number;
  dueAt: Date | null;
  lexeme: {
    canonicalLemma: string;
    wordType: string | null;
    ipa: string | null;
    vocabularyLevels: Array<{ level: string }>;
    relationsFrom: Array<{ targetLemma: string }>;
  };
};

function toQueueCandidate(
  row: ReviewQueueRow,
  isNew: boolean,
): ReviewQueueCandidate {
  return {
    lexemeId: row.lexemeId,
    canonicalLemma: row.lexeme.canonicalLemma,
    wordType: row.lexeme.wordType,
    ipa: row.lexeme.ipa,
    level: sortVocabularyLevels(row.lexeme.vocabularyLevels)[0]?.level ?? null,
    isNew,
    box: clampBox(row.leitnerBox),
    lastSeenAt: row.lastSeenAt,
    dueAt: row.dueAt,
  };
}

/**
 * The cards of one session: due words first, then new words while the daily
 * budget allows. Reading only, so the client can start a session without
 * writing anything.
 */
export async function buildReviewSession(input: {
  userId: string;
  requestedTzOffset?: number | null;
  /**
   * `due` is the normal session. `ahead` ignores the due date and reviews the
   * cards that would come next, which is the "提前复习" action on the overview.
   */
  mode?: "due" | "ahead";
}): Promise<{ cards: ReviewQueueCard[]; plan: ReviewPlan }> {
  const mode = input.mode ?? "due";
  const plan = await getReviewPlan(input.userId);
  const tzOffsetMinutes = normalizeTzOffset(
    input.requestedTzOffset ?? plan.tzOffsetMinutes,
  );
  const now = new Date();
  const introduced = await countNewWordsToday(
    input.userId,
    tzOffsetMinutes,
    now,
  );
  const newRemaining = Math.max(0, plan.newPerDay - introduced);

  const [dueRows, newRows] = await Promise.all([
    prisma.userLexeme.findMany({
      where: {
        userId: input.userId,
        status: { in: ["LEARNING", "REVIEWING"] },
        dueAt: mode === "ahead" ? { not: null } : { lte: now },
      },
      orderBy: [{ dueAt: "asc" }, { lastSeenAt: "desc" }],
      take: Math.max(plan.sessionSize, 1),
      select: REVIEW_QUEUE_SELECT,
    }),
    mode === "due" && newRemaining > 0
      ? prisma.userLexeme.findMany({
          where: {
            userId: input.userId,
            status: "NEW",
            repetitions: 0,
          },
          orderBy: { lastSeenAt: "desc" },
          take: Math.max(plan.sessionSize * 4, 40),
          select: REVIEW_QUEUE_SELECT,
        })
      : Promise.resolve([] as ReviewQueueRow[]),
  ]);

  const queue = planSession({
    due: dueRows.map((row) => toQueueCandidate(row, false)),
    newCandidates: newRows.map((row) => toQueueCandidate(row, true)),
    sessionSize: plan.sessionSize,
    newRemaining,
  });

  return {
    cards: queue.map((candidate) => ({
      lexemeId: candidate.lexemeId,
      canonicalLemma: candidate.canonicalLemma,
      wordType: candidate.wordType,
      ipa: candidate.ipa,
      level: candidate.level,
      isNew: candidate.isNew,
      box: candidate.box,
    })),
    plan,
  };
}

/** The word's own forms plus the ones of the lemma it belongs to. */
function collectForms(
  ...jsonValues: Array<unknown>
): { forms: string[]; genitive: string | null; plural: string | null } {
  const forms: string[] = [];
  let genitive: string | null = null;
  let plural: string | null = null;

  for (const value of jsonValues) {
    const parsed = parseFormsJson(value);

    if (!parsed) {
      continue;
    }

    genitive = genitive ?? parsed.genitive;
    plural = plural ?? parsed.plural;
    forms.push(...parsed.forms.map((form) => form.word));

    if (parsed.genitive) {
      forms.push(parsed.genitive);
    }

    if (parsed.plural) {
      forms.push(parsed.plural);
    }
  }

  return { forms, genitive, plural };
}

function buildSentenceRequestMessages({
  lemma,
  wordType,
  definitionEn,
  attempt,
}: {
  lemma: string;
  wordType: string | null;
  definitionEn: string | null;
  attempt: number;
}): LlmChatMessage[] {
  const context = [
    `德语词条：${lemma}`,
    wordType ? `词性：${wordType}` : null,
    definitionEn ? `英语释义：${definitionEn}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return [
    {
      role: "system",
      content: [
        DEFAULT_ASSISTANT_SYSTEM_PROMPT,
        "你正在为德语学习者写复习卡的例句。",
        "只输出一个 JSON 对象，不要输出 Markdown、解释或代码块。",
        'JSON 结构固定为 {"sentence": "...", "translation": "..."}。',
        "sentence 必须是自然的德语例句，translation 是它的简体中文翻译。",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        context,
        "",
        "请写一句德语例句：",
        `1. 必须包含上面词条的一种自然词形（可以变格、变位，但不要改变词义）。`,
        "2. 长度 6 到 14 个单词，难度接近 B1。",
        "3. 使用日常场景，不要写词典式解释句。",
        "4. translation 用简体中文，直译意义即可。",
        attempt > 0
          ? "5. 上一次的输出无法解析，这次请只输出 JSON 对象本身。"
          : "5. 只输出 JSON 对象本身。",
      ].join("\n"),
    },
  ];
}

type GeneratedSentence = {
  sentence: string;
  translation: string;
};

async function requestGeneratedSentence({
  config,
  lemma,
  wordType,
  definitionEn,
}: {
  config: LlmRuntimeConfig;
  lemma: string;
  wordType: string | null;
  definitionEn: string | null;
}): Promise<GeneratedSentence | null> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let raw = "";

    try {
      for await (const chunk of streamLlmChat({
        config,
        messages: buildSentenceRequestMessages({
          lemma,
          wordType,
          definitionEn,
          attempt,
        }),
      })) {
        raw += chunk;
      }
    } catch (error) {
      console.error("Review sentence generation failed", {
        lemma,
        error: error instanceof Error ? error.message : String(error),
      });

      return null;
    }

    const parsed = parseGeneratedSentence(raw);

    if (parsed) {
      return parsed;
    }
  }

  return null;
}

/**
 * The AI sentence for a word, cached per user and lexeme. A cached sentence is
 * reused while the LLM configuration is unchanged and still passes validation,
 * so the same word never costs two generations.
 */
async function getOrGenerateReviewSentence({
  userId,
  lexemeId,
  lemma,
  wordType,
  definitionEn,
  target,
}: {
  userId: string;
  lexemeId: string;
  lemma: string;
  wordType: string | null;
  definitionEn: string | null;
  target: ReturnType<typeof buildHighlightTarget>;
}): Promise<GeneratedSentence | null> {
  const config = await getUserLlmRuntimeConfig(userId);

  if (!config) {
    return null;
  }

  const configHash = llmConfigHash(config);
  const cached = await prisma.aiReviewSentence.findUnique({
    where: { userId_lexemeId: { userId, lexemeId } },
  });

  if (
    cached &&
    cached.configHash === configHash &&
    validateGeneratedSentence({
      sentence: cached.sentence,
      translation: cached.translation,
      target,
    })
  ) {
    return { sentence: cached.sentence, translation: cached.translation };
  }

  const generated = await requestGeneratedSentence({
    config,
    lemma,
    wordType,
    definitionEn,
  });

  if (
    !generated ||
    !validateGeneratedSentence({ ...generated, target })
  ) {
    return null;
  }

  const highlightForm =
    highlightText(
      generated.sentence,
      findHighlightRanges(generated.sentence, target),
    ) || lemma;

  await prisma.aiReviewSentence.upsert({
    where: { userId_lexemeId: { userId, lexemeId } },
    update: {
      sentence: generated.sentence,
      translation: generated.translation,
      highlightForm,
      configHash,
    },
    create: {
      userId,
      lexemeId,
      sentence: generated.sentence,
      translation: generated.translation,
      highlightForm,
      configHash,
    },
  });

  return generated;
}

export async function loadReviewCard(input: {
  userId: string;
  lexemeId: string;
  /** Answer count of the word; rotates the example sentence. */
  rotation?: number;
  /** Whether this card may still spend an AI generation in this session. */
  allowGeneration?: boolean;
}): Promise<ReviewCardPayload | null> {
  const row = await prisma.userLexeme.findUnique({
    where: {
      userId_lexemeId: { userId: input.userId, lexemeId: input.lexemeId },
    },
    select: {
      status: true,
      leitnerBox: true,
      repetitions: true,
      isFavorite: true,
      lexeme: {
        select: {
          id: true,
          canonicalLemma: true,
          normalizedLemma: true,
          wordType: true,
          ipa: true,
          definitionEn: true,
          sensesJson: true,
          formsJson: true,
          sourceJson: true,
          vocabularyLevels: { select: { level: true } },
          relationsFrom: {
            where: { relationType: "form-of" },
            take: 1,
            select: {
              targetLexeme: {
                select: {
                  id: true,
                  canonicalLemma: true,
                  normalizedLemma: true,
                  wordType: true,
                  formsJson: true,
                  definitionEn: true,
                },
              },
            },
          },
          wordNotes: {
            where: { userId: input.userId },
            take: 1,
            select: { content: true },
          },
        },
      },
    },
  });

  if (!row) {
    return null;
  }

  const lexeme = row.lexeme;
  const base = lexeme.relationsFrom[0]?.targetLexeme ?? null;
  /**
   * A form entry ("ist") has no dictionary content of its own, so the lemma it
   * belongs to ("sein") supplies definitions, examples and sentence search.
   */
  const content = base ?? lexeme;
  const collected = collectForms(lexeme.formsJson, base?.formsJson);
  const target = buildHighlightTarget({
    lemma: content.canonicalLemma,
    forms: collected.forms,
    extraForms: [lexeme.canonicalLemma],
  });

  const [tatoeba, wordnet] = await Promise.all([
    loadTatoebaSentences({
      lemma: content.canonicalLemma,
      forms: target.searchForms,
      limit: 5,
    }),
    getWordnetContentForLexeme({
      id: content.id,
      canonicalLemma: content.canonicalLemma,
      normalizedLemma: content.normalizedLemma,
    }).catch((error) => {
      console.error("WordNet examples failed for the review card", {
        lexemeId: lexeme.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }),
  ]);

  const definitionEn =
    primarySenseText(
      readLexemeSenses(lexeme.sensesJson),
      lexeme.wordType,
      lexeme.definitionEn,
    ) ||
    base?.definitionEn?.split("\n")[0]?.trim() ||
    null;
  /**
   * Every sense of the entry, ranked so the reading this word book entry stands
   * for comes first. The card lists all of them: one line of dictionary wording
   * can never cover a spelling like "wollen" (wool *and* to want).
   */
  const senses = buildEnglishDefinitions({
    senses: readLexemeSenses(lexeme.sensesJson),
    wordType: lexeme.wordType,
    definitionEn: lexeme.definitionEn,
  });
  const definitions = resolveDefinitionSets({
    german:
      wordnet?.definitions
        .filter((definition) => definition.language === "de")
        .map((definition) => definition.text) ?? [],
    english: [],
  });

  let sentence = selectReviewSentence({
    candidates: [
      ...tatoeba.sentences.map((item) => ({
        text: item.text,
        translation: item.translation,
        source: "tatoeba" as const,
        sourceUrl: item.sourceUrl,
        license: item.license,
      })),
      ...(wordnet?.examples ?? []).map((example) => ({
        text: example,
        translation: null,
        source: "odenet" as const,
        sourceUrl: wordnet?.source?.sourceUrl ?? null,
        license: wordnet?.source?.license ?? null,
      })),
    ],
    target,
    rotation: input.rotation ?? row.repetitions,
  });

  if (!sentence && input.allowGeneration) {
    const generated = await getOrGenerateReviewSentence({
      userId: input.userId,
      lexemeId: lexeme.id,
      lemma: content.canonicalLemma,
      wordType: content.wordType,
      definitionEn,
      target,
    });

    if (generated) {
      sentence = selectReviewSentence({
        candidates: [
          {
            text: generated.sentence,
            translation: generated.translation,
            source: "ai",
            sourceUrl: null,
            license: null,
          },
        ],
        target,
      });
    }
  }

  return {
    lexemeId: lexeme.id,
    canonicalLemma: lexeme.canonicalLemma,
    wordType: lexeme.wordType,
    ipa: lexeme.ipa,
    level: sortVocabularyLevels(lexeme.vocabularyLevels)[0]?.level ?? null,
    box: clampBox(row.leitnerBox),
    isNew: row.status === "NEW" && row.repetitions === 0,
    isFavorite: row.isFavorite,
    baseLemma: base?.canonicalLemma ?? null,
    gloss: readPhraseGloss(lexeme.sourceJson),
    definitionEn,
    senses,
    definitionsDe: definitions.german,
    note: lexeme.wordNotes[0]?.content?.trim() ?? "",
    genitive: collected.genitive,
    plural: collected.plural,
    sentence: sentence
      ? {
          text: sentence.text,
          highlightRanges: sentence.highlightRanges,
          translation: sentence.translation,
          source: sentence.source,
          sourceUrl: sentence.sourceUrl,
          license: sentence.license,
          generated: sentence.generated,
        }
      : null,
    sentenceNotice: sentence
      ? "none"
      : tatoeba.failed
        ? "source_unavailable"
        : "none",
  };
}

/**
 * Writes one answer. The `(sessionId, clientCardId)` unique index makes a
 * retried submit a no-op, so the client never double-counts a card.
 */
export async function applyReviewAnswer(input: {
  userId: string;
  lexemeId: string;
  sessionId: string;
  clientCardId: string;
  rating: string;
  elapsedMs?: number | null;
  tzOffsetMinutes: number;
}): Promise<ReviewAnswerResult> {
  if (!isReviewRating(input.rating)) {
    return { status: "inactive" };
  }

  const now = new Date();
  const rating: ReviewRating = input.rating;

  try {
    return await prisma.$transaction(async (tx) => {
      const row = await tx.userLexeme.findUnique({
        where: {
          userId_lexemeId: { userId: input.userId, lexemeId: input.lexemeId },
        },
        select: {
          status: true,
          leitnerBox: true,
          repetitions: true,
          lapses: true,
        },
      });

      if (!row) {
        return { status: "inactive" } as const;
      }

      // Suspended and mastered words are out of the queue: never schedule them.
      if (row.status === "SUSPENDED" || row.status === "MASTERED") {
        return { status: "inactive" } as const;
      }

      const schedule = applyRating(
        {
          box: row.leitnerBox,
          repetitions: row.repetitions,
          lapses: row.lapses,
        },
        rating,
        now,
      );

      await tx.reviewLog.create({
        data: {
          userId: input.userId,
          lexemeId: input.lexemeId,
          sessionId: input.sessionId,
          clientCardId: input.clientCardId,
          rating,
          boxBefore: clampBox(row.leitnerBox),
          boxAfter: schedule.box,
          intervalDaysAfter: schedule.intervalDays,
          dueAtAfter: schedule.dueAt,
          elapsedMs:
            typeof input.elapsedMs === "number" &&
            Number.isFinite(input.elapsedMs)
              ? Math.max(0, Math.min(Math.trunc(input.elapsedMs), 3_600_000))
              : null,
          tzOffsetMinutes: normalizeTzOffset(input.tzOffsetMinutes),
          reviewedAt: now,
        },
      });

      await tx.userLexeme.update({
        where: {
          userId_lexemeId: { userId: input.userId, lexemeId: input.lexemeId },
        },
        data: {
          status: schedule.status,
          leitnerBox: schedule.box,
          intervalDays: schedule.intervalDays,
          dueAt: schedule.dueAt,
          repetitions: schedule.repetitions,
          lapses: schedule.lapses,
          lastReviewedAt: now,
        },
      });

      return {
        status: "ok",
        boxAfter: schedule.box,
        statusAfter: schedule.status,
        intervalDays: schedule.intervalDays,
        dueAt: schedule.dueAt ? schedule.dueAt.toISOString() : null,
        requeueInSession: requeuesInSession(rating),
      } as const;
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { status: "duplicate" };
    }

    throw error;
  }
}

export async function getRecentReviews(
  userId: string,
  lexemeId: string,
  limit = 5,
): Promise<RecentReview[]> {
  try {
    return await prisma.reviewLog.findMany({
      where: { userId, lexemeId },
      orderBy: { reviewedAt: "desc" },
      take: Math.max(1, Math.min(Math.trunc(limit), 20)),
      select: {
        id: true,
        rating: true,
        boxBefore: true,
        boxAfter: true,
        intervalDaysAfter: true,
        reviewedAt: true,
      },
    });
  } catch (error) {
    if (isMissingTableError(error)) {
      return [];
    }

    throw error;
  }
}
