"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { buildSpeechChunks, type SpeechRange } from "@/lib/reader/speech-chunks";
import {
  domOffsetToSourceOffset,
  splitTextBlocks,
} from "@/lib/reader/render-blocks";
import { selectGermanVoice } from "@/hooks/use-speech";

export type { SpeechRange };

export type ArticleSpeech = {
  supported: boolean;
  speaking: boolean;
  paused: boolean;
  /** The sentence currently being read, as absolute offsets into the text. */
  chunk: SpeechRange | null;
  /** Word-level offset reported by `onboundary`, when the browser supports it. */
  activeOffset: number | null;
  rate: number;
  setRate: (rate: number) => void;
  speakRange: (text: string, range?: SpeechRange) => void;
  speakSelection: (text: string, root: HTMLElement | null) => boolean;
  pause: () => void;
  resume: () => void;
  stop: () => void;
};

/**
 * Maps a DOM selection inside `root` back to absolute offsets in `text`. The
 * annotated text renders every token verbatim, but the line blocks do not
 * contribute the newlines they represent, so DOM offsets are translated through
 * `domOffsetToSourceOffset` before they are used as text offsets.
 */
export function selectionRange(
  root: HTMLElement,
  text: string,
): SpeechRange | null {
  const selection = window.getSelection();

  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }

  const range = selection.getRangeAt(0);

  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) {
    return null;
  }

  const prefix = document.createRange();
  prefix.setStart(root, 0);
  prefix.setEnd(range.startContainer, range.startOffset);
  const domStart = prefix.toString().length;
  const domEnd = domStart + range.toString().length;
  const blocks = splitTextBlocks(text);
  const start = domOffsetToSourceOffset(blocks, domStart);
  const end = domOffsetToSourceOffset(blocks, domEnd);

  if (end <= start) {
    return null;
  }

  return { start, end };
}

/**
 * Long-form German speech for the reader: sentence-chunked playback of the
 * whole article or of the current selection, with optional word-level
 * highlighting when the browser reports boundary events.
 */
export function useArticleSpeech(): ArticleSpeech {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [chunk, setChunk] = useState<SpeechRange | null>(null);
  const [activeOffset, setActiveOffset] = useState<number | null>(null);
  const [rate, setRate] = useState(1);

  const textRef = useRef("");
  const queueRef = useRef<SpeechRange[]>([]);
  const indexRef = useRef(0);
  const rateRef = useRef(1);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const playingRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    const synth = window.speechSynthesis;
    const refreshVoice = () => {
      voiceRef.current = selectGermanVoice(synth.getVoices());
    };

    refreshVoice();
    synth.addEventListener("voiceschanged", refreshVoice);

    // Deferred so the state update happens outside the effect body.
    const timer = setTimeout(() => setSupported(true), 0);

    return () => {
      clearTimeout(timer);
      synth.removeEventListener("voiceschanged", refreshVoice);
    };
  }, []);

  const reset = useCallback(() => {
    playingRef.current = false;
    queueRef.current = [];
    indexRef.current = 0;
    setSpeaking(false);
    setPaused(false);
    setChunk(null);
    setActiveOffset(null);
  }, []);

  // Playback is driven by the utterance's own events, so the recursion goes
  // through a ref instead of the callback referencing itself.
  const speakAtRef = useRef<(index: number) => void>(() => {});

  const speakAt = useCallback(
    (index: number) => {
      if (!playingRef.current) {
        return;
      }

      const current = queueRef.current[index];

      if (!current) {
        reset();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(
        textRef.current.slice(current.start, current.end),
      );
      utterance.lang = "de-DE";
      utterance.rate = rateRef.current;

      if (voiceRef.current) {
        utterance.voice = voiceRef.current;
      }

      utterance.onstart = () => {
        setSpeaking(true);
        setPaused(false);
        setChunk(current);
        setActiveOffset(current.start);
      };
      utterance.onboundary = (event) => {
        if (typeof event.charIndex === "number") {
          setActiveOffset(current.start + event.charIndex);
        }
      };
      utterance.onend = () => {
        indexRef.current = index + 1;
        speakAtRef.current(index + 1);
      };
      utterance.onerror = () => {
        reset();
      };

      window.speechSynthesis.speak(utterance);
    },
    [reset],
  );

  useEffect(() => {
    speakAtRef.current = speakAt;
  }, [speakAt]);

  const stop = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    reset();
  }, [reset]);

  const speakRange = useCallback(
    (text: string, range?: SpeechRange) => {
      if (
        typeof window === "undefined" ||
        !("speechSynthesis" in window) ||
        !text.trim()
      ) {
        return;
      }

      window.speechSynthesis.cancel();

      const chunks = buildSpeechChunks(text, range);

      if (chunks.length === 0) {
        return;
      }

      textRef.current = text;
      queueRef.current = chunks;
      indexRef.current = 0;
      playingRef.current = true;
      speakAt(0);
    },
    [speakAt],
  );

  const speakSelection = useCallback(
    (text: string, root: HTMLElement | null): boolean => {
      if (!root) {
        return false;
      }

      const range = selectionRange(root, text);

      if (!range) {
        return false;
      }

      speakRange(text, range);
      return true;
    },
    [speakRange],
  );

  const pause = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    window.speechSynthesis.pause();
    setPaused(true);
  }, []);

  const resume = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    window.speechSynthesis.resume();
    setPaused(false);
  }, []);

  const updateRate = useCallback((next: number) => {
    rateRef.current = next;
    setRate(next);
  }, []);

  // Activity hides the page with `display: none`, which does not stop media:
  // cancel speech whenever the reader is hidden or unmounted.
  useLayoutEffect(() => {
    return () => {
      playingRef.current = false;

      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return {
    supported,
    speaking,
    paused,
    chunk,
    activeOffset,
    rate,
    setRate: updateRate,
    speakRange,
    speakSelection,
    pause,
    resume,
    stop,
  };
}
