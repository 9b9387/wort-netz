"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SpeakOptions = {
  text: string;
  /** Speech rate; defaults to a per-text heuristic (slower for single words). */
  rate?: number;
};

export type SpeechItem = {
  text: string;
  rate?: number;
  /** Silence played after this item before the next one starts. */
  pauseAfterMs?: number;
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
  /**
   * Bumped whenever playback is replaced or stopped. A running sequence checks
   * the token before scheduling the next utterance, so an old chain cannot
   * resume after the user moved on.
   */
  const sequenceRef = useRef(0);

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

    sequenceRef.current += 1;
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

  /**
   * Reads several texts one after another ("word, then sentence"). Each item
   * can slow down or add a pause after itself.
   */
  const speakSequence = useCallback((items: readonly SpeechItem[]) => {
    if (
      typeof window === "undefined" ||
      !("speechSynthesis" in window)
    ) {
      return;
    }

    const usable = items.filter((item) => item.text.trim());

    if (usable.length === 0) {
      return;
    }

    const token = sequenceRef.current + 1;
    sequenceRef.current = token;
    window.speechSynthesis.cancel();
    setSpeaking(true);

    const speakAt = (index: number) => {
      if (token !== sequenceRef.current) {
        return;
      }

      const item = usable[index];

      if (!item) {
        setSpeaking(false);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(item.text);
      utterance.lang = "de-DE";
      utterance.rate =
        item.rate ?? (item.text.includes(" ") ? 0.95 : 0.8);

      if (germanVoiceRef.current) {
        utterance.voice = germanVoiceRef.current;
      }

      const advance = () => {
        if (token !== sequenceRef.current) {
          return;
        }

        if (item.pauseAfterMs && item.pauseAfterMs > 0) {
          setTimeout(() => speakAt(index + 1), item.pauseAfterMs);
          return;
        }

        speakAt(index + 1);
      };

      utterance.onend = advance;
      utterance.onerror = () => {
        if (token === sequenceRef.current) {
          setSpeaking(false);
        }
      };

      window.speechSynthesis.speak(utterance);
    };

    speakAt(0);
  }, []);

  /** Stops whatever is playing, including a queued sequence. */
  const stop = useCallback(() => {
    sequenceRef.current += 1;

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    setSpeaking(false);
  }, []);

  return { speak, speakSequence, stop, speaking };
}
