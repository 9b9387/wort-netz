"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { BookOpenTextIcon, PlusIcon } from "lucide-react";
import {
  deleteArticle,
  openReaderPhrase,
  openReaderWord,
  saveArticle,
  saveArticleUnlearnedCount,
  type OpenReaderWordReason,
} from "@/app/actions/reader";
import { ReaderArticleList, type ReaderArticleSummaryDto } from "@/components/reader/reader-article-list";
import {
  DEFAULT_READER_FILTERS,
  ReaderAnnotatedText,
  type ReaderFilters,
} from "@/components/reader/reader-annotated-text";
import { ReaderToolbar, type ReaderMode } from "@/components/reader/reader-toolbar";
import {
  ReaderWordPanel,
  type ReaderDetailTab,
} from "@/components/reader/reader-word-panel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useArticleSpeech } from "@/hooks/use-article-speech";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import type { Translation } from "@/lib/i18n";
import { readerHref, type ReaderNavigation, type ReaderPaneView } from "@/lib/reader/pane-state";
import { normalizeSurface } from "@/lib/reader/tokenize";
import { summarizeTokens } from "@/lib/reader/stats";
import {
  READER_MAX_CHARS,
  type ReaderPhrase,
  type ReaderStats,
  type ReaderToken,
} from "@/lib/reader/types";
import {
  buildWordEntries,
  countUnrecognizedEntries,
  selectStudyEntries,
  type ReaderWordEntry,
} from "@/lib/reader/word-list";

type ReaderAnalysisState = {
  status: "idle" | "loading" | "ready" | "error";
  tokens: ReaderToken[];
  phrases: ReaderPhrase[];
  stats: ReaderStats | null;
};

type PendingAction =
  | ReaderNavigation
  | { kind: "discard-edit" };

type SelectionAttempt = {
  key: string;
  surface: string;
  lexemeId: string | null;
  lemma: string | null;
};

type PhraseAttempt = {
  kind: "phrase";
  phrase: ReaderPhrase;
  surface: string;
};

type WordAttempt = SelectionAttempt & { kind: "word" };

type WordError = {
  surface: string;
  reason: OpenReaderWordReason;
  attempt: WordAttempt | PhraseAttempt;
};

const EMPTY_ANALYSIS: ReaderAnalysisState = {
  status: "idle",
  tokens: [],
  phrases: [],
  stats: null,
};

const ANALYSIS_DEBOUNCE_MS = 600;

function overrideKey(token: { lemma: string | null; text: string }): string {
  return token.lemma
    ? normalizeSurface(token.lemma)
    : normalizeSurface(token.text);
}

