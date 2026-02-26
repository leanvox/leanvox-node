import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Leanvox } from "../src/client.js";
import {
  InvalidRequestError,
  StreamingFormatError,
  AuthenticationError,
} from "../src/errors.js";

const VALID_KEY = "lv_test_abc123";

function mockFetchOk(body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => body,
    headers: new Headers(),
  });
}

describe("Leanvox client", () => {
  let originalFetch: typeof globalThis.fetch;
  const originalEnv = process.env;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    process.env = { ...originalEnv };
    delete process.env["LEANVOX_API_KEY"];
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
  });

  describe("constructor", () => {
    it("creates client with valid api key", () => {
      const client = new Leanvox({ apiKey: VALID_KEY });
      expect(client).toBeDefined();
      expect(client.voices).toBeDefined();
      expect(client.files).toBeDefined();
      expect(client.generations).toBeDefined();
      expect(client.account).toBeDefined();
    });

    it("throws without api key", () => {
      expect(() => new Leanvox()).toThrow(AuthenticationError);
    });

    it("reads api key from env", () => {
      process.env["LEANVOX_API_KEY"] = VALID_KEY;
      const client = new Leanvox();
      expect(client).toBeDefined();
    });

    it("rejects invalid api key prefix", () => {
      expect(() => new Leanvox({ apiKey: "bad_key" })).toThrow(AuthenticationError);
    });
  });

  describe("generate()", () => {
    it("validates empty text", async () => {
      const client = new Leanvox({ apiKey: VALID_KEY });
      await expect(client.generate({ text: "" })).rejects.toThrow(InvalidRequestError);
      await expect(client.generate({ text: "" })).rejects.toThrow(/text is required/);
    });

    it("validates text length > 10000", async () => {
      const client = new Leanvox({ apiKey: VALID_KEY });
      await expect(client.generate({ text: "x".repeat(10001) })).rejects.toThrow(InvalidRequestError);
    });

    it("validates invalid model", async () => {
      const client = new Leanvox({ apiKey: VALID_KEY });
      await expect(client.generate({ text: "hi", model: "invalid" })).rejects.toThrow(InvalidRequestError);
    });

    it("validates speed range", async () => {
      const client = new Leanvox({ apiKey: VALID_KEY });
      await expect(client.generate({ text: "hi", speed: 0.1 })).rejects.toThrow(InvalidRequestError);
      await expect(client.generate({ text: "hi", speed: 3.0 })).rejects.toThrow(InvalidRequestError);
    });

    it("validates exaggeration on standard model", async () => {
      const client = new Leanvox({ apiKey: VALID_KEY });
      await expect(
        client.generate({ text: "hi", model: "standard", exaggeration: 0.8 }),
      ).rejects.toThrow(InvalidRequestError);
      await expect(
        client.generate({ text: "hi", model: "standard", exaggeration: 0.8 }),
      ).rejects.toThrow(/exaggeration.*pro/);
    });

    it("allows exaggeration on pro model", async () => {
      globalThis.fetch = mockFetchOk({
        audio_url: "https://cdn.leanvox.com/audio.mp3",
        model: "pro",
        voice: "af_heart",
        characters: 2,
        cost_cents: 0.5,
      });

      const client = new Leanvox({ apiKey: VALID_KEY });
      const result = await client.generate({ text: "hi", model: "pro", exaggeration: 0.8 });
      expect(result.audioUrl).toBe("https://cdn.leanvox.com/audio.mp3");
      expect(result.model).toBe("pro");
    });

    it("validates invalid format", async () => {
      const client = new Leanvox({ apiKey: VALID_KEY });
      await expect(client.generate({ text: "hi", format: "ogg" })).rejects.toThrow(InvalidRequestError);
    });

    it("returns GenerateResult with download/save methods", async () => {
      globalThis.fetch = mockFetchOk({
        audio_url: "https://cdn.leanvox.com/audio.mp3",
        model: "standard",
        voice: "af_heart",
        characters: 12,
        cost_cents: 1.0,
      });

      const client = new Leanvox({ apiKey: VALID_KEY });
      const result = await client.generate({ text: "Hello world!" });
      expect(result.audioUrl).toBe("https://cdn.leanvox.com/audio.mp3");
      expect(result.characters).toBe(12);
      expect(result.costCents).toBe(1.0);
      expect(typeof result.download).toBe("function");
      expect(typeof result.save).toBe("function");
    });

    it("sends correct request body", async () => {
      const fetchMock = mockFetchOk({
        audio_url: "https://cdn.leanvox.com/audio.mp3",
        model: "standard",
        voice: "af_heart",
        characters: 5,
        cost_cents: 0.5,
      });
      globalThis.fetch = fetchMock;

      const client = new Leanvox({ apiKey: VALID_KEY, baseUrl: "https://api.test.com" });
      await client.generate({
        text: "hello",
        model: "standard",
        voice: "af_heart",
        language: "en",
        format: "wav",
        speed: 1.5,
      });

      const call = fetchMock.mock.calls[0];
      const url = call[0] as string;
      const opts = call[1] as RequestInit;
      expect(url).toContain("/v1/tts/generate");
      const body = JSON.parse(opts.body as string);
      expect(body.text).toBe("hello");
      expect(body.model).toBe("standard");
      expect(body.voice).toBe("af_heart");
      expect(body.speed).toBe(1.5);
      expect(body.format).toBe("wav");
    });

    it("sends Authorization header", async () => {
      const fetchMock = mockFetchOk({
        audio_url: "u",
        model: "standard",
        voice: "v",
        characters: 1,
        cost_cents: 0,
      });
      globalThis.fetch = fetchMock;

      const client = new Leanvox({ apiKey: VALID_KEY });
      await client.generate({ text: "x" });

      const opts = fetchMock.mock.calls[0][1] as RequestInit;
      const headers = opts.headers as Record<string, string>;
      expect(headers["Authorization"]).toBe(`Bearer ${VALID_KEY}`);
    });
  });

  describe("stream()", () => {
    it("throws StreamingFormatError for non-MP3", async () => {
      const client = new Leanvox({ apiKey: VALID_KEY });
      await expect(client.stream({ text: "hi", format: "wav" })).rejects.toThrow(StreamingFormatError);
    });

    it("returns ReadableStream for MP3", async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
          controller.close();
        },
      });

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        body: mockStream,
        headers: new Headers(),
      });

      const client = new Leanvox({ apiKey: VALID_KEY });
      const stream = await client.stream({ text: "hello" });
      expect(stream).toBeInstanceOf(ReadableStream);
    });
  });

  describe("dialogue()", () => {
    it("requires at least 2 lines", async () => {
      const client = new Leanvox({ apiKey: VALID_KEY });
      await expect(
        client.dialogue({ lines: [{ text: "hi", voice: "emma" }] }),
      ).rejects.toThrow(InvalidRequestError);
      await expect(
        client.dialogue({ lines: [{ text: "hi", voice: "emma" }] }),
      ).rejects.toThrow(/at least 2 lines/);
    });

    it("sends correct dialogue body", async () => {
      const fetchMock = mockFetchOk({
        audio_url: "https://cdn.leanvox.com/dialogue.mp3",
        model: "pro",
        voice: "dialogue",
        characters: 30,
        cost_cents: 2.0,
      });
      globalThis.fetch = fetchMock;

      const client = new Leanvox({ apiKey: VALID_KEY });
      await client.dialogue({
        model: "pro",
        lines: [
          { text: "Hello!", voice: "emma" },
          { text: "Hi there!", voice: "james" },
        ],
        gapMs: 300,
      });

      const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
      expect(body.model).toBe("pro");
      expect(body.lines).toHaveLength(2);
      expect(body.gap_ms).toBe(300);
    });
  });

  describe("generateAsync()", () => {
    it("returns a Job", async () => {
      globalThis.fetch = mockFetchOk({
        id: "job_123",
        status: "pending",
        estimated_seconds: 10,
      });

      const client = new Leanvox({ apiKey: VALID_KEY });
      const job = await client.generateAsync({ text: "hello" });
      expect(job.id).toBe("job_123");
      expect(job.status).toBe("pending");
      expect(job.estimatedSeconds).toBe(10);
    });
  });

  describe("getJob()", () => {
    it("fetches job by id", async () => {
      globalThis.fetch = mockFetchOk({
        id: "job_123",
        status: "completed",
        audio_url: "https://cdn.leanvox.com/audio.mp3",
      });

      const client = new Leanvox({ apiKey: VALID_KEY });
      const job = await client.getJob("job_123");
      expect(job.id).toBe("job_123");
      expect(job.status).toBe("completed");
      expect(job.audioUrl).toBe("https://cdn.leanvox.com/audio.mp3");
    });
  });

  describe("listJobs()", () => {
    it("returns array of jobs", async () => {
      globalThis.fetch = mockFetchOk([
        { id: "job_1", status: "completed" },
        { id: "job_2", status: "pending" },
      ]);

      const client = new Leanvox({ apiKey: VALID_KEY });
      const jobs = await client.listJobs();
      expect(jobs).toHaveLength(2);
      expect(jobs[0].id).toBe("job_1");
    });
  });

  describe("auto-async threshold", () => {
    it("routes long text to async", async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ id: "job_auto", status: "pending", estimated_seconds: 5 }),
          headers: new Headers(),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            id: "job_auto",
            status: "completed",
            audio_url: "https://cdn.leanvox.com/long.mp3",
          }),
          headers: new Headers(),
        });
      globalThis.fetch = fetchMock;

      const client = new Leanvox({ apiKey: VALID_KEY, autoAsyncThreshold: 10 });
      const result = await client.generate({ text: "x".repeat(20) });
      expect(result.audioUrl).toBe("https://cdn.leanvox.com/long.mp3");

      // Should have called async endpoint then polled
      const firstUrl = fetchMock.mock.calls[0][0] as string;
      expect(firstUrl).toContain("generate-async");
    });
  });
});
