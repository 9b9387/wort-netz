import { normalizeSurface } from "@/lib/reader/tokenize";

/**
 * A lookup is stored as its own entry when the form the user actually typed or
 * clicked differs from the dictionary lemma it resolved to ("ist" vs "sein").
 * The form keeps a link to the lemma instead of being merged into it.
 */
export function isDistinctForm(
  surfaceForm: string,
  resolvedLemma: string,
): boolean {
  const surface = normalizeSurface(surfaceForm);
  const lemma = normalizeSurface(resolvedLemma);

  return Boolean(surface) && surface !== lemma;
}
