import { readFileSync } from "node:fs";
import { basename } from "node:path";
import type { HTTPClient } from "../http.js";

export interface TranscribeOptions {
  /** File path, Buffer, or ReadableStream of audio data. */
  file: string | Buffer | ReadableStream<Uint8Array>;
  /** Filename hint (used when file is Buffer/stream). */
  filename?: string;
  /** Language code (auto-detect if omitted). */
  language?: string;
  /** Features to enable. Default: ["transcript", "diarization"]. */
  features?: string[];
  /** Hint for expected number of speakers. */
  numSpeakers?: number;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  confidence?: number;
  speaker?: string;
}

export interface TranscriptData {
  text: string;
  segments: TranscriptSegment[];
}

export interface SpeakersData {
  count: number;
  labels: string[];
}

export interface SummaryData {
  text?: string;
  action_items: string[];
  topics: string[];
  error?: string;
}

export interface TranscribeUsage {
  duration_minutes: number;
  cost_cents: number;
  tier: string;
  balance_cents: number;
}

export interface TranscribeResult {
  id: string;
  duration_seconds: number;
  language: string;
  confidence: number;
  transcript: TranscriptData;
  formatted_transcript: string;
  speakers?: SpeakersData;
  summary?: SummaryData;
  usage?: TranscribeUsage;
}

export class AudioResource {
  constructor(private http: HTTPClient) {}

  /**
   * Transcribe an audio file with optional diarization and summarization.
   */
  async transcribe(options: TranscribeOptions): Promise<TranscribeResult> {
    const formData = new FormData();

    // Handle file input
    if (typeof options.file === "string") {
      // File path
      const buffer = readFileSync(options.file);
      const filename = basename(options.file);
      formData.append("file", new Blob([buffer]), filename);
    } else if (Buffer.isBuffer(options.file)) {
      const filename = options.filename ?? "audio.wav";
      formData.append("file", new Blob([options.file]), filename);
    } else {
      // ReadableStream — collect to blob
      const reader = options.file.getReader();
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const blob = new Blob(chunks);
      formData.append("file", blob, options.filename ?? "audio.wav");
    }

    if (options.language) {
      formData.append("language", options.language);
    }
    if (options.features) {
      formData.append("features", JSON.stringify(options.features));
    }
    if (options.numSpeakers !== undefined) {
      formData.append("num_speakers", String(options.numSpeakers));
    }

    return this.http.upload<TranscribeResult>(
      "/v1/audio/transcribe",
      formData,
      600_000, // 10 min timeout
    );
  }
}
