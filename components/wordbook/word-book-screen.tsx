"use client";

import { startTransition, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, StarIcon, Volume2Icon } from "lucide-react";
import { loadWordBookPage } from "@/app/actions/wordbook";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useGermanSpeech } from "@/hooks/use-speech";
import { useTranslatorController } from "@/hooks/use-translator";
import { cn } from "@/lib/utils";
import type { Translation } from "@/lib/i18n";
import {
  WORD_BOOK_SORTS,
  wordBookHref,
  type WordBookSort,
} from "@/lib/wordbook/sort";
import { WORD_STATUSES, type WordStatus } from "@/lib/wordbook/status";

export type WordBookEntry = {
  lexemeId: string;
  canonicalLemma: string;
  wordType: string | null;
  ipa: string | null;
  level: string | null;
  isFavorite: boolean;
  definitionEn: string | null;
  gloss: string | null;
  /** Lemma this entry is a form of, when it was stored as a form entry. */
  baseLemma: string | null;
  status: string;
  encounterCount: number;
  lastSeenAt: string;
};

/**
 * The word book uses the same layout as the reader: list on the left, entry on
 * the right, and a single-pane drill-down on narrow screens.
 */
export function WordBookScreen({
  words,
  hasMore,
  sort,
  query,
  status,
  favorites,
  selectedId,
  detailSlot,
  t,
}: {
  words: readonly WordBookEntry[];
  hasMore: boolean;
  sort: WordBookSort;
  query: string | null;
  status: WordStatus | null;
  favorites: boolean;
  selectedId: string | null;
  detailSlot: ReactNode;
  t: Translation;
}) {
  const router = useRouter();
  const isWide = useMediaQuery("(min-width: 1024px)");
  /**
   * One translator for the whole list: meanings are machine translated on-device
   * from the English sense, cached between pages and sort changes.
   */
  const translator = useTranslatorController("en");
  const [term, setTerm] = useState(query ?? "");

  // Debounced filter: the search runs on the server so it covers the whole book,
  // not just the pages that happen to be loaded.
  useEffect(() => {
    const next = term.trim();

    if (next === (query ?? "")) {
      return;
    }

    const timer = setTimeout(() => {
      startTransition(() => {
        router.replace(
          wordBookHref(
            { sort, w: selectedId, q: query },
            { q: next ? next : null },
          ),
          { scroll: false },
        );
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [query, router, selectedId, sort, term]);
  // On narrow screens a missing selection means "show the list".
  const showList = isWide ? true : selectedId === null;

  const select = (lexemeId: string) => {
    startTransition(() => {
      router.replace(wordBookHref({ sort, w: lexemeId }), { scroll: false });
    });
  };

  const backToList = () => {
    startTransition(() => {
      router.replace(wordBookHref({ sort }, { w: null }), { scroll: false });
    });
  };

  const changeSort = (next: WordBookSort) => {
    startTransition(() => {
      router.replace(wordBookHref({ sort, w: selectedId }, { sort: next }), {
        scroll: false,
      });
    });
  };

  const sortLabels: Record<WordBookSort, string> = {
    recent: t.wordBookSortRecent,
    alphabet: t.wordBookSortAlphabet,
    encounters: t.wordBookSortEncounters,
    due: t.wordBookSortDue,
  };

  const statusLabels: Record<WordStatus, string> = {
    NEW: t.statusNew,
    LEARNING: t.statusLearning,
    REVIEWING: t.statusReviewing,
    MASTERED: t.statusMastered,
    SUSPENDED: t.statusSuspended,
  };

  const applyFilters = (next: {
    status: WordStatus | null;
    favorites: boolean;
  }) => {
    startTransition(() => {
      router.replace(
        wordBookHref(
          { sort, w: selectedId, q: query, status, favorites },
          { status: next.status, favorites: next.favorites },
        ),
        { scroll: false },
      );
    });
  };

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-4 overflow-hidden lg:flex-row">
      <div
        className={cn(
          "w-full min-h-[320px] flex-col lg:min-h-0 lg:w-[320px] lg:shrink-0 2xl:w-[360px]",
          showList ? "flex" : "hidden",
        )}
      >
        <Card className="flex h-full min-h-0 flex-col shadow-plate">
          <CardContent className="flex min-h-0 flex-1 flex-col gap-3 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-display text-base font-semibold text-primary">
                {t.wordBook}
              </span>
              <Select
                value={sort}
                items={WORD_BOOK_SORTS.map((value) => ({
                  value,
                  label: sortLabels[value],
                }))}
                onValueChange={(value) => {
                  if (typeof value === "string") {
                    changeSort(value as WordBookSort);
                  }
                }}
              >
                <SelectTrigger size="sm" aria-label={t.wordBookSortLabel}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORD_BOOK_SORTS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {sortLabels[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder={t.wordBookSearchPlaceholder}
              aria-label={t.wordBookSearchPlaceholder}
              className="h-8"
            />

            <div className="flex flex-wrap items-center gap-1.5">
              <Select
                value={status ?? "ALL"}
                items={[
                  { value: "ALL", label: t.wordBookFilterAll },
                  ...WORD_STATUSES.map((value) => ({
                    value,
                    label: statusLabels[value],
                  })),
                ]}
                onValueChange={(value) => {
                  if (typeof value !== "string") {
                    return;
                  }

                  applyFilters({
                    status: value === "ALL" ? null : (value as WordStatus),
                    favorites,
                  });
                }}
              >
                <SelectTrigger size="sm" aria-label={t.wordBookFilterStatus}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t.wordBookFilterAll}</SelectItem>
                  {WORD_STATUSES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {statusLabels[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant={favorites ? "secondary" : "outline"}
                size="sm"
                aria-pressed={favorites}
                onClick={() => applyFilters({ status, favorites: !favorites })}
              >
                <StarIcon
                  data-icon="inline-start"
                  className={cn(favorites && "fill-current text-accent-amber")}
                />
                {t.wordBookFilterFavorites}
              </Button>
            </div>

            {/* Remounting on sort or list change resets the appended pages. */}
            <WordBookList
              key={`${sort}:${status ?? "all"}:${favorites ? "fav" : "all"}:${
                words[0]?.lexemeId ?? "empty"
              }:${words.length}`}
              initialWords={words}
              initialHasMore={hasMore}
              sort={sort}
              query={query}
              status={status}
              favorites={favorites}
              selectedId={selectedId}
              onSelect={select}
              translator={translator}
              t={t}
            />
          </CardContent>
        </Card>
      </div>

      <div
        className={cn(
          // `scroll-area` is a plain class, so it cannot take an `lg:` prefix.
          "scroll-area min-w-0 min-h-0 flex-col gap-3 lg:flex lg:flex-1 lg:pr-1",
          showList && !isWide ? "hidden" : "flex",
        )}
      >
        {selectedId === null ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyTitle>{t.wordBookEmpty}</EmptyTitle>
              <EmptyDescription>{t.wordBookEmptyHint}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <div className="flex items-center gap-2 lg:hidden">
              <Button variant="outline" size="sm" onClick={backToList}>
                <ArrowLeftIcon data-icon="inline-start" />
                {t.wordBook}
              </Button>
            </div>
            {detailSlot}
          </>
        )}
      </div>
    </div>
  );
}

function WordBookList({
  initialWords,
  initialHasMore,
  sort,
  query,
  status,
  favorites,
  selectedId,
  onSelect,
  translator,
  t,
}: {
  initialWords: readonly WordBookEntry[];
  initialHasMore: boolean;
  sort: WordBookSort;
  query: string | null;
  status: WordStatus | null;
  favorites: boolean;
  selectedId: string | null;
  onSelect: (lexemeId: string) => void;
  translator: ReturnType<typeof useTranslatorController>;
  t: Translation;
}) {
  const [extra, setExtra] = useState<WordBookEntry[]>([]);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const items = [...initialWords, ...extra];
  const { speak, speaking } = useGermanSpeech();

  const loadMore = async () => {
    setLoading(true);

    try {
      const page = await loadWordBookPage({
        sort,
        query,
        status,
        favorites,
        offset: items.length,
      });
      setExtra((current) => [...current, ...page.words]);
      setHasMore(page.hasMore);
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <StarIcon />
          </EmptyMedia>
          <EmptyTitle>{t.wordBookEmpty}</EmptyTitle>
          <EmptyDescription>{t.wordBookEmptyHint}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <ul className="scroll-area flex min-h-0 flex-1 flex-col gap-1 pr-1">
        {items.map((word) => {
          const isActive = word.lexemeId === selectedId;

          return (
            <li key={word.lexemeId}>
              <div
                className={cn(
                  "flex items-start gap-1.5 rounded-lg px-1.5 py-2 transition-colors",
                  isActive ? "bg-secondary" : "hover:bg-muted",
                )}
              >
                <Button
                  variant="ghost"
                  aria-pressed={isActive}
                  onClick={() => onSelect(word.lexemeId)}
                  className="h-auto min-w-0 flex-1 justify-start px-0.5 py-0 text-left hover:bg-transparent"
                >
                  <span className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
                    <span className="flex w-full items-center gap-2">
                      <span className="truncate font-display text-base">
                        {word.canonicalLemma}
                      </span>
                      {word.isFavorite && (
                        <StarIcon className="size-3.5 shrink-0 fill-current text-accent-amber" />
                      )}
                    </span>
                    <WordBookMeaning word={word} translator={translator} />
                    <span className="flex flex-wrap items-center gap-1.5">
                      {word.level && (
                        <Badge
                          variant="outline"
                          className="border-cefr bg-cefr-muted font-code text-cefr-foreground"
                        >
                          {word.level}
                        </Badge>
                      )}
                      {word.wordType && (
                        <span className="text-xs text-muted-foreground">
                          {word.wordType}
                        </span>
                      )}
                      {word.baseLemma && (
                        <span className="font-code text-xs text-muted-foreground">
                          {t.lemmaLabel}: {word.baseLemma}
                        </span>
                      )}
                      {word.status === "MASTERED" && (
                        <Badge
                          variant="outline"
                          className="border-status-learned-border bg-status-learned-muted text-status-learned-foreground"
                        >
                          {t.statusMastered}
                        </Badge>
                      )}
                      {word.status === "SUSPENDED" && (
                        <Badge variant="outline">
                          {t.statusSuspended}
                        </Badge>
                      )}
                    </span>
                  </span>
                </Button>
                {/* Pronunciation and phonetic transcription in one control. */}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={speaking}
                  onClick={() => {
                    speak({ text: word.canonicalLemma });
                  }}
                  aria-label={t.pronounce}
                  title={t.pronounce}
                  className="ml-1 shrink-0"
                >
                  <Volume2Icon data-icon="inline-start" />
                  {word.ipa && (
                    <span className="font-code text-xs">[{word.ipa}]</span>
                  )}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="font-code">
          {items.length}
          {hasMore ? "+" : ""}
        </span>
        {hasMore && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadMore()}
            disabled={loading}
          >
            {loading ? (
              <Spinner data-icon="inline-start" />
            ) : null}
            {loading ? t.wordBookLoadingMore : t.wordBookLoadMore}
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * The meaning line of a list row: a curated Chinese gloss when the entry has
 * one, otherwise the on-device Chinese translation of its English sense. Until
 * the translator is ready (or when the browser has none) the English text is
 * shown so the row is never empty.
 */
function WordBookMeaning({
  word,
  translator,
}: {
  word: WordBookEntry;
  translator: ReturnType<typeof useTranslatorController>;
}) {
  const source = word.gloss ?? word.definitionEn;
  const [translated, setTranslated] = useState<string | null>(null);
  // Destructured so the effect below only re-runs when the controller really
  // changes state, not on every render.
  const { status, revision, translate } = translator;

  useEffect(() => {
    if (word.gloss || !word.definitionEn || status !== "ready") {
      return;
    }

    let cancelled = false;

    void translate(word.definitionEn).then((value) => {
      if (!cancelled && value) {
        setTranslated(value);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [revision, status, translate, word.definitionEn, word.gloss]);

  const text = translated ?? source;

  if (!text) {
    return null;
  }

  return (
    <span className="line-clamp-2 text-xs leading-5 text-muted-foreground">
      {text}
    </span>
  );
}
