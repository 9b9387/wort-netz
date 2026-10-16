/**
 * The form a user actually typed or clicked ("ist", "zur Verfügung"), carried in
 * the `s` query parameter so the word card can show it as the headline while the
 * dictionary lemma is called out next to it.
 */
const SURFACE_PATTERN = /^[\p{L}\p{M}ßẞ'’.\- ]{1,48}$/u;

export function parseSurfaceForm(
  value: string | string[] | undefined,
): string | null {
  const raw = Array.isArray(value) ? value[0] : value;

  if (typeof raw !== "string") {
    return null;
  }

  const trimmed = raw.trim();

  return SURFACE_PATTERN.test(trimmed) ? trimmed.normalize("NFC") : null;
}
