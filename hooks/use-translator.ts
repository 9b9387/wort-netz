"use client";

import * as React from "react";
import {
  getTranslatorAdapter,
  type TranslatorAdapter,
  type TranslatorInstance,
} from "@/lib/browser-translator";

export const TRANSLATION_SOURCE_LANGUAGE = "de";

/**
 * Target languages offered in the entry page. Only Simplified Chinese is
 * enabled today; the list is the extension point for more languages.
 */
export const TRANSLATION_TARGETS = [
  { code: "zh", label: "中文（简体）" },
] as const satisfies ReadonlyArray<{ code: string; label: string }>;

export type TranslationTarget = (typeof TRANSLATION_TARGETS)[number]["code"];

export type TranslationStatus =
  | "checking"
  | "ready"
  | "needs-enable"
  | "downloading"
  | "unsupported"
  | "error";

export type TranslatorController = {
  status: TranslationStatus;
  progress: number | null;
  target: TranslationTarget;
  setTarget: (target: TranslationTarget) => void;
  enable: () => void;
  translate: (text: string) => Promise<string | null>;
  /** Bumped whenever cached translations change so consumers re-render. */
  revision: number;
};

export const WordTranslationContext =
  React.createContext<TranslatorController | null>(null);

function pairFor(target: TranslationTarget) {
  return {
    sourceLanguage: TRANSLATION_SOURCE_LANGUAGE,
    targetLanguage: target,
  };
}

/**
 * Creates one translator per target language, translating every distinct string
 * at most once and keeping results in memory for the rest of the session.
 */
export function useTranslatorController(): TranslatorController {
  const [target, setTarget] = React.useState<TranslationTarget>(
    TRANSLATION_TARGETS[0].code,
  );
  const [status, setStatus] = React.useState<TranslationStatus>("checking");
  const [progress, setProgress] = React.useState<number | null>(null);
  const [revision, setRevision] = React.useState(0);
  const adapterRef = React.useRef<TranslatorAdapter | null>(null);
  const translatorRef = React.useRef<TranslatorInstance | null>(null);
  const cacheRef = React.useRef(new Map<string, string>());
  const inflightRef = React.useRef(new Map<string, Promise<string | null>>());

  const cacheKey = React.useCallback(
    (text: string) => `${target}\u0000${text}`,
    [target],
  );

  React.useEffect(() => {
    let cancelled = false;

    const probe = async () => {
      // Yield first so every state update below happens outside the effect body.
      await Promise.resolve();

      if (cancelled) {
        return;
      }

      const adapter = getTranslatorAdapter();

      if (!adapter) {
        setStatus("unsupported");
        return;
      }

      adapterRef.current = adapter;

      try {
        const availability = await adapter.availability(pairFor(target));

        if (cancelled) {
          return;
        }

        if (availability === "available") {
          try {
            const translator = await adapter.create(pairFor(target));

            if (cancelled) {
              return;
            }

            translatorRef.current = translator;
            setStatus("ready");
          } catch {
            if (!cancelled) {
              setStatus("needs-enable");
            }
          }

          return;
        }

        if (availability === "downloadable") {
          setStatus("needs-enable");
          return;
        }

        if (availability === "downloading") {
          setStatus("downloading");
          return;
        }

        setStatus("unsupported");
      } catch {
        if (!cancelled) {
          setStatus("unsupported");
        }
      }
    };

    void probe();

    return () => {
      cancelled = true;
    };
  }, [target]);

  const enable = React.useCallback(() => {
    const adapter = adapterRef.current;

    if (!adapter || status === "downloading" || status === "ready") {
      return;
    }

    setStatus("downloading");
    setProgress(0);

    adapter
      .create(pairFor(target), (ratio) => setProgress(ratio))
      .then((translator) => {
        translatorRef.current = translator;
        setProgress(null);
        setStatus("ready");
      })
      .catch(() => {
        setProgress(null);
        setStatus("error");
      });
  }, [status, target]);

  const translate = React.useCallback(
    async (text: string): Promise<string | null> => {
      const trimmed = text.trim();

      if (!trimmed || status !== "ready") {
        return null;
      }

      const key = cacheKey(trimmed);
      const cached = cacheRef.current.get(key);

      if (cached) {
        return cached;
      }

      const inflight = inflightRef.current.get(key);

      if (inflight) {
        return inflight;
      }

      const translator = translatorRef.current;

      if (!translator) {
        return null;
      }

      const pending = translator
        .translate(trimmed)
        .then((result) => {
          const value = result.trim();

          if (!value) {
            return null;
          }

          cacheRef.current.set(key, value);
          setRevision((current) => current + 1);
          return value;
        })
        .catch(() => null)
        .finally(() => {
          inflightRef.current.delete(key);
        });

      inflightRef.current.set(key, pending);
      return pending;
    },
    [cacheKey, status],
  );

  return {
    status,
    progress,
    target,
    setTarget,
    enable,
    translate,
    revision,
  };
}

export function useWordTranslation(): TranslatorController {
  const context = React.useContext(WordTranslationContext);

  if (!context) {
    throw new Error(
      "useWordTranslation must be used inside WordTranslationProvider",
    );
  }

  return context;
}
