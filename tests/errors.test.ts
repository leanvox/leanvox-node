import { describe, it, expect } from "vitest";
import {
  LeanvoxError,
  InvalidRequestError,
  AuthenticationError,
  InsufficientBalanceError,
  NotFoundError,
  RateLimitError,
  ServerError,
  StreamingFormatError,
  raiseForStatus,
} from "../src/errors.js";

describe("errors", () => {
  describe("error classes", () => {
    it("LeanvoxError has correct properties", () => {
      const err = new LeanvoxError("test", "test_code", 500, { detail: "x" });
      expect(err.message).toBe("test");
      expect(err.code).toBe("test_code");
      expect(err.statusCode).toBe(500);
      expect(err.body).toEqual({ detail: "x" });
      expect(err.name).toBe("LeanvoxError");
      expect(err instanceof Error).toBe(true);
    });

    it("InvalidRequestError defaults to 400", () => {
      const err = new InvalidRequestError("bad input");
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe("invalid_request");
      expect(err instanceof LeanvoxError).toBe(true);
    });

    it("AuthenticationError defaults to 401", () => {
      const err = new AuthenticationError("bad key");
      expect(err.statusCode).toBe(401);
      expect(err.code).toBe("invalid_api_key");
    });

    it("InsufficientBalanceError carries balance", () => {
      const err = new InsufficientBalanceError("low funds", "insufficient_balance", {}, 42);
      expect(err.statusCode).toBe(402);
      expect(err.balanceCents).toBe(42);
    });

    it("NotFoundError defaults to 404", () => {
      const err = new NotFoundError("missing");
      expect(err.statusCode).toBe(404);
    });

    it("RateLimitError carries retryAfter", () => {
      const err = new RateLimitError("slow down", "rate_limit_exceeded", {}, 30);
      expect(err.statusCode).toBe(429);
      expect(err.retryAfter).toBe(30);
    });

    it("ServerError defaults to 500", () => {
      const err = new ServerError("broken");
      expect(err.statusCode).toBe(500);
    });

    it("StreamingFormatError extends InvalidRequestError", () => {
      const err = new StreamingFormatError();
      expect(err instanceof InvalidRequestError).toBe(true);
      expect(err instanceof LeanvoxError).toBe(true);
      expect(err.message).toContain("MP3");
    });
  });

  describe("raiseForStatus", () => {
    it("throws InvalidRequestError for 400", () => {
      expect(() =>
        raiseForStatus(400, { error: { message: "bad", code: "invalid_request" } }),
      ).toThrow(InvalidRequestError);
    });

    it("throws AuthenticationError for 401", () => {
      expect(() =>
        raiseForStatus(401, { error: { message: "unauth", code: "invalid_api_key" } }),
      ).toThrow(AuthenticationError);
    });

    it("throws InsufficientBalanceError for 402 with balance", () => {
      try {
        raiseForStatus(402, {
          error: { message: "low", code: "insufficient_balance", balance_cents: 100 },
        });
      } catch (e) {
        expect(e).toBeInstanceOf(InsufficientBalanceError);
        expect((e as InsufficientBalanceError).balanceCents).toBe(100);
      }
    });

    it("throws NotFoundError for 404", () => {
      expect(() =>
        raiseForStatus(404, { error: { message: "gone", code: "not_found" } }),
      ).toThrow(NotFoundError);
    });

    it("throws RateLimitError for 429 with retry_after", () => {
      try {
        raiseForStatus(429, {
          error: { message: "too fast", code: "rate_limit_exceeded", retry_after: 60 },
        });
      } catch (e) {
        expect(e).toBeInstanceOf(RateLimitError);
        expect((e as RateLimitError).retryAfter).toBe(60);
      }
    });

    it("throws ServerError for 500", () => {
      expect(() =>
        raiseForStatus(500, { error: { message: "internal", code: "server_error" } }),
      ).toThrow(ServerError);
    });

    it("throws LeanvoxError for unknown status", () => {
      expect(() => raiseForStatus(418, { error: { message: "teapot" } })).toThrow(LeanvoxError);
    });

    it("handles missing error body gracefully", () => {
      expect(() => raiseForStatus(400, {})).toThrow(InvalidRequestError);
    });
  });
});
