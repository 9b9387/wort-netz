"use client";

import {
  splitHighlightedText,
  type HighlightRange,
} from "@/lib/review/highlight";
import { cn } from "@/lib/utils";

/**
 * The German example sentence with the target word highlighted. Offsets come
 * from the server, so the view only has to slice the string.
 */
export function ReviewSentence({
  text,
  highlightRanges,
  className,
}: {
  text: string;
  highlightRanges: readonly HighlightRange[];
  className?: string;
}) {
  const segments = splitHighlightedText(text, highlightRanges);

  return (
    <p
      lang="de"
      className={cn("font-display text-lg leading-8 text-foreground", className)}
    >
      {segments.map((segment, index) =>
        segment.highlight ? (
          <mark
            // Segments have no stable identity, so the index is the key.
            key={index}
            className="rounded-[3px] bg-status-unlearned-muted px-0.5 font-semibold text-status-unlearned-foreground"
          >
            {segment.text}
          </mark>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </p>
  );
}