export function ReaderScreen({
  t,
  articles,
  activeArticle,
  draftParam,
  view,
  activeLexemeId,
  paneQuery,
  wordSlot,
}: {
  t: Translation;
  articles: ReaderArticleSummaryDto[];
  activeArticle: { id: string; content: string; updatedAt: string } | null;
  draftParam: boolean;
  view: ReaderPaneView;
  activeLexemeId: string | null;
  paneQuery: {
    article: string | null;
    w: string | null;
    pane: string | null;
    draft: string | null;
  };
  wordSlot: ReactNode;
}) {
  const router = useRouter();
  const isWide = useMediaQuery("(min-width: 1024px)");
  const [, startTransition] = useTransition();
  const speech = useArticleSpeech();

  const query = useMemo(
    () => ({
      article: paneQuery.article,
      w: paneQuery.w,
      pane: paneQuery.pane,
      draft: paneQuery.draft,
    }),
    [paneQuery.article, paneQuery.w, paneQuery.pane, paneQuery.draft],
  );

  const initialMode: ReaderMode = activeArticle ? "view" : draftParam ? "new" : "view";

  const [mode, setMode] = useState<ReaderMode>(initialMode);
  const [draft, setDraft] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(activeArticle?.updatedAt ?? null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ReaderFilters>(DEFAULT_READER_FILTERS);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [analysis, setAnalysis] = useState<ReaderAnalysisState>(EMPTY_ANALYSIS);
  const [analysisNonce, setAnalysisNonce] = useState(0);
  const [overrides, setOverrides] = useState<Map<string, { lexemeId: string; lemma: string }>>(new Map());
  /**
   * Set the moment a word is clicked so the detail pane never keeps showing the
   * previously opened word while the server round trip is in flight. `lexemeId`
   * is `null` until the action resolved it.
   */
  const [pendingWord, setPendingWord] = useState<{
    surface: string;
    lexemeId: string | null;
  } | null>(null);
  const [wordError, setWordError] = useState<WordError | null>(null);
  const [collectedPhrases, setCollectedPhrases] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedPhrase, setSelectedPhrase] = useState<ReaderPhrase | null>(
    null,
  );
  /** The opened unit: a single word or a whole phrase. */
  const [selectedRange, setSelectedRange] = useState<{
    start: number;
    end: number;
  } | null>(null);
  const [selectedSurface, setSelectedSurface] = useState<string | null>(null);
  const [encounterRecorded, setEncounterRecorded] = useState(false);
  const [confirmAction, setConfirmAction] = useState<PendingAction | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [speechHint, setSpeechHint] = useState<string | null>(null);

  const recordedRef = useRef<Set<string>>(new Set());
  /** Last unlearned count reported for the open article, to avoid re-sending. */
  const reportedCountRef = useRef<{ articleId: string; count: number } | null>(
    null,
  );
  /** Shared timer for the transient "select text first" hint. */
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textRootRef = useRef<HTMLDivElement | null>(null);

  const content = draft ?? activeArticle?.content ?? "";
  const baseline = (activeArticle?.content ?? "").trim();
  const dirty = mode !== "view" && content.trim() !== baseline;
  const activeArticleId = activeArticle?.id ?? null;
  const activeArticleUpdatedAt = activeArticle?.updatedAt ?? null;
  const stopSpeech = speech.stop;
  const speakRange = speech.speakRange;
  const speakSelection = speech.speakSelection;

  useEffect(() => {
    let cancelled = false;

    // Deferred so these resets happen outside the effect body.
    const timer = setTimeout(() => {
      if (cancelled) {
        return;
      }

      setDraft(null);
      setSaveError(null);
      setSavedAt(activeArticleUpdatedAt);
      setMode(activeArticleId ? "view" : draftParam ? "new" : "view");
      setSelectedRange(null);
      setSelectedSurface(null);
      setEncounterRecorded(false);
      setSelectedPhrase(null);
      setWordError(null);
      setPendingWord(null);
      setOverrides(new Map());
      setCollectedPhrases(new Set());
      setSpeechHint(null);
      recordedRef.current = new Set();
      stopSpeech();
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeArticleId, activeArticleUpdatedAt, draftParam, stopSpeech]);

  useEffect(() => {
    return () => {
      if (hintTimerRef.current) {
        clearTimeout(hintTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const offline =
      mode !== "view" || !content.trim()
        ? EMPTY_ANALYSIS
        : content.length > READER_MAX_CHARS
          ? { status: "error" as const, tokens: [], phrases: [], stats: null }
          : null;

    if (offline) {
      // Deferred so the reset happens outside the effect body.
      const resetTimer = setTimeout(() => {
        if (!cancelled) {
          setAnalysis(offline);
        }
      }, 0);

      return () => {
        cancelled = true;
        clearTimeout(resetTimer);
      };
    }

    const controller = new AbortController();

    const timer = setTimeout(() => {
      void (async () => {
        setAnalysis((current) => ({ ...current, status: "loading" }));

        try {
          const response = await fetch("/api/reader/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: content }),
            signal: controller.signal,
          });

          if (!response.ok) {
            throw new Error(`analyze failed: ${response.status}`);
          }

          const payload = (await response.json()) as {
            tokens: ReaderToken[];
            phrases?: ReaderPhrase[];
            stats: ReaderStats;
          };

          if (!controller.signal.aborted) {
            setAnalysis({
              status: "ready",
              tokens: payload.tokens,
              phrases: payload.phrases ?? [],
              stats: payload.stats,
            });
          }
        } catch {
          if (!controller.signal.aborted) {
            setAnalysis({
              status: "error",
              tokens: [],
              phrases: [],
              stats: null,
            });
          }
        }
      })();
    }, ANALYSIS_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [mode, content, analysisNonce]);

  const tokens = useMemo(() => {
    if (overrides.size === 0) {
      return analysis.tokens;
    }

    return analysis.tokens.map((token) => {
      const override = overrides.get(overrideKey(token));

      if (!override) {
        return token;
      }

      return {
        ...token,
        category: "learned" as const,
        lexemeId: override.lexemeId,
        lemma: override.lemma,
        inWordBook: true,
      };
    });
  }, [analysis.tokens, overrides]);

  const entries = useMemo(() => buildWordEntries(tokens), [tokens]);
  /** The study list leaves unrecognized words out. */
  const studyEntries = useMemo(() => selectStudyEntries(entries), [entries]);
  const excludedCount = useMemo(
    () => countUnrecognizedEntries(entries),
    [entries],
  );
  /**
   * Statistics are recomputed from the live tokens, so collecting a word by
   * clicking it is reflected immediately instead of waiting for the next
   * server-side analysis.
   */
  const stats = useMemo(() => summarizeTokens(tokens), [tokens]);

  /**
   * The article list shows how many words are still unlearned. That number only
   * exists for the article being analyzed, so persist it as the user reads.
   */
  useEffect(() => {
    if (analysis.status !== "ready" || !activeArticleId) {
      return;
    }

    const reported = reportedCountRef.current;

    if (
      reported?.articleId === activeArticleId &&
      reported.count === stats.unlearnedUnique
    ) {
      return;
    }

    reportedCountRef.current = {
      articleId: activeArticleId,
      count: stats.unlearnedUnique,
    };

    void saveArticleUnlearnedCount({
      articleId: activeArticleId,
      unlearnedCount: stats.unlearnedUnique,
    });
  }, [activeArticleId, analysis.status, stats.unlearnedUnique]);
  const go = useCallback(
    (action: ReaderNavigation) => {
      startTransition(() => {
        router.replace(readerHref(query, action), { scroll: false });
      });
    },
    [query, router],
  );

  const performAction = useCallback(
    (action: PendingAction) => {
      if (action.kind === "discard-edit") {
        setDraft(null);
        setSaveError(null);
        setMode(activeArticle ? "view" : draftParam ? "new" : "view");
        return;
      }

      go(action);
    },
    [activeArticle, draftParam, go],
  );

  const requestAction = useCallback(
    (action: PendingAction) => {
      if (dirty) {
        setConfirmAction(action);
        return;
      }

      performAction(action);
    },
    [dirty, performAction],
  );

  const handleSave = useCallback(async () => {
    if (!content.trim()) {
      setSaveError("empty");
      return;
    }

    if (content.length > READER_MAX_CHARS) {
      setSaveError("too_long");
      return;
    }

    setSaving(true);
    setSaveError(null);

    const result = await saveArticle({
      id: activeArticle?.id ?? null,
      content,
    });

    setSaving(false);

    if (!result.ok) {
      setSaveError(result.reason);
      return;
    }

    setSavedAt(result.article.updatedAt);
    recordedRef.current = new Set();
    reportedCountRef.current = null;
    setDraft(null);
    setMode("view");

    if (activeArticle?.id !== result.article.id) {
      go({ kind: "select-article", articleId: result.article.id });
    }
  }, [activeArticle?.id, content, go]);

  const handleDelete = useCallback(
    async (id: string) => {
      setDeleteId(null);

      const result = await deleteArticle(id);

      if (!result.ok) {
        return;
      }

      if (activeArticle?.id === id) {
        setDraft(null);
        setMode("view");
        startTransition(() => {
          router.replace("/reader", { scroll: false });
        });
        return;
      }

      startTransition(() => {
        router.refresh();
      });
    },
    [activeArticle?.id, router],
  );

  const selectWord = useCallback(
    async (
      attempt: SelectionAttempt,
      options?: { collected?: boolean; autoSpeakWord?: boolean },
    ) => {
      setWordError(null);
      setSelectedPhrase(null);
      setSelectedSurface(attempt.surface);
      setEncounterRecorded(false);
      setPendingWord({
        surface: attempt.surface,
        lexemeId: attempt.lexemeId,
      });

      if (options?.autoSpeakWord && autoSpeak) {
        speakRange(attempt.surface);
      }

      if (options?.collected && attempt.lexemeId) {
        go({
          kind: "select-word",
          lexemeId: attempt.lexemeId,
          surface: attempt.surface,
        });
        return;
      }

      const alreadyCounted =
        recordedRef.current.has(attempt.key) ||
        (attempt.lexemeId !== null && recordedRef.current.has(attempt.lexemeId));

      const result = await openReaderWord({
        surfaceForm: attempt.surface,
        lexemeId: attempt.lexemeId,
        lemma: attempt.lemma,
        countEncounter: !alreadyCounted,
      });

      if (!result.ok) {
        setPendingWord(null);
        setWordError({
          surface: attempt.surface,
          reason: result.reason,
          attempt: { ...attempt, kind: "word" },
        });
        return;
      }

      recordedRef.current.add(attempt.key);
      recordedRef.current.add(result.lexemeId);
      setOverrides((current) => {
        const next = new Map(current);
        next.set(attempt.key, {
          lexemeId: result.lexemeId,
          lemma: attempt.lemma ?? attempt.surface,
        });
        return next;
      });
      setPendingWord({
        surface: attempt.surface,
        lexemeId: result.lexemeId,
      });
      go({
        kind: "select-word",
        lexemeId: result.lexemeId,
        surface: attempt.surface,
      });
    },
    [autoSpeak, go, speakRange],
  );

  /**
   * Opening a detected phrase collects the whole expression instead of its
   * individual words, so `zur Verfügung` is looked up as a unit.
   */
  const selectPhrase = useCallback(
    async (phrase: ReaderPhrase) => {
      const surface = content.slice(phrase.start, phrase.end);
      const key = phrase.normalized;

      setWordError(null);
      setSelectedSurface(surface);
      setEncounterRecorded(false);
      setSelectedRange({ start: phrase.start, end: phrase.end });
      setSelectedPhrase(phrase);
      setPendingWord({ surface: phrase.canonical, lexemeId: phrase.lexemeId });

      if (autoSpeak) {
        speakRange(surface);
      }

      if (recordedRef.current.has(key) && phrase.lexemeId) {
        go({ kind: "select-word", lexemeId: phrase.lexemeId, surface });
        return;
      }

      const result = await openReaderPhrase({
        normalized: phrase.normalized,
        canonical: phrase.canonical,
        pos: phrase.pos,
        surfaceForm: surface,
        countEncounter: !recordedRef.current.has(key),
      });

      if (!result.ok) {
        setPendingWord(null);
        setWordError({
          surface: phrase.canonical,
          reason: result.reason === "not_found" ? "not_found" : "internal",
          attempt: { kind: "phrase", phrase, surface },
        });
        return;
      }

      recordedRef.current.add(key);
      recordedRef.current.add(result.lexemeId);
      setCollectedPhrases((current) => {
        const next = new Set(current);
        next.add(key);
        return next;
      });
      setPendingWord({ surface: phrase.canonical, lexemeId: result.lexemeId });
      go({ kind: "select-word", lexemeId: result.lexemeId, surface });
    },
    [autoSpeak, content, go, speakRange],
  );

  const handleSelectToken = useCallback(
    (token: ReaderToken) => {
      setSelectedRange({ start: token.start, end: token.end });
      void selectWord(
        {
          key: overrideKey(token),
          surface: token.text,
          lexemeId: token.lexemeId,
          lemma: token.lemma,
        },
        { collected: token.category === "learned", autoSpeakWord: true },
      );
    },
    [selectWord],
  );

  const handleSelectEntry = useCallback(
    (entry: ReaderWordEntry) => {
      setSelectedRange({
        start: entry.start,
        end: entry.start + entry.surface.length,
      });
      void selectWord(
        {
          key: entry.key,
          surface: entry.surface,
          lexemeId: entry.lexemeId,
          lemma: entry.lemma,
        },
        { collected: entry.category === "learned" },
      );
    },
    [selectWord],
  );

  /**
   * Words of the phrase that is currently open, so a phrase never hides the
   * individual words it is made of.
   */
  const phraseWords = useMemo(() => {
    if (!selectedPhrase) {
      return [];
    }

    return analysis.tokens
      .filter(
        (token) =>
          token.start >= selectedPhrase.start && token.end <= selectedPhrase.end,
      )
      .map((token) => ({
        key: `phrase-word-${token.start}`,
        label: token.text,
        onSelect: () => {
          setSelectedRange({ start: token.start, end: token.end });
          void selectWord(
            {
              key: overrideKey(token),
              surface: token.text,
              lexemeId: token.lexemeId,
              lemma: token.lemma,
            },
            { collected: token.category === "learned", autoSpeakWord: true },
          );
        },
      }));
  }, [analysis.tokens, selectedPhrase, selectWord]);

  const handleReadAll = useCallback(() => {
    setSpeechHint(null);
    speakRange(content);
  }, [content, speakRange]);

  /** Manual "+1 encounter" for the word currently open in the detail pane. */
  const handleRecordEncounter = useCallback(async () => {
    if (!activeLexemeId || !selectedSurface) {
      return;
    }

    const result = await openReaderWord({
      surfaceForm: selectedSurface,
      lexemeId: activeLexemeId,
      lemma: null,
      countEncounter: true,
    });

    if (result.ok) {
      setEncounterRecorded(true);
      recordedRef.current.add(selectedSurface);
      recordedRef.current.add(result.lexemeId);
    }
  }, [activeLexemeId, selectedSurface]);

  const handleReadSelection = useCallback(() => {
    if (speakSelection(content, textRootRef.current)) {
      setSpeechHint(null);
      return;
    }

    setSpeechHint(t.readerSelectFirst);

    if (hintTimerRef.current) {
      clearTimeout(hintTimerRef.current);
    }

    hintTimerRef.current = setTimeout(() => setSpeechHint(null), 4000);
  }, [content, speakSelection, t.readerSelectFirst]);

  const showList = isWide
    ? view === "list"
    : view === "list" && !activeArticle && !draftParam;
  const showContent = isWide
    ? true
    : view === "list" && (Boolean(activeArticle) || draftParam);
  const activeTab: ReaderDetailTab = view === "words" ? "words" : "word";
  /** Keep the open article's badge in step with the live annotation. */
  const listArticles = useMemo(
    () =>
      articles.map((article) =>
        article.id === activeArticleId && analysis.status === "ready"
          ? { ...article, unlearnedCount: stats.unlearnedUnique }
          : article,
      ),
    [activeArticleId, analysis.status, articles, stats.unlearnedUnique],
  );
  // Stays set until the newly opened word arrives in the props, so the pane
  // keeps showing "looking up…" for the whole server round trip.
  const pendingWordSurface =
    pendingWord &&
    (pendingWord.lexemeId === null || pendingWord.lexemeId !== activeLexemeId)
      ? pendingWord.surface
      : null;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-4 lg:flex-row">
      <div
        className={cn(
          "w-full min-h-[320px] flex-col lg:min-h-0 lg:w-[320px] lg:shrink-0 2xl:w-[360px]",
          showList ? "flex" : "hidden",
        )}
      >
        <ReaderArticleList
          articles={listArticles}
          activeId={activeArticle?.id ?? null}
          onSelect={(id) => requestAction({ kind: "select-article", articleId: id })}
          onNew={() => requestAction({ kind: "new-draft" })}
          onDelete={(id) => setDeleteId(id)}
          t={t}
        />
      </div>

      <div
        className={cn(
          "min-w-0 flex-col gap-4 lg:flex-1 lg:basis-0",
          showContent ? "flex" : "hidden",
        )}
      >
        <ReaderToolbar
          t={t}
          mode={mode}
          dirty={dirty}
          saving={saving}
          saveError={saveError}
          savedAt={savedAt}
          analysisStatus={analysis.status}
          stats={stats}
          phraseCount={analysis.phrases.length}
          filters={filters}
          onFiltersChange={setFilters}
          onStartEdit={() => setMode("edit")}
          onSave={() => void handleSave()}
          onDiscard={() => requestAction({ kind: "discard-edit" })}
          onBackToList={() =>
            requestAction(
              isWide ? { kind: "back-to-list" } : { kind: "clear-article" },
            )
          }
          onOpenWordList={() =>
            requestAction({ kind: "open-word-list" })
          }
          onReanalyze={() => setAnalysisNonce((value) => value + 1)}
          speech={{
            supported: speech.supported,
            speaking: speech.speaking,
            paused: speech.paused,
            rate: speech.rate,
            setRate: speech.setRate,
            onReadAll: handleReadAll,
            onReadSelection: handleReadSelection,
            onPause: speech.pause,
            onResume: speech.resume,
            onStop: speech.stop,
          }}
          autoSpeak={autoSpeak}
          onAutoSpeakChange={setAutoSpeak}
          view={view}
        />

        {speechHint && (
          <p className="text-xs text-muted-foreground">{speechHint}</p>
        )}

        {view === "list" && (pendingWordSurface || wordError) && (
          <Alert variant={wordError ? "destructive" : "default"}>
            <AlertTitle className="flex items-center gap-2">
              {wordError ? null : <Spinner />}
              {wordError?.surface ?? pendingWordSurface}
            </AlertTitle>
            <AlertDescription className="flex flex-wrap items-center gap-3">
              <span>
                {wordError
                  ? wordError.reason === "not_found"
                    ? t.readerWordNotFound
                    : wordError.reason === "service_unavailable"
                      ? t.readerWordUnavailable
                      : t.readerWordFailed
                  : t.readerWordLoading}
              </span>
              {wordError && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const attempt = wordError.attempt;

                    if (attempt.kind === "phrase") {
                      void selectPhrase(attempt.phrase);
                      return;
                    }

                    void selectWord(attempt);
                  }}
                >
                  {t.readerWordRetry}
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        {mode !== "view" ? (
          <Card className="flex min-h-0 flex-1 flex-col shadow-plate">
            <CardContent className="flex min-h-0 flex-1 flex-col gap-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label
                  htmlFor="reader-content"
                  className="text-xs text-muted-foreground"
                >
                  {mode === "new" ? t.readerDraftLabel : t.readerEditModeHint}
                </Label>
                <span className="font-code text-xs text-muted-foreground">
                  {content.length}/{READER_MAX_CHARS} {t.readerChars}
                </span>
              </div>
              <Textarea
                id="reader-content"
                value={content}
                placeholder={t.readerContentPlaceholder}
                onChange={(event) => setDraft(event.target.value)}
                className="min-h-[320px] flex-1 font-display text-base leading-7"
              />
            </CardContent>
          </Card>
        ) : content.trim() ? (
          <Card className="flex min-h-0 flex-1 flex-col shadow-plate">
            <CardContent className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
              <ReaderAnnotatedText
                text={content}
                tokens={tokens}
                filters={filters}
                activeRange={speech.chunk}
                activeOffset={speech.activeOffset}
                selectedRange={selectedRange}
                onSelectWord={handleSelectToken}
                phrases={analysis.phrases}
                collectedPhrases={collectedPhrases}
                onSelectPhrase={(phrase) => void selectPhrase(phrase)}
                phraseLabels={{
                  collected: t.readerPhraseCollected,
                  other: t.readerPhraseNew,
                }}
                rootRef={textRootRef}
              />
            </CardContent>
          </Card>
        ) : (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BookOpenTextIcon />
              </EmptyMedia>
              <EmptyTitle>{t.readerPaneEmptyTitle}</EmptyTitle>
              <EmptyDescription>{t.readerPaneEmptyHint}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={() => performAction({ kind: "new-draft" })}>
                <PlusIcon data-icon="inline-start" />
                {t.readerNewArticle}
              </Button>
            </EmptyContent>
          </Empty>
        )}
      </div>

      {view !== "list" && (
        <div className="flex w-full min-w-0 flex-col lg:flex-1 lg:basis-0">
          <ReaderWordPanel
            activeTab={activeTab}
            wordSlot={wordSlot}
            entries={studyEntries}
            excludedCount={excludedCount}
            selectedKey={
              selectedRange === null
                ? null
                : (studyEntries.find(
                    (entry) => entry.start === selectedRange.start,
                  )?.key ?? null)
            }
            pendingSurface={pendingWordSurface}
            errorSurface={wordError?.surface ?? null}
            errorReason={wordError?.reason ?? null}
            onTabChange={(tab) => {
              if (tab === "words") {
                go({ kind: "open-word-list" });
                return;
              }

              if (activeLexemeId) {
                go({ kind: "select-word", lexemeId: activeLexemeId });
              }
            }}
            onSelectEntry={handleSelectEntry}
            onBackToList={() =>
              requestAction(
                isWide ? { kind: "back-to-list" } : { kind: "clear-article" },
              )
            }
            onClose={() =>
              requestAction(
                isWide ? { kind: "back-to-list" } : { kind: "clear-article" },
              )
            }
            onRetry={() => {
              const attempt = wordError?.attempt;

              if (attempt?.kind === "phrase") {
                void selectPhrase(attempt.phrase);
                return;
              }

              if (attempt) {
                void selectWord(attempt);
              }
            }}
            onRecordEncounter={() => void handleRecordEncounter()}
            encounterRecorded={encounterRecorded}
            phraseWords={phraseWords}
            t={t}
          />
        </div>
      )}

      <AlertDialog
        open={confirmAction !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmAction(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t.readerDiscardConfirmTitle}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t.readerDiscardConfirmBody}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.readerKeepEditing}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const action = confirmAction;
                setConfirmAction(null);

                if (action) {
                  performAction(action);
                }
              }}
            >
              {t.readerDiscard}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteId(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.readerDeleteConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.readerDeleteConfirmBody}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.readerCancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const id = deleteId;

                if (id) {
                  void handleDelete(id);
                }
              }}
            >
              {t.readerDelete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
