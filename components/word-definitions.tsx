"use client";

import { Fragment } from "react";
import { cn } from "@/lib/utils";
import {
  TranslationControls,
  TranslatedText,
  type TranslationLabels,
} from "@/components/word-translation";
import { useWordTranslation } from "@/hooks/use-translator";

/**
 * German senses next to their on-device translation. Each sense occupies one
 * grid row, so the numbered German and Chinese columns stay aligned. The layout
 * only splits into two columns once the browser reported that translation is
 * usable; otherwise the German list keeps the full width.
 */
export function WordDefinitions({
  items,
  label,
  fallbackNote,
  labels,
}: {
  items: string[];
  label: string;
  fallbackNote: string | null;
  labels: TranslationLabels;
}) {
  const { status } = useWordTranslation();
  const showTranslations = status === "ready";
  const numbered = items.length > 1;
  const lastIndex = items.length - 1;

  const cellClass = (index: number) =>
    cn(
      "flex gap-2.5 py-3",
      index === 0 && "pt-0",
      index === lastIndex && "pb-0",
      index > 0 && "border-t border-parchment-border/60",
    );
  const numberClass =
    "font-display text-base font-semibold leading-7 text-primary";

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-parchment-border bg-ochre-muted p-4 sm:p-5">
      <div className="flex flex-nowrap items-center justify-between gap-3">
        <span className="truncate text-xs font-semibold uppercase tracking-wider text-ochre-foreground">
          {label}
        </span>
        <TranslationControls labels={labels} />
      </div>

      <div
        className={cn("grid gap-x-6", showTranslations && "md:grid-cols-2")}
      >
        {items.map((item, index) => (
          <Fragment key={item}>
            <div className={cellClass(index)}>
              {numbered && <span className={numberClass}>{index + 1}</span>}
              <p className="font-display text-lg leading-7 text-foreground">
                {item}
              </p>
            </div>

            {showTranslations && (
              <div
                className={cn(
                  cellClass(index),
                  "md:border-l md:border-parchment-border md:pl-6",
                )}
              >
                {numbered && (
                  <span className={cn(numberClass, "text-muted-foreground")}>
                    {index + 1}
                  </span>
                )}
                <TranslatedText
                  text={item}
                  className="font-display text-base leading-7"
                />
              </div>
            )}
          </Fragment>
        ))}
      </div>

      {fallbackNote && (
        <p className="text-xs text-muted-foreground">{fallbackNote}</p>
      )}
    </div>
  );
}
