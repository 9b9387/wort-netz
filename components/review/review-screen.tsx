"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { WordTranslationProvider } from "@/components/word-translation";
import {
  fetchReviewCard,
  fetchReviewOverview,
  startReviewSession,
  submitReviewAnswer,
  syncReviewTimeZone,
  updateReviewPlan,
} from "@/app/actions/review";
import type { Translation } from "@/lib/i18n";
import { createUuid } from "@/lib/review/ids";
import { REQUEUE_GAP, insertRequeue } from "@/lib/review/queue";
import type { ReviewRating } from "@/lib/review/schedule";
import type {
  ReviewCardPayload,
  ReviewOverview,
  ReviewQueueCard,
} from "@/lib/review/types";
import { ReviewCard } from "./review-card";
import { ReviewOverviewPanel } from "./review-overview";
import { ReviewSummary, type ReviewSummaryItem } from "./review-summary";

/** Sentences the user's own LLM may write for one session. */
const MAX_AI_SENTENCES_PER_SESSION = 5;
const AUTO_SPEAK_KEY = "wortnetz:review-autospeak";

/** Auto-play preference, stored per browser rather than per account. */
function readAutoSpeakPreference(): boolean {
  return window.localStorage.getItem(AUTO_SPEAK_KEY) !== "false";
}

type Phase = "overview" | "session" | "summary";

type Presentation = {
  card: ReviewCardPayload;
  /** Identifies this presentation, so a retried submit cannot double-count. */
  clientCardId: string;
};

/**
 * Drives one review session: fetch the queue, present one sentence card at a
 * time, and write each answer back to the schedule.
 */
