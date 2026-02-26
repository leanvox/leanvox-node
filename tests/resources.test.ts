import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Leanvox } from "../src/client.js";

const VALID_KEY = "lv_test_abc123";

function mockFetchOk(body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => body,
    headers: new Headers(),
  });
}

function mockFetch204() {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 204,
    headers: new Headers(),
  });
}

describe("resources", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("voices", () => {
    it("list returns VoiceList", async () => {
      globalThis.fetch = mockFetchOk({
        standard_voices: [{ voice_id: "v1", name: "Voice 1" }],
        pro_voices: [],
        cloned_voices: [],
      });

      const client = new Leanvox({ apiKey: VALID_KEY });
      const result = await client.voices.list();
      expect(result.standardVoices).toHaveLength(1);
      expect(result.standardVoices[0].voiceId).toBe("v1");
      expect(result.standardVoices[0].name).toBe("Voice 1");
    });

    it("listCurated returns Voice[]", async () => {
      globalThis.fetch = mockFetchOk([
        { voice_id: "c1", name: "Curated 1", preview_url: "https://cdn.test.com/c1.mp3" },
      ]);

      const client = new Leanvox({ apiKey: VALID_KEY });
      const result = await client.voices.listCurated();
      expect(result).toHaveLength(1);
      expect(result[0].previewUrl).toBe("https://cdn.test.com/c1.mp3");
    });

    it("delete calls correct endpoint", async () => {
      const fetchMock = mockFetch204();
      globalThis.fetch = fetchMock;

      const client = new Leanvox({ apiKey: VALID_KEY });
      await client.voices.delete("voice_123");

      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain("/v1/voices/voice_123");
      expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe("DELETE");
    });

    it("design sends correct body", async () => {
      const fetchMock = mockFetchOk({ id: "design_1", name: "Narrator", status: "ready", cost_cents: 100 });
      globalThis.fetch = fetchMock;

      const client = new Leanvox({ apiKey: VALID_KEY });
      const result = await client.voices.design({
        name: "Narrator",
        prompt: "A deep warm voice",
      });

      expect(result.id).toBe("design_1");
      expect(result.costCents).toBe(100);
      const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
      expect(body.name).toBe("Narrator");
      expect(body.prompt).toBe("A deep warm voice");
    });
  });

  describe("generations", () => {
    it("list returns GenerationList", async () => {
      globalThis.fetch = mockFetchOk({
        generations: [
          { id: "gen_1", audio_url: "https://cdn.test.com/g1.mp3", model: "standard", characters: 100, cost_cents: 1.0 },
        ],
        total: 1,
      });

      const client = new Leanvox({ apiKey: VALID_KEY });
      const result = await client.generations.list();
      expect(result.total).toBe(1);
      expect(result.generations[0].id).toBe("gen_1");
      expect(result.generations[0].audioUrl).toBe("https://cdn.test.com/g1.mp3");
    });

    it("getAudio returns Generation", async () => {
      globalThis.fetch = mockFetchOk({
        id: "gen_1",
        audio_url: "https://cdn.test.com/g1.mp3",
      });

      const client = new Leanvox({ apiKey: VALID_KEY });
      const result = await client.generations.getAudio("gen_1");
      expect(result.id).toBe("gen_1");
    });

    it("delete calls correct endpoint", async () => {
      const fetchMock = mockFetch204();
      globalThis.fetch = fetchMock;

      const client = new Leanvox({ apiKey: VALID_KEY });
      await client.generations.delete("gen_123");

      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain("/v1/generations/gen_123");
    });
  });

  describe("account", () => {
    it("balance returns AccountBalance", async () => {
      globalThis.fetch = mockFetchOk({ balance_cents: 5000, total_spent_cents: 2000 });

      const client = new Leanvox({ apiKey: VALID_KEY });
      const result = await client.account.balance();
      expect(result.balanceCents).toBe(5000);
      expect(result.totalSpentCents).toBe(2000);
    });

    it("usage returns AccountUsage", async () => {
      globalThis.fetch = mockFetchOk({ entries: [{ date: "2026-02-01", cost_cents: 100 }] });

      const client = new Leanvox({ apiKey: VALID_KEY });
      const result = await client.account.usage({ days: 7 });
      expect(result.entries).toHaveLength(1);
    });

    it("buyCredits sends correct amount", async () => {
      const fetchMock = mockFetchOk({ payment_url: "https://checkout.stripe.com/xxx" });
      globalThis.fetch = fetchMock;

      const client = new Leanvox({ apiKey: VALID_KEY });
      const result = await client.account.buyCredits(2000);
      expect((result as Record<string, unknown>).payment_url).toBe("https://checkout.stripe.com/xxx");

      const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
      expect(body.amount_cents).toBe(2000);
    });
  });
});
