"use client";

import { Volume2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGermanSpeech } from "@/hooks/use-speech";
import { cn } from "@/lib/utils";

const WAVEFORM_BARS = [
  "h-1.5",
  "h-3.5",
  "h-5",
  "h-2.5",
  "h-4",
  "h-[22px]",
  "h-3",
  "h-[18px]",
  "h-2",
  "h-1",
];

/**
 * Pronunciation control for the lemma. The whole plate is one button: the round
 * speaker badge, the phonetic transcription and the decorative waveform all
 * trigger playback.
 */
export function PronunciationBar({
  text,
  label,
  ipa,
}: {
  text: string;
  label: string;
  ipa: string | null;
}) {
  const { speak, speaking } = useGermanSpeech();

  return (
    <Button
      variant="outline"
      aria-label={label}
      title={label}
      disabled={speaking}
      onClick={() => speak({ text })}
      className="h-auto w-fit gap-3 rounded-lg border-parchment-border bg-surface-bright px-3 py-2 hover:bg-accent"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Volume2Icon className="size-4" />
      </span>

      <span className="flex flex-col items-start">
        {ipa && (
          <span className="font-code text-sm font-semibold text-foreground">
            [{ipa}]
          </span>
        )}
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          DE • Standard
        </span>
      </span>

      <span
        aria-hidden
        className={cn(
          "hidden h-6 w-20 shrink-0 items-center gap-1 transition-opacity sm:flex",
          speaking && "opacity-90",
        )}
      >
        {WAVEFORM_BARS.map((bar, index) => (
          <span
            key={`${bar}-${index}`}
            className={cn("w-1 rounded-full bg-primary/45", bar)}
          />
        ))}
      </span>
    </Button>
  );
}
