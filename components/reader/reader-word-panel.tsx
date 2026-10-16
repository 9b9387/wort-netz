"use client";

import type { ReactNode } from "react";
import { ArrowLeftIcon, XIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ReaderWordList,
} from "@/components/reader/reader-word-list";
import type { Translation } from "@/lib/i18n";
import type { ReaderWordEntry } from "@/lib/reader/word-list";
import type { OpenReaderWordReason } from "@/app/actions/reader";

export type ReaderDetailTab = "word" | "words";

export function ReaderWordPanel({
  activeTab,
  wordSlot,
  entries,
  excludedCount,
  selectedKey,
  pendingSurface,
  errorSurface,
  errorReason,
  onTabChange,
  onSelectEntry,
  onBackToList,
  onClose,
  onRetry,
  onRecordEncounter,
  encounterRecorded,
  phraseWords,
  t,
}: {
  activeTab: ReaderDetailTab;
  wordSlot: ReactNode;
  entries: readonly ReaderWordEntry[];
  /** Unrecognized words that are deliberately not listed. */
  excludedCount: number;
  selectedKey: string | null;
  pendingSurface: string | null;
  /** The word that failed, used as the alert title. */
  errorSurface: string | null;
  errorReason: OpenReaderWordReason | null;
  onTabChange: (tab: ReaderDetailTab) => void;
  onSelectEntry: (entry: ReaderWordEntry) => void;
  onBackToList: () => void;
  onClose: () => void;
  onRetry: () => void;
  onRecordEncounter: () => void;
  encounterRecorded: boolean;
  /** Words of the currently opened phrase, so each one stays reachable. */
  phraseWords: Array<{ key: string; label: string; onSelect: () => void }>;
  t: Translation;
}) {
  const errorText =
    errorReason === "not_found"
      ? t.readerWordNotFoundHint
      : errorReason === "service_unavailable"
        ? t.readerWordUnavailable
        : errorReason
          ? t.readerWordFailed
          : null;

  return (
    <Card className="flex h-full min-h-0 flex-col shadow-plate">
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 p-3">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBackToList}
            className="min-w-0 flex-1 justify-start"
          >
            <ArrowLeftIcon data-icon="inline-start" />
            <span className="truncate">{t.readerBackToList}</span>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t.readerCloseDetail}
            title={t.readerCloseDetail}
            onClick={onClose}
          >
            <XIcon />
          </Button>
        </div>

        <Separator />

        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            if (value === "word" || value === "words") {
              onTabChange(value);
            }
          }}
          className="min-h-0 flex-1"
        >
          <TabsList>
            <TabsTrigger value="word">{t.readerPanelWordTab}</TabsTrigger>
            <TabsTrigger value="words">{t.readerPanelWordsTab}</TabsTrigger>
          </TabsList>

          <TabsContent value="word" className="min-h-0 overflow-y-auto pt-2">
            {pendingSurface ? (
              <div className="flex flex-col gap-3">
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner />
                  {t.readerWordLoading}
                </span>
                <p className="font-display text-lg">{pendingSurface}</p>
                <Skeleton className="h-40 rounded-xl" />
                <Skeleton className="h-24 rounded-xl" />
              </div>
            ) : errorText ? (
              <Alert variant="destructive">
                <AlertTitle>
                  {errorSurface ?? pendingSurface ?? t.readerWordFailed}
                </AlertTitle>
                <AlertDescription className="flex flex-col gap-3">
                  <span>{errorText}</span>
                  {/* Retrying a word the dictionary does not have cannot help;
                      it is only offered for transient failures. */}
                  {errorReason !== "not_found" && errorReason !== "invalid" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onRetry}
                      className="w-fit"
                    >
                      {t.readerWordRetry}
                    </Button>
                  )}
                </AlertDescription>
              </Alert>
            ) : wordSlot ? (
              <div className="flex flex-col gap-3">
                {phraseWords.length > 0 && (
                  <div className="flex flex-col gap-1.5 rounded-lg border border-parchment-border bg-muted/50 p-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t.readerPhraseWords}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {phraseWords.map((word) => (
                        <Button
                          key={word.key}
                          variant="outline"
                          size="sm"
                          onClick={word.onSelect}
                        >
                          {word.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {t.readerWordRecorded}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onRecordEncounter}
                    disabled={encounterRecorded}
                  >
                    {encounterRecorded
                      ? t.readerRecordEncounterDone
                      : t.readerRecordEncounter}
                  </Button>
                </div>
                {wordSlot}
              </div>
            ) : (
              <Empty className="border">
                <EmptyHeader>
                  <EmptyTitle>{t.readerNoWordSelected}</EmptyTitle>
                  <EmptyDescription>{t.readerWordLookupHint}</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </TabsContent>

          <TabsContent value="words" className="min-h-0 overflow-y-auto pt-2">
            <ReaderWordList
              entries={entries}
              excludedCount={excludedCount}
              selectedKey={selectedKey}
              onSelect={onSelectEntry}
              t={t}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
