/**
 * Thin adapter over the browser built-in translation APIs.
 *
 * Chrome 138+ exposes the `Translator` interface (on-device translation with
 * language packs downloaded on demand). Earlier origin-trial builds exposed the
 * same capability on `translation`. Both are normalized here, and the API stays
 * optional so unsupported browsers simply fall back to "no translation".
 */

export type TranslatorAvailability =
  | "available"
  | "downloadable"
  | "downloading"
  | "unavailable";

export type LanguagePair = {
  sourceLanguage: string;
  targetLanguage: string;
};

export type TranslatorInstance = {
  translate(text: string): Promise<string>;
};

export type TranslatorAdapter = {
  availability(pair: LanguagePair): Promise<TranslatorAvailability>;
  create(
    pair: LanguagePair,
    onProgress?: (ratio: number) => void,
  ): Promise<TranslatorInstance>;
};

type ModernTranslatorApi = {
  availability(options: LanguagePair): Promise<TranslatorAvailability>;
  create(
    options: LanguagePair & { monitor?: (monitor: EventTarget) => void },
  ): Promise<TranslatorInstance>;
};

type LegacyTranslatorApi = {
  canTranslate(
    options: LanguagePair,
  ): Promise<"readily" | "after-download" | "no">;
  createTranslator(
    options: LanguagePair & { monitor?: (monitor: EventTarget) => void },
  ): Promise<TranslatorInstance>;
};

type ProgressEvent = Event & { loaded?: number };

function isFunction(value: unknown): value is (...args: never[]) => unknown {
  return typeof value === "function";
}

function monitorFrom(
  onProgress: ((ratio: number) => void) | undefined,
): ((monitor: EventTarget) => void) | undefined {
  if (!onProgress) {
    return undefined;
  }

  return (monitor) => {
    monitor.addEventListener("downloadprogress", (event) => {
      const loaded = (event as ProgressEvent).loaded;

      if (typeof loaded === "number" && Number.isFinite(loaded)) {
        onProgress(Math.min(Math.max(loaded, 0), 1));
      }
    });
  };
}

function modernAdapter(api: ModernTranslatorApi): TranslatorAdapter {
  return {
    availability: (pair) => api.availability(pair),
    create: (pair, onProgress) => {
      const monitor = monitorFrom(onProgress);

      if (monitor) {
        return api.create({ ...pair, monitor });
      }

      return api.create(pair);
    },
  };
}

function legacyAdapter(api: LegacyTranslatorApi): TranslatorAdapter {
  return {
    availability: async (pair) => {
      const state = await api.canTranslate(pair);

      if (state === "readily") {
        return "available";
      }

      if (state === "after-download") {
        return "downloadable";
      }

      return "unavailable";
    },
    create: (pair, onProgress) => {
      const monitor = monitorFrom(onProgress);

      if (monitor) {
        return api.createTranslator({ ...pair, monitor });
      }

      return api.createTranslator(pair);
    },
  };
}

export function getTranslatorAdapter(): TranslatorAdapter | null {
  if (typeof globalThis === "undefined") {
    return null;
  }

  const scope = globalThis as {
    Translator?: Partial<ModernTranslatorApi>;
    translation?: Partial<LegacyTranslatorApi>;
  };
  const modern = scope.Translator;

  if (
    modern &&
    isFunction(modern.availability) &&
    isFunction(modern.create)
  ) {
    return modernAdapter(modern as ModernTranslatorApi);
  }

  const legacy = scope.translation;

  if (
    legacy &&
    isFunction(legacy.canTranslate) &&
    isFunction(legacy.createTranslator)
  ) {
    return legacyAdapter(legacy as LegacyTranslatorApi);
  }

  return null;
}
