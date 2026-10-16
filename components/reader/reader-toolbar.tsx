"use client";

import {
  BookOpenTextIcon,
  ListIcon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  SaveIcon,
  SquareIcon,
  TextSelectIcon,
  UndoIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import type { ReaderFilters } from "@/components/reader/reader-annotated-text";
import { cn } from "@/lib/utils";
import type { Translation } from "@/lib/i18n";
import type { ReaderPaneView } from "@/lib/reader/pane-state";
import type { ReaderStats } from "@/lib/reader/types";

export type ReaderMode = "view" | "edit" | "new";
export type ReaderAnalysisStatus = "idle" | "loading" | "ready" | "error";

export type ReaderSpeechControls = {
  supported: boolean;
  speaking: boolean;
  paused: boolean;
  rate: number;
  setRate: (rate: number) => void;
  onReadAll: () => void;
  onReadSelection: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
};

export const READER_SPEECH_RATES = [0.5, 1, 1.2] as const;

type LegendKey =
  | "learned"
  | "unlearned"
  | "unrecognized"
  | "phrases"
  | "functionWords";

export function formatReaderTime(iso: string | null): string | null {
  if (!iso) {
    return null;
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export type ReaderToolbarProps = {
  t: Translation;
  mode: ReaderMode;
  dirty: boolean;
  saving: boolean;
  saveError: string | null;
  savedAt: string | null;
  analysisStatus: ReaderAnalysisStatus;
  stats: ReaderStats | null;
  /** Number of phrases detected in the article, for the legend. */
  phraseCount: number;
  filters: ReaderFilters;
  onFiltersChange: (filters: ReaderFilters) => void;
  onStartEdit: () => void;
  onSave: () => void;
  onDiscard: () => void;
  onBackToList: () => void;
  onOpenWordList: () => void;
  onReanalyze: () => void;
  speech: ReaderSpeechControls;
  autoSpeak: boolean;
  onAutoSpeakChange: (value: boolean) => void;
  view: ReaderPaneView;
};

export function ReaderToolbar({
  t,
  mode,
  dirty,
  saving,
  saveError,
  savedAt,
  analysisStatus,
  stats,
  phraseCount,
  filters,
  onFiltersChange,
  onStartEdit,
  onSave,
  onDiscard,
  onBackToList,
  onOpenWordList,
  onReanalyze,
  speech,
  autoSpeak,
  onAutoSpeakChange,
  view,
}: ReaderToolbarProps) {
  const savedTime = formatReaderTime(savedAt);
  const legend: Array<{
    key: LegendKey;
    label: string;
    count: number;
    dot: string;
  }> = [
    {
      key: "learned",
      label: t.readerCategoryLearned,
      count: stats?.learnedUnique ?? 0,
      dot: "bg-status-learned",
    },
    {
      key: "unlearned",
      label: t.readerCategoryUnlearned,
      count: stats?.unlearnedUnique ?? 0,
      dot: "bg-status-unlearned",
    },
    {
      key: "unrecognized",
      label: t.readerCategoryUnrecognized,
      count: stats?.unrecognizedUnique ?? 0,
      dot: "bg-muted-foreground",
    },
    {
      key: "phrases",
      label: t.readerCategoryPhrase,
      count: phraseCount,
      dot: "bg-phrase",
    },
    {
      key: "functionWords",
      label: t.readerFunctionWords,
      count: stats?.functionWordUnique ?? 0,
      dot: "bg-function",
    },
  ];
  const pressed: LegendKey[] = legend
    .filter((item) => filters[item.key])
    .map((item) => item.key);

  const toggleLegendItem = (key: LegendKey) => {
    onFiltersChange({ ...filters, [key]: !filters[key] });
  };
  const saveErrorText =
    saveError === "too_long"
      ? t.readerTooLong
      : saveError === "empty"
        ? t.readerEmptyContent
        : saveError
          ? t.readerSaveFailed
          : null;

  return (
    <Card className="shadow-plate">
      <CardContent className="flex flex-col gap-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={view === "list" ? "secondary" : "outline"}
            size="sm"
            aria-pressed={view === "list"}
            onClick={onBackToList}
          >
            <ListIcon data-icon="inline-start" />
            {t.readerArticleList}
          </Button>

          <Separator orientation="vertical" className="h-5" />

          {mode === "view" ? (
            <Button variant="outline" size="sm" onClick={onStartEdit}>
              <PencilIcon data-icon="inline-start" />
              {t.readerEdit}
            </Button>
          ) : (
            <>
              <Button size="sm" onClick={onSave} disabled={saving || !dirty}>
                {saving ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <SaveIcon data-icon="inline-start" />
                )}
                {saving ? t.readerSaving : t.readerSave}
              </Button>
              <Button variant="ghost" size="sm" onClick={onDiscard}>
                <UndoIcon data-icon="inline-start" />
                {t.readerDiscard}
              </Button>
            </>
          )}

          <span className="text-xs text-muted-foreground">
            {mode === "new"
              ? t.readerDraftLabel
              : dirty
                ? t.readerUnsaved
                : savedTime
                  ? `${t.readerSaved} ${savedTime}`
                  : ""}
          </span>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Label
              htmlFor="reader-auto-speak"
              className="text-xs text-muted-foreground"
            >
              {t.readerAutoSpeak}
            </Label>
            <Switch
              id="reader-auto-speak"
              size="sm"
              checked={autoSpeak}
              onCheckedChange={onAutoSpeakChange}
            />
          </div>
        </div>

        <Separator />

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={speech.onReadAll}
            disabled={!speech.supported || analysisStatus !== "ready"}
          >
            <PlayIcon data-icon="inline-start" />
            {t.readerReadAll}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={speech.onReadSelection}
            disabled={!speech.supported || analysisStatus !== "ready"}
          >
            <TextSelectIcon data-icon="inline-start" />
            {t.readerReadSelection}
          </Button>
          {speech.speaking && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={speech.paused ? speech.onResume : speech.onPause}
              >
                {speech.paused ? (
                  <PlayIcon data-icon="inline-start" />
                ) : (
                  <PauseIcon data-icon="inline-start" />
                )}
                {speech.paused ? t.readerResume : t.readerPause}
              </Button>
              <Button variant="ghost" size="sm" onClick={speech.onStop}>
                <SquareIcon data-icon="inline-start" />
                {t.readerStop}
              </Button>
            </>
          )}

          <Select
            value={String(speech.rate)}
            items={READER_SPEECH_RATES.map((rate) => ({
              value: String(rate),
              label: `${rate}x`,
            }))}
            onValueChange={(value) => {
              if (typeof value === "string") {
                speech.setRate(Number(value));
              }
            }}
            disabled={!speech.supported}
          >
            <SelectTrigger size="sm" aria-label={t.readerSpeed}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {READER_SPEECH_RATES.map((rate) => (
                <SelectItem key={rate} value={String(rate)}>
                  {rate}x
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {!speech.supported && (
            <span className="text-xs text-muted-foreground">
              {t.readerSpeechUnsupported}
            </span>
          )}

          <Button variant="outline" size="sm" onClick={onOpenWordList}>
            <BookOpenTextIcon data-icon="inline-start" />
            {t.readerOpenWordList}
          </Button>
        </div>

        <Separator />

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {t.readerLegendHint}
          </span>
          {/* One plain Button per category so all chips share the exact same
              size, radius and border as the rest of the toolbar. */}
          <div
            role="group"
            aria-label={t.readerCategoryUnlearned}
            className="flex flex-wrap items-center gap-1.5"
          >
            {legend.map((item) => (
              <Button
                key={item.key}
                size="sm"
                variant={pressed.includes(item.key) ? "secondary" : "outline"}
                aria-pressed={pressed.includes(item.key)}
                onClick={() => toggleLegendItem(item.key)}
              >
                <span
                  aria-hidden
                  className={cn(
                    "size-2.5 shrink-0 rounded-full",
                    item.dot,
                    !pressed.includes(item.key) && "opacity-40",
                  )}
                />
                {item.label}
                <span
                  className={cn(
                    "font-code text-xs",
                    pressed.includes(item.key)
                      ? "text-muted-foreground"
                      : "text-muted-foreground/60",
                  )}
                >
                  {item.count}
                </span>
              </Button>
            ))}
          </div>

        </div>

        {analysisStatus === "loading" && (
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <Spinner />
            {t.readerAnalyzing}
          </span>
        )}

        {analysisStatus === "error" && (
          <span className="flex items-center gap-2 text-xs text-destructive">
            {t.readerAnalyzeFailed}
            <Button variant="outline" size="sm" onClick={onReanalyze}>
              {t.readerAnalyzeRetry}
            </Button>
          </span>
        )}

        {saveErrorText && (
          <span className="text-xs text-destructive">{saveErrorText}</span>
        )}

        {stats && stats.totalWords > 0 && (
          <div className="flex flex-col gap-3 rounded-lg border border-parchment-border bg-muted/40 p-3">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span title={t.readerCoverageHint}>{t.readerCoverage}</span>
                <span className="font-code">
                  {Math.round(stats.coverageTokenRatio * 100)}%
                </span>
              </div>
              <Progress value={stats.coverageTokenRatio * 100} />
            </div>

            <dl className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
              <div className="flex items-baseline gap-1.5">
                <dt className="text-muted-foreground">
                  {t.readerUnlearnedRate}
                </dt>
                <dd className="font-code">
                  {Math.round(stats.unlearnedRateRatio * 100)}%
                </dd>
              </div>
              <div className="flex items-baseline gap-1.5">
                <dt className="text-muted-foreground">{t.readerWordsCount}</dt>
                <dd className="font-code">{stats.totalWords}</dd>
              </div>
              <div className="flex items-baseline gap-1.5">
                <dt className="text-muted-foreground">
                  {t.readerEstimatedLevel}
                </dt>
                <dd className="font-code">
                  {stats.estimatedLevel ?? t.readerUnknownLevel}
                </dd>
              </div>
            </dl>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
