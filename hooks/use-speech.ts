"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SpeakOptions = {
  text: string;
  /** Speech rate; defaults to a per-text heuristic (slower for single words). */
  rate?: number;
};

/**
 * Picks the best available German voice: an exact de-DE match first, then any
 * German variant. Shared by the entry pronunciation control and the reader's
 * long-form reader.
 */
export function selectGermanVoice(
  voices: readonly SpeechSynthesisVoice[],
): SpeechSynthesisVoice | null {
  return (
    voices.find((voice) => voice.lang.toLowerCase() === "de-de") ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith("de")) ??
    null
  );
}

/**
 * German speech synthesis with a preferred de-DE voice. Shared by the entry
 * pronunciation control and the per-sentence speak buttons.
 */
export function useGermanSpeech() {
  const germanVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (!("speechSynthesis" in window)) {
      return;
    }

    const refreshVoice = () => {
      germanVoiceRef.current = selectGermanVoice(
        window.speechSynthesis.getVoices(),
      );
    };

    refreshVoice();
    window.speechSynthesis.addEventListener("voiceschanged", refreshVoice);

    return () => {
      window.speechSynthesis.removeEventListener(
        "voiceschanged",
        refreshVoice,
      );
    };
  }, []);

  const speak = useCallback(({ text, rate }: SpeakOptions) => {
    if (
      !text.trim() ||
      typeof window === "undefined" ||
      !("speechSynthesis" in window)
    ) {
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "de-DE";
    utterance.rate = rate ?? (text.includes(" ") ? 0.95 : 0.8);

    if (germanVoiceRef.current) {
      utterance.voice = germanVoiceRef.current;
    }

    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, []);

  return { speak, speaking };
}
