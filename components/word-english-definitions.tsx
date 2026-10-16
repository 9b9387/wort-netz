"use client";

import { useEffect, useMemo, useState } from "react";
import { LanguagesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useTranslatorController } from "@/hooks/use-translator";

export type EnglishGlossLabels = {
  title: string;
  enable: string;
  preparing: string;
  unsupported: string;
  enableHint: string;
  failed: string;
  retry: string;
};

const ENGLISH_SOURCE_LANGUAGE = "en";

/**
 * English senses with an on-device Chinese translation, shown above the German
 * definitions: the English dictionary wording usually states the direct meaning
 * of a word, which is easier to grasp than a translated German definition.
 */
export function EnglishDefinitions({
  items,
  labels,
}: {
  items: readonly string[];
  labels: EnglishGlossLabels;
}) {
  const { status, progress, translate, enable, revision } =
    useTranslatorController(ENGLISH_SOURCE_LANGUAGE);
  const [translations, setTranslations] = useState<Record<string, string>>({});

  useEffect(() => {
    if (status !== "ready") {
      return;
    }

    let cancelled = false;

    void Promise.all(
      items.map(async (item) => {
        const value = await translate(item);

        return value ? ([item, value] as const) : null;
      }),
    ).then((pairs) => {
      if (cancelled) {
        return;
      }

      const resolved = pairs.filter(
        (pair): pair is readonly [string, string] => pair !== null,
      );

      if (resolved.length > 0) {
        setTranslations((current) => ({
          ...current,
          ...Object.fromEntries(resolved),
        }));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [items, revision, status, translate]);

  const busy = status === "checking" || status === "downloading";
  const statusLabel = useMemo(() => {
    if (status === "needs-enable") {
      return null;
    }

    if (busy) {
      return status === "downloading" && progress !== null
        ? `${labels.preparing} ${Math.round(progress * 100)}%`
        : labels.preparing;
    }

    if (status === "error") {
      return labels.failed;
    }

    if (status === "unsupported") {
      return labels.unsupported;
    }

    return null;
  }, [busy, labels, progress, status]);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-sage-border bg-sage-muted p-4 sm:p-5">
      <div className="flex flex-nowrap items-center justify-between gap-3">
        <span className="truncate text-xs font-semibold uppercase tracking-wider text-gender-neuter-foreground">
          {labels.title}
        </span>

        <div className="flex flex-nowrap items-center gap-2">
          <LanguagesIcon className="size-4 shrink-0 text-sage" />
          {status === "needs-enable" && (
            <Button size="sm" variant="outline" onClick={enable}>
              <LanguagesIcon data-icon="inline-start" />
              {labels.enable}
            </Button>
          )}
          {busy && (
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <Spinner />
              {statusLabel}
            </span>
          )}
          {status === "error" && (
            <>
              <span className="text-xs text-destructive">{labels.failed}</span>
              <Button size="sm" variant="outline" onClick={enable}>
                {labels.retry}
              </Button>
            </>
          )}
        </div>
      </div>

      <ul className="flex flex-col gap-3">
        {items.map((item, index) => (
          <li
            key={item}
            className={
              index > 0 ? "border-t border-sage-border/60 pt-3" : undefined
            }
          >
            <div className="flex gap-2.5">
              {items.length > 1 && (
                <span className="font-display text-base font-semibold leading-7 text-gender-neuter-foreground">
                  {index + 1}
                </span>
              )}
              <div className="flex min-w-0 flex-col gap-1">
                <p
                  lang="en"
                  className="font-display text-lg leading-7 text-foreground"
                >
                  {item}
                </p>
                {translations[item] && (
                  <p
                    data-slot="translated-text"
                    className="text-sm leading-6 text-ink-secondary"
                  >
                    {translations[item]}
                  </p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {status === "unsupported" && (
        <p className="text-xs text-muted-foreground">{labels.unsupported}</p>
      )}

      {status === "needs-enable" && (
        <p className="text-xs text-muted-foreground">{labels.enableHint}</p>
      )}
    </div>
  );
}
