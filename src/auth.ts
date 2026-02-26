import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { AuthenticationError } from "./errors.js";

const VALID_PREFIXES = ["lv_live_", "lv_test_"];

function readConfigFile(): string | undefined {
  try {
    const configPath = join(homedir(), ".lvox", "config.toml");
    const content = readFileSync(configPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("api_key")) {
        const match = trimmed.match(/^api_key\s*=\s*["']?([^"'\s]+)["']?/);
        if (match) return match[1];
      }
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export function resolveApiKey(explicit?: string): string | undefined {
  if (explicit) return explicit;
  const envKey = process.env["LEANVOX_API_KEY"];
  if (envKey) return envKey;
  return readConfigFile();
}

export function validateApiKey(key: string): void {
  if (!key) {
    throw new AuthenticationError("API key is required", "invalid_api_key");
  }
  if (!VALID_PREFIXES.some((prefix) => key.startsWith(prefix))) {
    throw new AuthenticationError(
      `Invalid API key prefix. Key must start with one of: ${VALID_PREFIXES.join(", ")}`,
      "invalid_api_key",
    );
  }
}

export function ensureApiKey(key: string | undefined): string {
  if (!key) {
    throw new AuthenticationError(
      "No API key found. Pass apiKey to the constructor, set LEANVOX_API_KEY env var, or add to ~/.lvox/config.toml",
      "invalid_api_key",
    );
  }
  validateApiKey(key);
  return key;
}
