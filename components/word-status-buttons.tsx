"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2Icon, EyeOffIcon } from "lucide-react";
import { setWordStatus } from "@/app/actions/word-study";
import { Button } from "@/components/ui/button";
import { getDictionary } from "@/lib/i18n";
import type { WordStatus } from "@/lib/wordbook/status";

/**
 * Manual triage of an entry: "已掌握" and "暂时不学" are stored on the user's
 * word-book row, so they follow the word everywhere.
 */
export function WordStatusButtons({
  lexemeId,
  status,
}: {
  lexemeId: string;
  status: string;
}) {
  const t = getDictionary("zh");
  const router = useRouter();
  const [current, setCurrent] = useState(status);
  const [pending, startTransition] = useTransition();
  const mastered = current === "MASTERED";
  const suspended = current === "SUSPENDED";

  const apply = (target: WordStatus | null) => {
    const next: WordStatus = target ?? "NEW";

    startTransition(async () => {
      const result = await setWordStatus(lexemeId, next);

      if (result.ok) {
        setCurrent(next);
        router.refresh();
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant={mastered ? "secondary" : "outline"}
        size="sm"
        aria-pressed={mastered}
        disabled={pending}
        onClick={() => apply(mastered ? null : "MASTERED")}
      >
        <CheckCircle2Icon data-icon="inline-start" />
        {t.statusMastered}
      </Button>
      <Button
        variant={suspended ? "secondary" : "outline"}
        size="sm"
        aria-pressed={suspended}
        disabled={pending}
        onClick={() => apply(suspended ? null : "SUSPENDED")}
      >
        <EyeOffIcon data-icon="inline-start" />
        {t.statusSuspended}
      </Button>
    </div>
  );
}
