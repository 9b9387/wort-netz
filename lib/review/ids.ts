/**
 * Client-side identifiers for one review session and for each presentation of
 * a card. The server validates them as UUIDs and uses the card id to make a
 * retried submit idempotent, so the format has to be a real v4 string.
 */

export function createUuid(): string {
  const cryptoRef = globalThis.crypto;

  if (cryptoRef?.randomUUID) {
    return cryptoRef.randomUUID();
  }

  const bytes = new Uint8Array(16);

  if (cryptoRef?.getRandomValues) {
    cryptoRef.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}
