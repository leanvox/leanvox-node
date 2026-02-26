import { raiseForStatus, LeanvoxError } from "./errors.js";

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const BACKOFF_SCHEDULE = [1000, 2000, 4000];
const SDK_VERSION = "0.1.0";

export interface HTTPClientOptions {
  baseUrl: string;
  apiKey: string;
  timeout: number;
  maxRetries: number;
}

export class HTTPClient {
  private baseUrl: string;
  private apiKey: string;
  private timeout: number;
  private maxRetries: number;

  constructor(options: HTTPClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.apiKey = options.apiKey;
    this.timeout = options.timeout;
    this.maxRetries = options.maxRetries;
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": `leanvox-node/${SDK_VERSION}`,
    };
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async request<T>(
    method: string,
    path: string,
    options?: { body?: unknown; params?: Record<string, string | number>; timeoutMs?: number },
  ): Promise<T> {
    const url = new URL(path, this.baseUrl);
    if (options?.params) {
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined && value !== "") {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const timeoutMs = options?.timeoutMs ?? this.timeout * 1000;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url.toString(), {
          method,
          headers: this.headers(),
          body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (response.ok) {
          if (response.status === 204) return undefined as T;
          return (await response.json()) as T;
        }

        if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < this.maxRetries) {
          const retryAfter = response.headers.get("Retry-After");
          const delay = retryAfter
            ? parseFloat(retryAfter) * 1000
            : (BACKOFF_SCHEDULE[attempt] ?? BACKOFF_SCHEDULE[BACKOFF_SCHEDULE.length - 1]!);
          await this.sleep(delay);
          continue;
        }

        let body: unknown;
        try {
          body = await response.json();
        } catch {
          body = { error: { message: response.statusText } };
        }
        raiseForStatus(response.status, body);
      } catch (err) {
        clearTimeout(timer);
        if (err instanceof LeanvoxError) throw err;

        if (attempt < this.maxRetries) {
          const delay = BACKOFF_SCHEDULE[attempt] ?? BACKOFF_SCHEDULE[BACKOFF_SCHEDULE.length - 1]!;
          await this.sleep(delay);
          continue;
        }
        throw new LeanvoxError(
          `Network error: ${err instanceof Error ? err.message : String(err)}`,
          "network_error",
          0,
        );
      }
    }

    throw new LeanvoxError("Max retries exceeded", "max_retries", 0);
  }

  async requestStream(
    method: string,
    path: string,
    options?: { body?: unknown; timeoutMs?: number },
  ): Promise<{ stream: ReadableStream<Uint8Array>; headers: Headers }> {
    const url = new URL(path, this.baseUrl);
    const timeoutMs = options?.timeoutMs ?? 120_000;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url.toString(), {
          method,
          headers: this.headers(),
          body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (response.ok && response.body) {
          return { stream: response.body, headers: response.headers };
        }

        if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < this.maxRetries) {
          const retryAfter = response.headers.get("Retry-After");
          const delay = retryAfter
            ? parseFloat(retryAfter) * 1000
            : (BACKOFF_SCHEDULE[attempt] ?? BACKOFF_SCHEDULE[BACKOFF_SCHEDULE.length - 1]!);
          await this.sleep(delay);
          continue;
        }

        let body: unknown;
        try {
          body = await response.json();
        } catch {
          body = { error: { message: response.statusText } };
        }
        raiseForStatus(response.status, body);
      } catch (err) {
        clearTimeout(timer);
        if (err instanceof LeanvoxError) throw err;

        if (attempt < this.maxRetries) {
          const delay = BACKOFF_SCHEDULE[attempt] ?? BACKOFF_SCHEDULE[BACKOFF_SCHEDULE.length - 1]!;
          await this.sleep(delay);
          continue;
        }
        throw new LeanvoxError(
          `Network error: ${err instanceof Error ? err.message : String(err)}`,
          "network_error",
          0,
        );
      }
    }

    throw new LeanvoxError("Max retries exceeded", "max_retries", 0);
  }

  async upload<T>(
    path: string,
    formData: FormData,
    timeoutMs?: number,
  ): Promise<T> {
    const url = new URL(path, this.baseUrl);
    const effectiveTimeout = timeoutMs ?? this.timeout * 1000;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), effectiveTimeout);

      try {
        const headers: Record<string, string> = {
          Authorization: `Bearer ${this.apiKey}`,
          "User-Agent": `leanvox-node/${SDK_VERSION}`,
        };

        const response = await fetch(url.toString(), {
          method: "POST",
          headers,
          body: formData,
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (response.ok) {
          return (await response.json()) as T;
        }

        if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < this.maxRetries) {
          const delay = BACKOFF_SCHEDULE[attempt] ?? BACKOFF_SCHEDULE[BACKOFF_SCHEDULE.length - 1]!;
          await this.sleep(delay);
          continue;
        }

        let body: unknown;
        try {
          body = await response.json();
        } catch {
          body = { error: { message: response.statusText } };
        }
        raiseForStatus(response.status, body);
      } catch (err) {
        clearTimeout(timer);
        if (err instanceof LeanvoxError) throw err;

        if (attempt < this.maxRetries) {
          const delay = BACKOFF_SCHEDULE[attempt] ?? BACKOFF_SCHEDULE[BACKOFF_SCHEDULE.length - 1]!;
          await this.sleep(delay);
          continue;
        }
        throw new LeanvoxError(
          `Network error: ${err instanceof Error ? err.message : String(err)}`,
          "network_error",
          0,
        );
      }
    }

    throw new LeanvoxError("Max retries exceeded", "max_retries", 0);
  }
}
