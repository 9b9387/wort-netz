import "server-only";

const DEFAULT_TIMEOUT_MS = 12_000;
const MAX_ATTEMPTS = 2;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  headers?: HeadersInit,
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "text/html, application/json",
          "User-Agent": "WortNetz/0.1 (+https://wortnetz.example)",
          ...headers,
        },
        signal: controller.signal,
        cache: "no-store",
      });

      if (!response.ok) {
        const retryable =
          response.status === 429 || response.status >= 500;

        if (retryable && attempt < MAX_ATTEMPTS) {
          lastError = new Error(`HTTP request failed with ${response.status}`);
          await sleep(350 * attempt);
          continue;
        }

        throw new Error(`HTTP request failed with ${response.status}`);
      }

      return response;
    } catch (error) {
      lastError = error;

      if (attempt < MAX_ATTEMPTS) {
        await sleep(350 * attempt);
        continue;
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("HTTP request failed");
}

export async function fetchJson<T>(
  url: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  headers?: HeadersInit,
): Promise<T> {
  const response = await fetchWithRetry(url, timeoutMs, headers);
  return (await response.json()) as T;
}

export async function fetchText(
  url: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  headers?: HeadersInit,
): Promise<string> {
  const response = await fetchWithRetry(url, timeoutMs, headers);
  return response.text();
}
