import { writeFileSync } from "node:fs";
import { resolveApiKey, ensureApiKey } from "./auth.js";
import { HTTPClient } from "./http.js";
import { InvalidRequestError, StreamingFormatError } from "./errors.js";
import { VoicesResource } from "./resources/voices.js";
import { FilesResource } from "./resources/files.js";
import { GenerationsResource } from "./resources/generations.js";
import { AccountResource } from "./resources/account.js";
import type {
  LeanvoxOptions,
  GenerateOptions,
  DialogueOptions,
  AsyncGenerateOptions,
  GenerateResult,
  Job,
} from "./types.js";

const DEFAULT_BASE_URL = "https://api.leanvox.com";
const DEFAULT_TIMEOUT = 30;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_AUTO_ASYNC_THRESHOLD = 5000;
const ASYNC_POLL_INTERVAL = 2000;

interface RawGenerateResult {
  audio_url: string;
  model: string;
  voice: string;
  characters: number;
  cost_cents: number;
  generated_voice_id?: string;
  suggestion?: string;
}

interface RawJob {
  id: string;
  status: string;
  estimated_seconds?: number;
  audio_url?: string;
  error?: string;
}

function mapJob(raw: RawJob): Job {
  return {
    id: raw.id,
    status: raw.status,
    estimatedSeconds: raw.estimated_seconds,
    audioUrl: raw.audio_url,
    error: raw.error,
  };
}

function validateGenerateParams(options: GenerateOptions): void {
  if (!options.text || options.text.length === 0) {
    throw new InvalidRequestError("text is required and cannot be empty");
  }
  if (options.text.length > 10_000) {
    throw new InvalidRequestError("text must be 10,000 characters or fewer");
  }
  const model = options.model ?? "standard";
  if (model !== "standard" && model !== "pro" && model !== "max") {
    throw new InvalidRequestError('model must be "standard", "pro", or "max"');
  }
  if (options.speed !== undefined && (options.speed < 0.5 || options.speed > 2.0)) {
    throw new InvalidRequestError("speed must be between 0.5 and 2.0");
  }
  if (options.exaggeration !== undefined && options.exaggeration !== 0.5 && model === "standard") {
    throw new InvalidRequestError("exaggeration is only supported on the pro model");
  }
  if (options.format !== undefined) {
    const fmt = options.format.toLowerCase();
    if (fmt !== "mp3" && fmt !== "wav") {
      throw new InvalidRequestError('format must be "mp3" or "wav"');
    }
  }
}

function buildGenerateBody(options: GenerateOptions): Record<string, unknown> {
  const body: Record<string, unknown> = { text: options.text };
  const model = options.model ?? "standard";
  body["model"] = model;

  if (model === "max") {
    if (!options.voiceInstructions) {
      throw new InvalidRequestError(
        'voice_instructions is required when model is "max". ' +
        'Example: voiceInstructions: "A warm, confident female narrator"'
      );
    }
    if (options.voiceInstructions.length > 300) {
      throw new InvalidRequestError(
        `voiceInstructions must be 300 characters or less (got ${options.voiceInstructions.length})`
      );
    }
    if (options.voice) {
      throw new InvalidRequestError(
        "voice and voiceInstructions are mutually exclusive"
      );
    }
    body["voice_instructions"] = options.voiceInstructions;
  } else {
    if (options.voiceInstructions) {
      throw new InvalidRequestError(
        `voiceInstructions is only supported with model "max", not "${model}"`
      );
    }
    if (options.voice) body["voice"] = options.voice;
  }

  if (options.language) body["language"] = options.language;
  if (options.format) body["format"] = options.format;
  if (options.speed !== undefined) body["speed"] = options.speed;
  if (model === "pro" && options.exaggeration !== undefined) {
    body["exaggeration"] = options.exaggeration;
  }
  return body;
}

export class Leanvox {
  private http: HTTPClient;
  private autoAsyncThreshold: number;

  readonly voices: VoicesResource;
  readonly files: FilesResource;
  readonly generations: GenerationsResource;
  readonly account: AccountResource;

