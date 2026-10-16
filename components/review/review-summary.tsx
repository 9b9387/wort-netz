"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { Translation } from "@/lib/i18n";

export type ReviewSummaryItem = {
  lexemeId: string;
  rating: "FORGOT" | "KNOWN";
};

export function ReviewSummary({
  results,
  skippedCount,
  nextDueLabel,
  t,
  onContinue,
  onBack,
}: {
  results: readonly ReviewSummaryItem[];
  skippedCount: number;
  nextDueLabel: string | null;
  t: Translation;
  onContinue: () => void;
  onBack: () => void;
}) {
  const known = results.filter((item) => item.rating === "KNOWN").length;
  const forgot = results.length - known;
  const accuracy =
    results.length > 0 ? Math.round((known / results.length) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      <Card className="shadow-plate">
        <CardHeader>
          <CardTitle>{t.reviewSummaryTitle}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label={t.reviewSummaryKnown} value={known} />
            <Stat label={t.reviewSummaryForgot} value={forgot} />
            <Stat
              label={t.reviewSummaryAccuracy}
              value={`${accuracy}%`}
            />
          </div>

          <Separator />

          <div className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">{t.reviewSummaryNext}</span>
            <span>{nextDueLabel ?? "—"}</span>
          </div>
        </CardContent>
      </Card>

      {skippedCount > 0 && (
        <Alert>
          <AlertTitle>{t.reviewSentenceTitle}</AlertTitle>
          <AlertDescription>
            {t.reviewSkipped.replace("{count}", String(skippedCount))}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={onContinue}>{t.reviewSummaryContinue}</Button>
        <Button variant="outline" onClick={onBack}>
          {t.reviewSummaryBack}
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-4">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="font-heading text-2xl font-semibold">{value}</span>
      </CardContent>
    </Card>
  );
}
