"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { openReaderWord } from "@/app/actions/reader";
import { cn } from "@/lib/utils";
import { getDictionary } from "@/lib/i18n";

/**
 * Any word shown inside an entry (definition text, example sentence, inflection,
 * synonym chip) becomes a link to that word's entry. Unknown words are looked up
 * on demand, and nothing is added to the word book unless the user presses the
 * "添加到单词本" button on the target page.
 */
export function WordLink({
  surface,
  lexemeId = null,
  lemma = null,
  className,
  children,
}: {
  surface: string;
  lexemeId?: string | null;
  lemma?: string | null;
  className?: string;
  children?: React.ReactNode;
}) {
  const t = getDictionary("zh");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  const [resolving, setResolving] = useState(false);

  const open = async () => {
    if (pending || resolving || failed) {
      return;
    }

    let targetId = lexemeId;

    if (!targetId) {
      setResolving(true);

      const result = await openReaderWord({
        surfaceForm: surface,
        lexemeId: null,
        lemma,
        countEncounter: false,
      });

      setResolving(false);

      if (!result.ok) {
        setFailed(true);
        return;
      }

      targetId = result.lexemeId;
    }

    const href = `/words/${targetId}?s=${encodeURIComponent(surface)}`;

    startTransition(() => {
      router.push(href);
    });
  };

  return (
    <button
      type="button"
      onClick={() => void open()}
      disabled={pending || resolving}
      title={failed ? t.wordLookupFailed : t.search}
      className={cn(
        "cursor-pointer text-left underline decoration-dotted decoration-border underline-offset-2 transition-colors hover:text-primary",
        (pending || resolving) && "opacity-60",
        failed && "cursor-default text-muted-foreground line-through",
        className,
      )}
    >
      {children ?? surface}
    </button>
  );
}

/**
 * Splits German text into plain parts and clickable words, so definitions and
 * example sentences can be navigated word by word.
 */
export function ClickableGermanText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const parts = splitGermanText(text);

  return (
    <span className={className}>
      {parts.map((part, index) =>
        part.clickable ? (
          <WordLink key={`${part.value}-${index}`} surface={part.value} />
        ) : (
          <span key={`${part.value}-${index}`}>{part.value}</span>
        ),
      )}
    </span>
  );
}

type TextPart = { value: string; clickable: boolean };

function splitGermanText(text: string): TextPart[] {
  const segmenter = new Intl.Segmenter("de", { granularity: "word" });
  const parts: TextPart[] = [];
  let cursor = 0;

  for (const segment of segmenter.segment(text)) {
    if (!segment.isWordLike) {
      continue;
    }

    if (segment.index > cursor) {
      parts.push({ value: text.slice(cursor, segment.index), clickable: false });
    }

    parts.push({ value: segment.segment, clickable: true });
    cursor = segment.index + segment.segment.length;
  }

  if (cursor < text.length) {
    parts.push({ value: text.slice(cursor), clickable: false });
  }

  return parts;
}
