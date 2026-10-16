"use client";

import { Fragment, useMemo, type ReactNode, type RefObject } from "react";
import { cn } from "@/lib/utils";
import { segmentText } from "@/lib/reader/render-blocks";
import { mapPhrasesToTokens } from "@/lib/reader/phrases";
import type { ReaderPhrase, ReaderToken } from "@/lib/reader/types";

export type ReaderFilters = {
  learned: boolean;
  unlearned: boolean;
  unrecognized: boolean;
  /**
   * Function-word layer: on = quiet gray, off = no marking at all (so switching
   * the chip off always means "less marking", like every other chip).
   */
  functionWords: boolean;
  /** When off, phrases are ignored and their words behave like single words. */
  phrases: boolean;
};

export const DEFAULT_READER_FILTERS: ReaderFilters = {
  learned: true,
  unlearned: true,
  unrecognized: true,
  functionWords: true,
  phrases: true,
};

/** Fixed reading size: one comfortable step for the annotation surface. */
const TEXT_SIZE_CLASS = "text-[1.05rem] leading-7";

function categoryClass(
  token: ReaderToken,
  filters: ReaderFilters,
  isActive: boolean,
  insidePhrase: boolean,
): string {
  if (isActive) {
    return "rounded-[3px] bg-primary text-primary-foreground";
  }

  // Inside a phrase the wrapper owns the background and the text color, so the
  // phrase reads as one colored unit instead of a run of single words.
  if (insidePhrase) {
    return "";
  }

  /**
   * Function words are their own layer: quiet gray while the legend chip is on,
   * and completely unmarked when it is off. Previously the "off" state fell back
   * to the learned/unlearned colors, so switching the chip off made the words
   * more prominent than switching it on — the switch felt inverted.
   */
  if (token.isFunctionWord) {
    return filters.functionWords ? "text-function" : "";
  }

  const enabled =
    (token.category === "learned" && filters.learned) ||
    (token.category === "unlearned" && filters.unlearned) ||
    (token.category === "unrecognized" && filters.unrecognized);

  if (!enabled) {
    return "rounded-[3px] text-foreground";
  }

  if (token.category === "learned") {
    return "rounded-[3px] bg-status-learned-muted text-status-learned-foreground";
  }

  if (token.category === "unlearned") {
    return `rounded-[3px] bg-status-unlearned-muted text-status-unlearned-foreground${
      insidePhrase
        ? ""
        : " underline decoration-status-unlearned-border decoration-dotted decoration-2 underline-offset-[3px]"
    }`;
  }

  return `rounded-[3px] text-muted-foreground${
    insidePhrase
      ? ""
      : " underline decoration-border decoration-dotted decoration-2 underline-offset-[3px]"
  }`;
}

/**
 * Phrases get their own color: one tinted block that also fills the gaps between
 * the words. No underline — a line running between the words of an expression
 * reads as a mistake.
 */
const PHRASE_CLASS = "rounded-[3px] bg-phrase-muted text-phrase-foreground";

const SELECTION_CLASS =
  "rounded-[3px] bg-accent text-accent-foreground outline outline-2 outline-offset-1 outline-primary";

/**
 * The annotated article. Every token is rendered verbatim inside a button so
 * clicking it opens the word; whitespace, punctuation and blank lines are kept
 * as-is, which also keeps `Range.toString()` aligned with the token offsets used
 * for selection reading.
 */
