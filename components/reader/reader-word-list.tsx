"use client";

import { Badge } from "@/components/ui/badge";
import { SpeakButton } from "@/components/speak-button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import type { ReaderWordEntry } from "@/lib/reader/word-list";
import type { Translation } from "@/lib/i18n";

function categoryBadge(entry: ReaderWordEntry, t: Translation) {
  if (entry.category === "learned") {
    return (
      <Badge
        variant="outline"
        className="border-status-learned-border bg-status-learned-muted text-status-learned-foreground"
      >
        {t.readerCategoryLearned}
      </Badge>
    );
  }

  if (entry.category === "unlearned") {
    return (
      <Badge
        variant="outline"
        className="border-status-unlearned-border bg-status-unlearned-muted text-status-unlearned-foreground"
      >
        {t.readerCategoryUnlearned}
      </Badge>
    );
  }

  return <Badge variant="outline">{t.readerCategoryUnrecognized}</Badge>;
}

export function ReaderWordList({
  entries,
  excludedCount,
  selectedKey,
  onSelect,
  t,
}: {
  entries: readonly ReaderWordEntry[];
  excludedCount: number;
  selectedKey: string | null;
  onSelect: (entry: ReaderWordEntry) => void;
  t: Translation;
}) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>{t.readerWordsEmpty}</EmptyTitle>
            <EmptyDescription>{t.readerWordsHint}</EmptyDescription>
          </EmptyHeader>
        </Empty>
        {excludedCount > 0 && (
          <p className="text-xs text-muted-foreground">
            {t.readerWordsExcluded.replace("{count}", String(excludedCount))}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">{t.readerWordsHint}</p>

      <ul className="flex flex-col divide-y divide-parchment-border rounded-lg border border-parchment-border">
        {entries.map((entry) => (
          <li key={entry.key}>
            <div
              className={cn(
                "flex items-center gap-2 px-2 py-2",
                selectedKey === entry.key && "bg-accent",
              )}
            >
              <SpeakButton
                text={entry.surface}
                label={t.pronounce}
                iconOnly
              />

              <button
                type="button"
                onClick={() => onSelect(entry)}
                className="flex min-w-0 flex-1 flex-col items-start gap-1 text-left"
              >
                <span className="flex w-full items-baseline gap-2">
                  <span className="truncate font-display text-base">
                    {entry.lemma}
                  </span>
                  <span className="font-code shrink-0 text-xs text-muted-foreground">
                    ×{entry.count}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-1.5">
                  {categoryBadge(entry, t)}
                  {entry.level && (
                    <Badge
                      variant="outline"
                      className="border-cefr bg-cefr-muted font-code text-cefr-foreground"
                    >
                      {entry.level}
                    </Badge>
                  )}
                  {entry.pos && (
                    <span className="text-xs text-muted-foreground">
                      {entry.pos}
                    </span>
                  )}
                  {entry.surface.toLowerCase() !== entry.lemma.toLowerCase() && (
                    <span className="font-code text-xs text-muted-foreground">
                      {t.readerWordSurface}: {entry.surface}
                    </span>
                  )}
                </span>
              </button>
            </div>
          </li>
        ))}
      </ul>

      {excludedCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {t.readerWordsExcluded.replace("{count}", String(excludedCount))}
        </p>
      )}
    </div>
  );
}
