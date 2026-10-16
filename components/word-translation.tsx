"use client";

import * as React from "react";
import { LanguagesIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  TRANSLATION_TARGETS,
  WordTranslationContext,
  useTranslatorController,
  useWordTranslation,
  type TranslationTarget,
} from "@/hooks/use-translator";

export type TranslationLabels = {
  targetLabel: string;
  enable: string;
  preparing: string;
  unsupported: string;
  failed: string;
  retry: string;
};

export function WordTranslationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const controller = useTranslatorController();

  return (
    <WordTranslationContext.Provider value={controller}>
      {children}
    </WordTranslationContext.Provider>
  );
}

/**
 * Renders the on-device translation of a single German string. When translation
 * is not ready yet (or the browser has no built-in translator) it renders
 * nothing, so the German source text always stays intact.
 */
export function TranslatedText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const { status, target, translate, revision } = useWordTranslation();
  const [value, setValue] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (status !== "ready") {
      return;
    }

    let cancelled = false;

    translate(text).then((result) => {
      if (!cancelled) {
        setValue(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [revision, status, text, translate]);

  if (status !== "ready" || !value) {
    return null;
  }

  return (
    <p
      data-slot="translated-text"
      lang={target}
      className={cn("text-sm leading-6 text-ink-secondary", className)}
    >
      {value}
    </p>
  );
}

export function TranslationControls({ labels }: { labels: TranslationLabels }) {
  const { status, progress, target, setTarget, enable } = useWordTranslation();
  const busy = status === "checking" || status === "downloading";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-nowrap items-center gap-2">
        <LanguagesIcon className="size-4 shrink-0 text-accent-ochre" />
        <span className="hidden text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:inline">
          {labels.targetLabel}
        </span>
        <Select
          value={target}
          items={TRANSLATION_TARGETS.map((item) => ({
            value: item.code,
            label: item.label,
          }))}
          onValueChange={(value) => {
            if (typeof value === "string") {
              setTarget(value as TranslationTarget);
            }
          }}
          disabled={status === "unsupported"}
        >
          <SelectTrigger size="sm" aria-label={labels.targetLabel}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TRANSLATION_TARGETS.map((item) => (
              <SelectItem key={item.code} value={item.code}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {status === "needs-enable" && (
          <Button size="sm" variant="outline" onClick={enable}>
            <LanguagesIcon data-icon="inline-start" />
            {labels.enable}
          </Button>
        )}

        {busy && (
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <Spinner />
            {status === "downloading" && progress !== null
              ? `${labels.preparing} ${Math.round(progress * 100)}%`
              : labels.preparing}
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

      {status === "unsupported" && (
        <p className="text-xs text-muted-foreground">{labels.unsupported}</p>
      )}
    </div>
  );
}