export function ReaderAnnotatedText({
  text,
  tokens,
  filters,
  activeRange,
  activeOffset,
  selectedRange,
  onSelectWord,
  phrases,
  collectedPhrases,
  onSelectPhrase,
  phraseLabels,
  rootRef,
}: {
  text: string;
  tokens: readonly ReaderToken[];
  filters: ReaderFilters;
  activeRange: { start: number; end: number } | null;
  activeOffset: number | null;
  /** Currently opened unit: the exact span of a word or of a whole phrase. */
  selectedRange: { start: number; end: number } | null;
  onSelectWord: (token: ReaderToken) => void;
  phrases: readonly ReaderPhrase[];
  /** Normalized phrases collected during this session (optimistic state). */
  collectedPhrases: ReadonlySet<string>;
  onSelectPhrase: (phrase: ReaderPhrase) => void;
  phraseLabels: { collected: string; other: string };
  rootRef: RefObject<HTMLDivElement | null>;
}) {
  const rendered = useMemo(() => segmentText(text, tokens), [text, tokens]);
  /**
   * Every token that belongs to a phrase, not just its first one, so the whole
   * expression shares one click target and one style.
   */
  const phraseByToken = useMemo(
    () =>
      filters.phrases
        ? mapPhrasesToTokens(tokens, phrases)
        : new Map<ReaderToken, ReaderPhrase>(),
    [filters.phrases, phrases, tokens],
  );

  const isSelected = (start: number, end: number) =>
    selectedRange !== null &&
    start >= selectedRange.start &&
    end <= selectedRange.end;

  return (
    <div
      ref={rootRef}
      data-reader-text=""
      className={cn(
        "font-display whitespace-pre-wrap break-words text-foreground",
        TEXT_SIZE_CLASS,
      )}
    >
      {rendered.map(({ block, segments }) => {
        const nodes: ReactNode[] = [];
        let openPhrase: { phrase: ReaderPhrase; children: ReactNode[] } | null =
          null;

        const flushPhrase = (key: string) => {
          if (!openPhrase) {
            return;
          }

          const phrase = openPhrase.phrase;
          nodes.push(
            <span
              key={key}
              data-phrase={phrase.normalized}
              title={`${phrase.canonical} · ${
                phrase.inWordBook || collectedPhrases.has(phrase.normalized)
                  ? phraseLabels.collected
                  : phraseLabels.other
              }`}
              className={cn(
                PHRASE_CLASS,
                isSelected(phrase.start, phrase.end) && SELECTION_CLASS,
              )}
            >
              {openPhrase.children}
            </span>,
          );
          openPhrase = null;
        };

        segments.forEach((segment, index) => {
          if (segment.kind === "text") {
            const target = openPhrase?.children ?? nodes;
            target.push(<Fragment key={`t-${index}`}>{segment.value}</Fragment>);
            return;
          }

          const token = segment.token;
          const phrase = phraseByToken.get(token) ?? null;

          // Close the previous group when the phrase changes or ends.
          if (openPhrase && openPhrase.phrase !== phrase) {
            flushPhrase(`p-${index}`);
          }

          if (phrase && !openPhrase) {
            openPhrase = { phrase, children: [] };
          }

          const isActive =
            activeOffset !== null &&
            token.start <= activeOffset &&
            activeOffset < token.end;
          const inChunk =
            !isActive &&
            activeRange !== null &&
            token.start >= activeRange.start &&
            token.end <= activeRange.end;
          const element = (
            <button
              key={`w-${token.start}`}
              data-start={token.start}
              type="button"
              tabIndex={-1}
              data-category={token.category}
              data-active={isActive || inChunk ? "true" : undefined}
              onClick={() => {
                if (phrase) {
                  onSelectPhrase(phrase);
                  return;
                }

                onSelectWord(token);
              }}
              className={cn(
                "cursor-pointer transition-colors",
                categoryClass(
                  token,
                  filters,
                  isActive,
                  Boolean(phrase),
                ),
                inChunk && "bg-accent/70",
                !phrase && isSelected(token.start, token.end) && SELECTION_CLASS,
              )}
            >
              {token.text}
            </button>
          );

          if (openPhrase) {
            openPhrase.children.push(element);

            if (token.end === openPhrase.phrase.end) {
              flushPhrase(`p-end-${index}`);
            }

            return;
          }

          nodes.push(element);
        });

        flushPhrase("p-tail");

        return (
          <p key={block.start} className="min-h-4">
            {nodes}
          </p>
        );
      })}
    </div>
  );
}
