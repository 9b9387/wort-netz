"use client";

import { Volume2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGermanSpeech } from "@/hooks/use-speech";

export function SpeakButton({
  text,
  label,
  iconOnly = false,
}: {
  text: string;
  label: string;
  /** Compact speaker-only trigger, used inside sentence lists. */
  iconOnly?: boolean;
}) {
  const { speak, speaking } = useGermanSpeech();

  if (iconOnly) {
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => speak({ text })}
        disabled={speaking}
        aria-label={label}
        title={label}
      >
        <Volume2Icon />
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => speak({ text })}
      disabled={speaking}
      aria-label={label}
    >
      <Volume2Icon data-icon="inline-start" />
      {label}
    </Button>
  );
}
