import { describe, expect, it } from "vitest";
import { candidateLemmas } from "../lib/reader/candidates";
import { SUPPLEMENTAL_PHRASES } from "../lib/reader/phrase-supplement";
import {
  buildPhraseIndex,
  findPhrases,
  mapPhrasesToTokens,
  type PhraseRow,
  type PhraseToken,
} from "../lib/reader/phrases";
import { normalizeSurface } from "../lib/reader/tokenize";

const VOCABULARY: PhraseRow[] = [
  { normalizedLemma: "zur verfügung stehen", lemma: "zur Verfügung stehen", partOfSpeech: "v" },
  { normalizedLemma: "auf jeden fall", lemma: "auf jeden Fall", partOfSpeech: "a" },
  { normalizedLemma: "in der lage sein", lemma: "in der Lage sein", partOfSpeech: "v" },
  { normalizedLemma: "in der regel", lemma: "in der Regel", partOfSpeech: "a" },
  { normalizedLemma: "guten tag", lemma: "guten Tag", partOfSpeech: "n" },
  { normalizedLemma: "in der", lemma: "in der", partOfSpeech: "x" },
];

const index = buildPhraseIndex(VOCABULARY);

/** Builds the token list the analyzer would produce for a single-line text. */
function tokenize(text: string, line = 0): PhraseToken[] {
  const segmenter = new Intl.Segmenter("de", { granularity: "word" });
  const tokens: PhraseToken[] = [];

  for (const segment of segmenter.segment(text)) {
    if (!segment.isWordLike) {
      continue;
    }

    tokens.push({
      text: segment.segment,
      normal: normalizeSurface(segment.segment),
      start: segment.index,
      end: segment.index + segment.segment.length,
      candidates: candidateLemmas(segment.segment).map((entry) => entry.lemma),
      line,
    });
  }

  return tokens;
}

function matchText(text: string) {
  return findPhrases(tokenize(text), index).map((match) => ({
    phrase: match.phrase.normalized,
    slice: text.slice(match.start, match.end),
  }));
}

describe("buildPhraseIndex", () => {
  it("drops phrases whose required part is only function words", () => {
    expect(index.buckets.has("in|2")).toBe(false);
  });

  it("keeps the full form for non-verb phrases", () => {
    expect(index.buckets.get("auf|3")?.[0]?.required).toEqual([
      "auf",
      "jeden",
      "fall",
    ]);
  });

  it("strips the trailing infinitive from verb phrases", () => {
    expect(index.buckets.get("zur|2")?.[0]?.required).toEqual([
      "zur",
      "verfügung",
    ]);
  });

  it("keeps phrases that mix a pronoun with a verb", () => {
    // Regression: verb forms were treated as function words, which dropped
    // "Es gibt" from the vocabulary entirely.
    const curated = buildPhraseIndex([
      { normalizedLemma: "Es gibt", lemma: "Es gibt", partOfSpeech: "v" },
    ]);

    expect(curated.buckets.get("es|2")?.[0]?.required).toEqual(["es", "gibt"]);
  });
});

describe("everyday expressions", () => {
  const curated = buildPhraseIndex(
    SUPPLEMENTAL_PHRASES.map((entry) => ({
      normalizedLemma: entry.phrase,
      lemma: entry.phrase,
      partOfSpeech: entry.pos ?? "r",
    })),
  );

  it("matches a greeting such as Bis bald as one unit", () => {
    expect(
      findPhrases(tokenize("Bis bald!"), curated).map(
        (match) => match.phrase.normalized,
      ),
    ).toEqual(["bis bald"]);
  });

  it("matches es gibt", () => {
    expect(
      findPhrases(tokenize("Es gibt keinen Grund"), curated).map(
        (match) => match.phrase.normalized,
      ),
    ).toEqual(["es gibt"]);
  });

  it("matches phrases with the verb separated", () => {
    expect(
      findPhrases(tokenize("Zur Verfügung stehen uns zwei Stunden"), curated).map(
        (match) => match.phrase.normalized,
      ),
    ).toEqual(["zur verfügung stehen"]);
  });
});

