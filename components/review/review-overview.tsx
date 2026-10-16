"use client";

import { useState } from "react";
import { CalendarClockIcon, PlayIcon, SparklesIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { Translation } from "@/lib/i18n";
import type { ReviewOverview } from "@/lib/review/types";

/** Roughly how long one sentence card takes, used for the time estimate. */
const SECONDS_PER_CARD = 15;

export function ReviewOverviewPanel({
  overview,
  t,
  nextDueLabel,
  loading,
  savingPlan,
  planSaved,
  onStart,
  onStartAhead,
  onSavePlan,
}: {
  overview: ReviewOverview;
  t: Translation;
  nextDueLabel: string | null;
  loading: boolean;
  savingPlan: boolean;
  planSaved: boolean;
  onStart: () => void;
  onStartAhead: () => void;
  onSavePlan: (input: { sessionSize: number; newPerDay: number }) => void;
}) {
  const [sessionSize, setSessionSize] = useState(overview.sessionSize);
  const [newPerDay, setNewPerDay] = useState(overview.newPerDay);
  const newRemaining = Math.max(0, overview.newPerDay - overview.todayNewCount);
  // Mirrors the server queue: due cards take the first slots, new words fill
  // whatever is left, capped by the remaining daily budget.
  const dueSlots = Math.min(overview.dueCount, overview.sessionSize);
  const planned =
    dueSlots +
    Math.min(overview.newCount, newRemaining, overview.sessionSize - dueSlots);
  const canStart = planned > 0;
  const minutes = Math.max(1, Math.round((planned * SECONDS_PER_CARD) / 60));
  const planDirty =
    sessionSize !== overview.sessionSize || newPerDay !== overview.newPerDay;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t.reviewDue} value={overview.dueCount} />
        <Stat
          label={t.reviewNewWords}
          value={overview.newCount}
          hint={`${overview.todayNewCount}/${overview.newPerDay}`}
        />
        <Stat label={t.reviewTodayReviewed} value={overview.todayReviewedCount} />
        <Stat
          label={t.reviewStreak}
          value={overview.streakDays}
          suffix={t.reviewDays}
        />
      </div>

      {canStart ? (
        <Card className="shadow-plate">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <span className="font-display text-lg font-semibold">
                {planned} {t.reviewSummaryReviewed}
              </span>
              <span className="text-sm text-muted-foreground">
                {t.reviewMinutes} ≈ {minutes} {t.reviewMinutesUnit} ·{" "}
                {t.reviewPlanSessionSize} {overview.sessionSize}
              </span>
            </div>
            <Button size="lg" onClick={onStart} disabled={loading}>
              {loading ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <PlayIcon data-icon="inline-start" />
              )}
              {loading ? t.reviewPreparing : t.reviewStart}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarClockIcon />
            </EmptyMedia>
            <EmptyTitle>
              {overview.newCount > 0
                ? t.reviewNewLimitReached.replace(
                    "{count}",
                    String(overview.newPerDay),
                  )
                : t.reviewNothingDue}
            </EmptyTitle>
            <EmptyDescription>
              {nextDueLabel
                ? t.reviewNothingDueHint.replace("{date}", nextDueLabel)
                : t.reviewEmptyHint}
            </EmptyDescription>
            {nextDueLabel && (
              <Button variant="outline" size="sm" onClick={onStartAhead} disabled={loading}>
                <SparklesIcon data-icon="inline-start" />
                {t.reviewAhead.replace(
                  "{count}",
                  String(overview.sessionSize),
                )}
              </Button>
            )}
          </EmptyHeader>
        </Empty>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t.reviewPlanTitle}</CardTitle>
          <CardDescription>{t.reviewPlanHint}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              onSavePlan({ sessionSize, newPerDay });
            }}
          >
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="review-session-size">
                  {t.reviewPlanSessionSize}
                </FieldLabel>
                <Input
                  id="review-session-size"
                  type="number"
                  min={1}
                  max={100}
                  value={sessionSize}
                  onChange={(event) =>
                    setSessionSize(Number(event.target.value))
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="review-new-per-day">
                  {t.reviewPlanNewPerDay}
                </FieldLabel>
                <Input
                  id="review-new-per-day"
                  type="number"
                  min={0}
                  max={100}
                  value={newPerDay}
                  onChange={(event) => setNewPerDay(Number(event.target.value))}
                />
              </Field>
            </FieldGroup>

            <div className="flex items-center gap-2">
              <Button type="submit" disabled={savingPlan || !planDirty}>
                {savingPlan && <Spinner data-icon="inline-start" />}
                {savingPlan ? t.reviewPlanSaving : t.reviewPlanSave}
              </Button>
              {planSaved && !planDirty && (
                <Badge variant="secondary">{t.reviewPlanSaved}</Badge>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  suffix,
  hint,
}: {
  label: string;
  value: number;
  suffix?: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-4">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="font-heading text-3xl font-semibold">
          {value}
          {suffix && (
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              {suffix}
            </span>
          )}
        </span>
        {hint && (
          <span className="font-code text-xs text-muted-foreground">{hint}</span>
        )}
      </CardContent>
    </Card>
  );
}
