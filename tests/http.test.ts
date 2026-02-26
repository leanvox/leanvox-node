import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HTTPClient } from "../src/http.js";
import {
  InvalidRequestError,
  ServerError,
  RateLimitError,
  LeanvoxError,
} from "../src/errors.js";

function createClient(overrides?: Partial<{ maxRetries: number; timeout: number }>) {
  return new HTTPClient({
    baseUrl: "https://api.test.com",
    apiKey: "lv_test_abc",
    timeout: overrides?.timeout ?? 30,
    maxRetries: overrides?.maxRetries ?? 2,
  });
}

describe("HTTPClient", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("request", () => {
    it("sends correct headers", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
        headers: new Headers(),
      });
      globalThis.fetch = fetchMock;

      const client = createClient();
      await client.request("GET", "/v1/test");

      const opts = fetchMock.mock.calls[0][1] as RequestInit;
      const headers = opts.headers as Record<string, string>;
      expect(headers["Authorization"]).toBe("Bearer lv_test_abc");
      expect(headers["Content-Type"]).toBe("application/json");
      expect(headers["User-Agent"]).toContain("leanvox-node/");
    });

    it("appends query params", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
        headers: new Headers(),
      });
      globalThis.fetch = fetchMock;

      const client = createClient();
      await client.request("GET", "/v1/test", { params: { foo: "bar", num: 42 } });

      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain("foo=bar");
      expect(url).toContain("num=42");
    });

    it("handles 204 No Content", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        headers: new Headers(),
      });

      const client = createClient();
      const result = await client.request("DELETE", "/v1/test");
      expect(result).toBeUndefined();
    });

    it("throws InvalidRequestError on 400", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: "bad request", code: "invalid_request" } }),
        headers: new Headers({ "Content-Type": "application/json" }),
      });

      const client = createClient({ maxRetries: 0 });
      await expect(client.request("POST", "/v1/test")).rejects.toThrow(InvalidRequestError);
    });
  });

  describe("retry logic", () => {
    it("retries on 500 with exponential backoff", async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: { message: "server error" } }),
          headers: new Headers(),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: { message: "server error" } }),
          headers: new Headers(),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ success: true }),
          headers: new Headers(),
        });
      globalThis.fetch = fetchMock;

      const client = createClient({ maxRetries: 2 });
      const result = await client.request<{ success: boolean }>("GET", "/v1/test");
      expect(result.success).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("retries on 429", async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: async () => ({ error: { message: "rate limited" } }),
          headers: new Headers({ "Retry-After": "0.01" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
          headers: new Headers(),
        });
      globalThis.fetch = fetchMock;

      const client = createClient({ maxRetries: 1 });
      const result = await client.request<{ ok: boolean }>("GET", "/v1/test");
      expect(result.ok).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("does not retry on 400", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: "bad" } }),
        headers: new Headers(),
      });
      globalThis.fetch = fetchMock;

      const client = createClient({ maxRetries: 2 });
      await expect(client.request("POST", "/v1/test")).rejects.toThrow(InvalidRequestError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("exhausts retries and throws ServerError", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: { message: "server error", code: "server_error" } }),
        headers: new Headers(),
      });
      globalThis.fetch = fetchMock;

      const client = createClient({ maxRetries: 2 });
      await expect(client.request("GET", "/v1/test")).rejects.toThrow(ServerError);
      expect(fetchMock).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });

    it("retries on network error", async () => {
      const fetchMock = vi.fn()
        .mockRejectedValueOnce(new Error("ECONNREFUSED"))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
          headers: new Headers(),
        });
      globalThis.fetch = fetchMock;

      const client = createClient({ maxRetries: 1 });
      const result = await client.request<{ ok: boolean }>("GET", "/v1/test");
      expect(result.ok).toBe(true);
    });

    it("throws network error after exhausting retries", async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
      globalThis.fetch = fetchMock;

      const client = createClient({ maxRetries: 1 });
      await expect(client.request("GET", "/v1/test")).rejects.toThrow(LeanvoxError);
      await expect(client.request("GET", "/v1/test")).rejects.toThrow(/Network error/);
    });
  });
});
