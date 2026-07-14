/**
 * Retry an async operation with exponential backoff + jitter.
 * Retries only on transient failures (network errors, HTTP 5xx / 429).
 */
export interface RetryOptions {
  retries?: number;         // total attempts = retries + 1
  baseMs?: number;          // initial delay
  maxMs?: number;           // cap for a single delay
  shouldRetry?: (err: unknown, attempt: number) => boolean;
  onRetry?: (err: unknown, attempt: number, delayMs: number) => void;
}

const TRANSIENT_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

/** Default: retry on network errors and typical transient status codes. */
export function isTransientError(err: unknown): boolean {
  if (!err) return false;
  const anyErr = err as any;
  const status = anyErr.status ?? anyErr.statusCode ?? anyErr.originalError?.status;
  if (typeof status === "number") return TRANSIENT_STATUSES.has(status);
  const msg = String(anyErr.message ?? anyErr).toLowerCase();
  return (
    msg.includes("serviceunavailable") ||
    msg.includes("service unavailable") ||
    msg.includes("timeout") ||
    msg.includes("network") ||
    msg.includes("failed to fetch") ||
    msg.includes("econnreset") ||
    msg.includes("temporarily")
  );
}

export async function retryWithBackoff<T>(
  fn: (attempt: number) => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const retries = opts.retries ?? 3;
  const base = opts.baseMs ?? 400;
  const cap = opts.maxMs ?? 5000;
  const should = opts.shouldRetry ?? ((e) => isTransientError(e));

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      if (attempt === retries || !should(err, attempt)) throw err;
      const jitter = Math.random() * base;
      const delay = Math.min(cap, base * 2 ** attempt) + jitter;
      opts.onRetry?.(err, attempt + 1, delay);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}
