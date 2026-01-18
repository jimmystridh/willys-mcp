import { randomUUID } from "node:crypto";

// NewRelic tracking constants
const NEWRELIC_ACCOUNT_ID = "1154196";
const NEWRELIC_APP_ID = "772324203";

// Common headers
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
const SEC_CH_UA =
  '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"';

// Default fetch configuration
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 1000;

export interface TrackingHeaders {
  newrelic: string;
  traceparent: string;
  tracestate: string;
}

export interface CsrfTokenResponse {
  token?: string;
}

export interface FetchWithRetryOptions extends Omit<RequestInit, "signal"> {
  timeout?: number;
  maxRetries?: number;
  baseDelayMs?: number;
}

class FetchTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`);
    this.name = "FetchTimeoutError";
  }
}

class FetchRetryExhaustedError extends Error {
  readonly lastError: Error;
  readonly attempts: number;

  constructor(lastError: Error, attempts: number) {
    super(`Request failed after ${attempts} attempts: ${lastError.message}`);
    this.name = "FetchRetryExhaustedError";
    this.lastError = lastError;
    this.attempts = attempts;
  }
}

export { FetchTimeoutError, FetchRetryExhaustedError };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function calculateBackoffDelay(attempt: number, baseDelayMs: number): number {
  const exponentialDelay = baseDelayMs * 2 ** attempt;
  const jitter = exponentialDelay * (0.5 + Math.random() * 0.5);
  return Math.min(jitter, 30000);
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof FetchTimeoutError) return true;
  if (error instanceof TypeError) return true; // Network errors
  if (error instanceof Error && error.name === "AbortError") return true;
  return false;
}

function isRetryableStatus(status: number): boolean {
  return status >= 500 || status === 429;
}

/**
 * Fetch with timeout and exponential backoff retry logic.
 *
 * - Retries on: network errors, timeouts, 5xx errors, 429 (rate limit)
 * - Does NOT retry on: 4xx client errors (except 429)
 * - Uses exponential backoff with jitter
 */
export async function fetchWithRetry(
  url: string,
  options: FetchWithRetryOptions = {},
): Promise<Response> {
  const {
    timeout = DEFAULT_TIMEOUT_MS,
    maxRetries = DEFAULT_MAX_RETRIES,
    baseDelayMs = DEFAULT_BASE_DELAY_MS,
    ...fetchOptions
  } = options;

  let lastError: Error = new Error("No attempts made");

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      // Don't retry on client errors (except 429 rate limit)
      if (
        response.status >= 400 &&
        response.status < 500 &&
        response.status !== 429
      ) {
        return response;
      }

      // Success - return response
      if (response.ok) {
        return response;
      }

      // Retry on server errors (5xx) and rate limiting (429)
      if (isRetryableStatus(response.status)) {
        lastError = new Error(`Server error: ${response.status}`);

        if (attempt < maxRetries) {
          const delay = calculateBackoffDelay(attempt, baseDelayMs);
          console.log(
            `Retrying request to ${url} after ${Math.round(delay)}ms (attempt ${attempt + 1}/${maxRetries + 1}, status: ${response.status})`,
          );
          await sleep(delay);
          continue;
        }
      }

      // Non-retryable status, return as-is
      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      // Convert AbortError to timeout if it was our timeout
      if (error instanceof Error && error.name === "AbortError") {
        lastError = new FetchTimeoutError(timeout);
      } else if (error instanceof Error) {
        lastError = error;
      } else {
        lastError = new Error(String(error));
      }

      // Only retry on retryable errors
      if (isRetryableError(lastError) && attempt < maxRetries) {
        const delay = calculateBackoffDelay(attempt, baseDelayMs);
        console.log(
          `Retrying request to ${url} after ${Math.round(delay)}ms (attempt ${attempt + 1}/${maxRetries + 1}, error: ${lastError.message})`,
        );
        await sleep(delay);
        continue;
      }

      // Non-retryable error or exhausted retries
      if (attempt >= maxRetries) {
        throw new FetchRetryExhaustedError(lastError, attempt + 1);
      }
      throw lastError;
    }
  }

  throw new FetchRetryExhaustedError(lastError, maxRetries + 1);
}

/**
 * Generate NewRelic tracking headers for API requests.
 * Uses crypto.randomUUID for secure random IDs.
 */
export function generateTrackingHeaders(): TrackingHeaders {
  const traceId = randomUUID().replace(/-/g, "");
  const spanId = traceId.substring(0, 16);
  const timestamp = Date.now();

  const newrelicData = {
    v: [0, 1],
    d: {
      ty: "Browser",
      ac: NEWRELIC_ACCOUNT_ID,
      ap: NEWRELIC_APP_ID,
      id: spanId,
      tr: traceId,
      ti: timestamp,
    },
  };

  return {
    newrelic: btoa(JSON.stringify(newrelicData)),
    traceparent: `00-${traceId}-${spanId}-01`,
    tracestate: `${NEWRELIC_ACCOUNT_ID}@nr=0-1-${NEWRELIC_ACCOUNT_ID}-${NEWRELIC_APP_ID}-${spanId}----${timestamp}`,
  };
}

/**
 * Common headers for Willys API requests
 */
export function getCommonHeaders(cookies: string): Record<string, string> {
  return {
    accept: "*/*",
    "accept-language":
      "sv-SE,sv;q=0.9,en-US;q=0.8,en-SE;q=0.7,en-GB;q=0.6,en;q=0.5",
    "cache-control": "no-cache",
    "content-type": "application/json",
    cookie: cookies,
    pragma: "no-cache",
    priority: "u=1, i",
    "sec-ch-ua": SEC_CH_UA,
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "user-agent": USER_AGENT,
  };
}

/**
 * Get full headers including tracking for API requests
 */
export function getApiHeaders(
  cookies: string,
  csrfToken?: string,
): Record<string, string> {
  const tracking = generateTrackingHeaders();
  const headers: Record<string, string> = {
    ...getCommonHeaders(cookies),
    ...tracking,
  };

  if (csrfToken) {
    headers["x-csrf-token"] = csrfToken;
  }

  return headers;
}

/**
 * Fetch CSRF token from Willys API with retry logic
 */
export async function fetchCsrfToken(cookies: string): Promise<string> {
  const response = await fetchWithRetry(
    "https://www.willys.se/axfood/rest/csrf-token",
    {
      headers: getCommonHeaders(cookies),
      timeout: 15000,
      maxRetries: 2,
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to get CSRF token: ${response.status}`);
  }

  const data: string | CsrfTokenResponse = await response.json();
  return extractCsrfToken(data);
}

/**
 * Extract CSRF token from response (handles both string and object formats)
 */
export function extractCsrfToken(token: unknown): string {
  if (typeof token === "string") {
    return token;
  }
  if (token && typeof token === "object" && "token" in token) {
    const t = (token as CsrfTokenResponse).token;
    if (typeof t === "string") {
      return t;
    }
  }
  throw new Error("Invalid CSRF token format");
}

/**
 * Extract error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Truncate string for logging (avoids exposing full tokens/cookies)
 */
export function truncateForLog(str: string, length: number = 20): string {
  if (str.length <= length) {
    return str;
  }
  return `${str.substring(0, length)}...`;
}