describe("mapPhrasesToTokens", () => {
  it("maps every word of a phrase, not only the first one", () => {
    // Regression: keying by phrase.start left the second word of "zur Verfügung"
    // behaving like a standalone word (own click target, own underline).
    const tokens = tokenize("Das steht zur Verfügung heute");
    const phrases = findPhrases(tokens, index);
    const mapping = mapPhrasesToTokens(tokens, phrases);

    const zur = tokens.find((token) => token.normal === "zur");
    const verfuegung = tokens.find((token) => token.normal === "verfügung");
    const heute = tokens.find((token) => token.normal === "heute");

    expect(phrases).toHaveLength(1);
    expect(mapping.get(zur!)).toBe(phrases[0]);
    expect(mapping.get(verfuegung!)).toBe(phrases[0]);
    expect(mapping.has(heute!)).toBe(false);
  });

  it("keeps tokens outside any phrase unmapped", () => {
    const tokens = tokenize("Der Hund läuft");

    expect(mapPhrasesToTokens(tokens, []).size).toBe(0);
    expect(mapPhrasesToTokens(tokens, findPhrases(tokens, index)).size).toBe(0);
  });
});

describe("findPhrases", () => {
  it("matches the content part of a verb phrase that appears without its verb", () => {
    expect(matchText("Das steht zur Verfügung.")).toEqual([
      { phrase: "zur verfügung stehen", slice: "zur Verfügung" },
    ]);
  });

  it("matches full non-verb phrases", () => {
    expect(matchText("Auf jeden Fall kommt er.")).toEqual([
      { phrase: "auf jeden fall", slice: "Auf jeden Fall" },
    ]);
  });

  it("does not match a phrase that is missing its content word", () => {
    // "in der" alone must not resolve to "in der Regel".
    expect(matchText("Der Hund in der Küche")).toEqual([]);
  });

  it("rejects matches that only share a word stem", () => {
    // Regression: "es lange" used to resolve to "es langt" through the stem.
    const stemIndex = buildPhraseIndex([
      { normalizedLemma: "es langt", lemma: "Es langt", partOfSpeech: "a" },
    ]);

    expect(findPhrases(tokenize("es lange"), stemIndex)).toEqual([]);
    expect(
      findPhrases(tokenize("es langt"), stemIndex).map(
        (match) => match.phrase.normalized,
      ),
    ).toEqual(["es langt"]);
  });

  it("requires function words to match exactly", () => {
    // "in die Lage sein" is a different phrase than "in der Lage sein".
    expect(matchText("Er ist in die Lage gekommen")).toEqual([]);
  });

  it("matches inflected content words through their lemma", () => {
    expect(matchText("Wir sind in der Lage dazu")).toEqual([
      { phrase: "in der lage sein", slice: "in der Lage" },
    ]);
  });

  it("matches adjective and noun phrases with inflected forms", () => {
    expect(matchText("Ich sagte guten Tag")).toEqual([
      { phrase: "guten tag", slice: "guten Tag" },
    ]);
  });

  it("keeps matches non-overlapping and prefers the longer window", () => {
    const matches = findPhrases(
      tokenize("Auf jeden Fall in der Regel"),
      index,
    );

    expect(matches.map((match) => match.phrase.normalized)).toEqual([
      "auf jeden fall",
      "in der regel",
    ]);
    expect(matches[0].tokenEnd).toBeLessThanOrEqual(matches[1].tokenStart);
  });

  it("does not match across a line break", () => {
    const tokens = [
      ...tokenize("zur", 0),
      ...tokenize("Verfügung", 1),
    ];

    expect(findPhrases(tokens, index)).toEqual([]);
  });
});
