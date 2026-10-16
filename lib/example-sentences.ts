/**
 * Shared shape for the example card. Tatoeba sentences are the primary source,
 * OdeNet sense examples fill the remaining slots.
 */

export type ExampleSentenceSource = "tatoeba" | "odenet";

export type ExampleSentence = {
  id: string;
  text: string;
  /** Community translation (Tatoeba) when one exists. */
  translation: string | null;
  source: ExampleSentenceSource;
  sourceUrl: string | null;
  author: string | null;
  license: string | null;
};

export type TatoebaSentenceLike = {
  id: number;
  text: string;
  translation: string | null;
  author: string | null;
  license: string;
  sourceUrl: string | null;
};

function dedupeKey(text: string): string {
  return text.normalize("NFC").trim().toLowerCase();
}

export function buildExampleSentences({
  tatoeba,
  odenet,
  limit = 6,
}: {
  tatoeba: readonly TatoebaSentenceLike[];
  odenet: readonly string[];
  limit?: number;
}): ExampleSentence[] {
  const sentences: ExampleSentence[] = [];
  const seen = new Set<string>();

  for (const sentence of tatoeba) {
    const key = dedupeKey(sentence.text);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    sentences.push({
      id: `tatoeba-${sentence.id}`,
      text: sentence.text,
      translation: sentence.translation,
      source: "tatoeba",
      sourceUrl: sentence.sourceUrl,
      author: sentence.author,
      license: sentence.license,
    });
  }

  for (const [index, text] of odenet.entries()) {
    const trimmed = text.trim();
    const key = dedupeKey(trimmed);

    if (!trimmed || seen.has(key)) {
      continue;
    }

    seen.add(key);
    sentences.push({
      id: `odenet-${index}`,
      text: trimmed,
      translation: null,
      source: "odenet",
      sourceUrl: null,
      author: null,
      license: null,
    });
  }

  return sentences.slice(0, limit);
}