export function ReviewScreen({
  initialOverview,
  initialTzOffsetMinutes,
  t,
}: {
  initialOverview: ReviewOverview;
  initialTzOffsetMinutes: number;
  t: Translation;
}) {
  const [phase, setPhase] = useState<Phase>("overview");
  const [overview, setOverview] = useState(initialOverview);
  const [starting, setStarting] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [planSaved, setPlanSaved] = useState(false);
  const [queueLength, setQueueLength] = useState(0);
  const [position, setPosition] = useState(0);
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [cardLoading, setCardLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [results, setResults] = useState<ReviewSummaryItem[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(true);

  const tzOffsetRef = useRef(initialTzOffsetMinutes);
  const sessionRef = useRef<{
    sessionId: string;
    queue: ReviewQueueCard[];
  } | null>(null);
  const cardCacheRef = useRef(new Map<string, ReviewCardPayload>());
  const prefetchingRef = useRef(new Set<string>());
  const generatedRef = useRef(0);
  const positionRef = useRef(0);
  /** Guards against a stale async load overwriting a newer one. */
  const loadTokenRef = useRef(0);
  /** Synchronous guard: a second click must not submit the same card twice. */
  const submittingRef = useRef(false);

  const refreshOverview = useCallback(async (tzOffsetMinutes: number) => {
    const next = await fetchReviewOverview({ tzOffsetMinutes });
    setOverview(next);
  }, []);

  useEffect(() => {
    const actual = new Date().getTimezoneOffset();

    if (actual !== tzOffsetRef.current) {
      tzOffsetRef.current = actual;
      void syncReviewTimeZone({ tzOffsetMinutes: actual })
        .then(() => refreshOverview(actual))
        .catch(() => undefined);
    }
  }, [refreshOverview]);

  const changeAutoSpeak = useCallback((value: boolean) => {
    setAutoSpeak(value);
    window.localStorage.setItem(AUTO_SPEAK_KEY, String(value));
  }, []);

  const loadAt = useCallback(
    async (startIndex: number) => {
      const session = sessionRef.current;

      if (!session) {
        return;
      }

      const token = loadTokenRef.current + 1;
      loadTokenRef.current = token;
      setCardLoading(true);
      setError(null);

      try {
        // Cards without a usable example are skipped in a loop instead of
        // recursing, so a run of sentence-less words cannot nest calls.
        let skippedInRun = 0;

        for (let index = startIndex; index < session.queue.length; index += 1) {
          const target = session.queue[index];
          positionRef.current = index;
          setPosition(index);

          const cached = cardCacheRef.current.get(target.lexemeId);

          if (cached) {
            setPresentation({ card: cached, clientCardId: createUuid() });
            setCardLoading(false);
            return;
          }

          const card = await fetchReviewCard({
            lexemeId: target.lexemeId,
            allowGeneration:
              generatedRef.current < MAX_AI_SENTENCES_PER_SESSION,
          });

          if (token !== loadTokenRef.current) {
            return;
          }

          // No sentence and no source failure: this word cannot be reviewed.
          if (!card || (!card.sentence && card.sentenceNotice === "none")) {
            skippedInRun += 1;
            continue;
          }

          if (card.sentence?.generated) {
            generatedRef.current += 1;
          }

          cardCacheRef.current.set(card.lexemeId, card);
          setPresentation({ card, clientCardId: createUuid() });
          setCardLoading(false);

          if (skippedInRun > 0) {
            setSkipped((value) => value + skippedInRun);
          }

          return;
        }

        if (skippedInRun > 0) {
          setSkipped((value) => value + skippedInRun);
        }

        setPresentation(null);
        setCardLoading(false);
        setPhase("summary");
        void refreshOverview(tzOffsetRef.current);
      } catch {
        if (token === loadTokenRef.current) {
          setCardLoading(false);
          setError(t.reviewLoadFailed);
        }
      }
    },
    [refreshOverview, t.reviewLoadFailed],
  );

  const prefetch = useCallback((index: number) => {
    const session = sessionRef.current;
    const target = session?.queue[index];

    if (
      !target ||
      cardCacheRef.current.has(target.lexemeId) ||
      prefetchingRef.current.has(target.lexemeId)
    ) {
      return;
    }

    prefetchingRef.current.add(target.lexemeId);

    // Generation is left to the card the user actually opens, so a prefetch can
    // never spend the AI budget on a card the session will not reach.
    void fetchReviewCard({
      lexemeId: target.lexemeId,
      allowGeneration: false,
    })
      .then((card) => {
        if (card && (card.sentence || card.sentenceNotice !== "none")) {
          cardCacheRef.current.set(card.lexemeId, card);
        }
      })
      .catch(() => undefined)
      .finally(() => prefetchingRef.current.delete(target.lexemeId));
  }, []);

  const start = useCallback(
    async (mode: "due" | "ahead") => {
      setStarting(true);
      setError(null);
      setAutoSpeak(readAutoSpeakPreference());

      try {
        const next = await startReviewSession({
          tzOffsetMinutes: tzOffsetRef.current,
          mode,
        });

        if (next.cards.length === 0) {
          await refreshOverview(tzOffsetRef.current);
          return;
        }

        sessionRef.current = { sessionId: next.sessionId, queue: next.cards };
        cardCacheRef.current.clear();
        prefetchingRef.current.clear();
        generatedRef.current = 0;
        positionRef.current = 0;
        setQueueLength(next.cards.length);
        setResults([]);
        setSkipped(0);
        setPosition(0);
        setPhase("session");

        if (next.firstCard?.sentence) {
          const first = next.firstCard;

          if (first.sentence?.generated) {
            generatedRef.current += 1;
          }

          cardCacheRef.current.set(first.lexemeId, first);
          setPresentation({ card: first, clientCardId: createUuid() });
          prefetch(1);
        } else {
          setPresentation(null);
          void loadAt(0);
        }
      } catch {
        setError(t.reviewLoadFailed);
      } finally {
        setStarting(false);
      }
    },
    [loadAt, prefetch, refreshOverview, t.reviewLoadFailed],
  );

  const rate = useCallback(
    async (rating: ReviewRating, elapsedMs: number) => {
      const session = sessionRef.current;

      if (!session || !presentation || submittingRef.current) {
        return;
      }

      submittingRef.current = true;
      setPending(true);
      setError(null);

      const index = positionRef.current;

      try {
        const result = await submitReviewAnswer({
          sessionId: session.sessionId,
          clientCardId: presentation.clientCardId,
          lexemeId: presentation.card.lexemeId,
          rating,
          elapsedMs,
          tzOffsetMinutes: tzOffsetRef.current,
        });

        if (result.status === "ok") {
          setResults((value) => [
            ...value,
            { lexemeId: presentation.card.lexemeId, rating },
          ]);

          if (result.requeueInSession) {
            const current = session.queue[index];
            const remaining = session.queue.slice(index + 1);

            session.queue = [
              ...session.queue.slice(0, index + 1),
              ...insertRequeue(remaining, current, REQUEUE_GAP),
            ];
            setQueueLength(session.queue.length);
          }
        }

        // Release the card before loading the next one, so its buttons are live
        // as soon as it appears.
        setPending(false);
        submittingRef.current = false;
        await loadAt(index + 1);
      } catch {
        setError(t.reviewSubmitFailed);
      } finally {
        setPending(false);
        submittingRef.current = false;
      }
    },
    [loadAt, presentation, t.reviewSubmitFailed],
  );

  const leaveSession = useCallback(() => {
    sessionRef.current = null;
    setPresentation(null);
    setPhase("overview");
    void refreshOverview(tzOffsetRef.current);
  }, [refreshOverview]);

  const savePlan = useCallback(
    async (input: { sessionSize: number; newPerDay: number }) => {
      setSavingPlan(true);

      try {
        const plan = await updateReviewPlan(input);

        setOverview((value) => ({
          ...value,
          sessionSize: plan.sessionSize,
          newPerDay: plan.newPerDay,
        }));
        setPlanSaved(true);
      } catch {
        setError(t.reviewPlanFailed);
      } finally {
        setSavingPlan(false);
      }
    },
    [t.reviewPlanFailed],
  );

  const nextDueLabel = useMemo(() => {
    if (!overview.nextDueAt) {
      return null;
    }

    const date = new Date(overview.nextDueAt);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return new Intl.DateTimeFormat("zh-CN", {
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }, [overview.nextDueAt]);

  const progress =
    queueLength > 0 ? Math.min(100, (position / queueLength) * 100) : 0;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-primary">
          {t.review}
        </h1>
        <p className="text-muted-foreground">{t.reviewPlaceholder}</p>
      </section>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {phase === "overview" && (
        <ReviewOverviewPanel
          overview={overview}
          t={t}
          nextDueLabel={nextDueLabel}
          loading={starting}
          savingPlan={savingPlan}
          planSaved={planSaved}
          onStart={() => void start("due")}
          onStartAhead={() => void start("ahead")}
          onSavePlan={(input) => void savePlan(input)}
        />
      )}

      {phase === "session" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Progress value={progress} className="flex-1" />
            <span className="font-code text-xs text-muted-foreground">
              {Math.min(position + 1, queueLength)}/{queueLength}
            </span>
            <Button variant="ghost" size="sm" onClick={leaveSession}>
              {t.reviewSummaryBack}
            </Button>
          </div>

          <WordTranslationProvider>
            {cardLoading || !presentation ? (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-96 rounded-xl" />
                <span className="text-center text-sm text-muted-foreground">
                  {t.reviewSentenceLoading}
                </span>
              </div>
            ) : (
              <ReviewCard
                key={presentation.clientCardId}
                card={presentation.card}
                t={t}
                autoSpeak={autoSpeak}
                onAutoSpeakChange={changeAutoSpeak}
                onRate={(rating, elapsedMs) => void rate(rating, elapsedMs)}
                pending={pending}
              />
            )}
          </WordTranslationProvider>
        </div>
      )}

      {phase === "summary" && (
        <ReviewSummary
          results={results}
          skippedCount={skipped}
          nextDueLabel={nextDueLabel}
          t={t}
          onContinue={() => void start("due")}
          onBack={leaveSession}
        />
      )}
    </div>
  );
}
