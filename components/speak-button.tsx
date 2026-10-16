"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SpeakButton({
  text,
  label,
}: {
  text: string;
  label: string;
}) {
  const germanVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (!("speechSynthesis" in window)) {
      return;
    }

    const selectGermanVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      germanVoiceRef.current =
        voices.find((voice) => voice.lang.toLowerCase() === "de-de") ??
        voices.find((voice) => voice.lang.toLowerCase().startsWith("de")) ??
        null;
    };

    selectGermanVoice();
    window.speechSynthesis.addEventListener(
      "voiceschanged",
      selectGermanVoice,
    );

    return () => {
      window.speechSynthesis.removeEventListener(
        "voiceschanged",
        selectGermanVoice,
      );
    };
  }, []);

  const speak = () => {
    if (!text.trim() || !("speechSynthesis" in window)) {
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "de-DE";
    utterance.rate = text.includes(" ") ? 0.95 : 0.8;

    if (germanVoiceRef.current) {
      utterance.voice = germanVoiceRef.current;
    }

    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={speak}
      disabled={speaking}
      aria-label={label}
    >
      <Volume2Icon data-icon="inline-start" />
      {label}
    </Button>
  );
}