  constructor(options: LeanvoxOptions = {}) {
    const apiKey = ensureApiKey(resolveApiKey(options.apiKey));
    const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    const timeout = options.timeout ?? DEFAULT_TIMEOUT;
    const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.autoAsyncThreshold = options.autoAsyncThreshold ?? DEFAULT_AUTO_ASYNC_THRESHOLD;

    this.http = new HTTPClient({ baseUrl, apiKey, timeout, maxRetries });

    this.voices = new VoicesResource(this.http);
    this.files = new FilesResource(this.http);
    this.generations = new GenerationsResource(this.http);
    this.account = new AccountResource(this.http);
  }

  private makeResult(raw: RawGenerateResult): GenerateResult {
    return {
      audioUrl: raw.audio_url,
      model: raw.model,
      voice: raw.voice,
      characters: raw.characters,
      costCents: raw.cost_cents,
      generatedVoiceId: raw.generated_voice_id,
      suggestion: raw.suggestion,
      download: async () => {
        const response = await fetch(raw.audio_url);
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
      },
      save: async (path: string) => {
        const response = await fetch(raw.audio_url);
        const arrayBuffer = await response.arrayBuffer();
        writeFileSync(path, Buffer.from(arrayBuffer));
      },
    };
  }

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    validateGenerateParams(options);

    if (options.text.length > this.autoAsyncThreshold) {
      return this.generateAsyncAndPoll(options);
    }

    const body = buildGenerateBody(options);
    const raw = await this.http.request<RawGenerateResult>("POST", "/v1/tts/generate", { body });
    return this.makeResult(raw);
  }

  async stream(options: GenerateOptions): Promise<ReadableStream<Uint8Array>> {
    validateGenerateParams(options);

    const format = (options.format ?? "mp3").toLowerCase();
    if (format !== "mp3") {
      throw new StreamingFormatError();
    }

    const body = buildGenerateBody(options);
    const { stream } = await this.http.requestStream("POST", "/v1/tts/stream", { body });
    return stream;
  }

  async dialogue(options: DialogueOptions): Promise<GenerateResult> {
    if (!options.lines || options.lines.length < 2) {
      throw new InvalidRequestError("dialogue requires at least 2 lines");
    }

    const model = options.model ?? "pro";
    if (model !== "standard" && model !== "pro" && model !== "max") {
      throw new InvalidRequestError('model must be "standard", "pro", or "max"');
    }

    const body = {
      model,
      lines: options.lines.map((line) => ({
        text: line.text,
        ...(line.voice ? { voice: line.voice } : {}),
        ...(line.voiceInstructions ? { voice_instructions: line.voiceInstructions } : {}),
        language: line.language ?? "en",
        ...(model === "pro" && line.exaggeration !== undefined ? { exaggeration: line.exaggeration } : {}),
      })),
      gap_ms: options.gapMs ?? 500,
    };

    const raw = await this.http.request<RawGenerateResult>("POST", "/v1/tts/dialogue", { body });
    return this.makeResult(raw);
  }

  async generateAsync(options: AsyncGenerateOptions): Promise<Job> {
    validateGenerateParams(options);
    const body: Record<string, unknown> = buildGenerateBody(options);
    if (options.webhookUrl) body["webhook_url"] = options.webhookUrl;

    const raw = await this.http.request<RawJob>("POST", "/v1/tts/generate-async", { body });
    return mapJob(raw);
  }

  async getJob(jobId: string): Promise<Job> {
    const raw = await this.http.request<RawJob>("GET", `/v1/jobs/${jobId}`);
    return mapJob(raw);
  }

  async listJobs(): Promise<Job[]> {
    const raw = await this.http.request<RawJob[]>("GET", "/v1/jobs");
    return raw.map(mapJob);
  }

  private async generateAsyncAndPoll(options: GenerateOptions): Promise<GenerateResult> {
    const job = await this.generateAsync(options);
    let current = job;

    while (current.status !== "completed" && current.status !== "failed") {
      await new Promise((resolve) => setTimeout(resolve, ASYNC_POLL_INTERVAL));
      current = await this.getJob(current.id);
    }

    if (current.status === "failed") {
      throw new InvalidRequestError(current.error ?? "Async job failed");
    }

    return this.makeResult({
      audio_url: current.audioUrl ?? "",
      model: options.model ?? "standard",
      voice: options.voice ?? "",
      characters: options.text.length,
      cost_cents: 0,
    });
  }
}
