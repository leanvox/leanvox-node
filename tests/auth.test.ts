import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { resolveApiKey, validateApiKey, ensureApiKey } from "../src/auth.js";
import { AuthenticationError } from "../src/errors.js";

describe("auth", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env["LEANVOX_API_KEY"];
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("resolveApiKey", () => {
    it("returns explicit key when provided", () => {
      process.env["LEANVOX_API_KEY"] = "lv_live_env_key";
      const key = resolveApiKey("lv_live_explicit");
      expect(key).toBe("lv_live_explicit");
    });

    it("falls back to env when no explicit key", () => {
      process.env["LEANVOX_API_KEY"] = "lv_live_env_key";
      const key = resolveApiKey();
      expect(key).toBe("lv_live_env_key");
    });

    it("returns undefined when no key source available", () => {
      const key = resolveApiKey();
      expect(key).toBeUndefined();
    });

    it("prefers explicit over env", () => {
      process.env["LEANVOX_API_KEY"] = "lv_live_from_env";
      const key = resolveApiKey("lv_live_from_arg");
      expect(key).toBe("lv_live_from_arg");
    });
  });

  describe("validateApiKey", () => {
    it("accepts lv_live_ prefix", () => {
      expect(() => validateApiKey("lv_live_abc123")).not.toThrow();
    });

    it("accepts lv_test_ prefix", () => {
      expect(() => validateApiKey("lv_test_abc123")).not.toThrow();
    });

    it("rejects empty key", () => {
      expect(() => validateApiKey("")).toThrow(AuthenticationError);
    });

    it("rejects invalid prefix", () => {
      expect(() => validateApiKey("sk_live_abc123")).toThrow(AuthenticationError);
      expect(() => validateApiKey("sk_live_abc123")).toThrow(/Invalid API key prefix/);
    });

    it("rejects random string", () => {
      expect(() => validateApiKey("random-key")).toThrow(AuthenticationError);
    });
  });

  describe("ensureApiKey", () => {
    it("returns valid key", () => {
      expect(ensureApiKey("lv_live_abc")).toBe("lv_live_abc");
    });

    it("throws on undefined", () => {
      expect(() => ensureApiKey(undefined)).toThrow(AuthenticationError);
      expect(() => ensureApiKey(undefined)).toThrow(/No API key found/);
    });

    it("throws on invalid prefix", () => {
      expect(() => ensureApiKey("bad_key")).toThrow(AuthenticationError);
    });
  });
});
