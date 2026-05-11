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
  /** Schedule as a background STT job even for short files. */
  forceAsync?: boolean;
  /** Poll scheduled jobs until complete. Default true. */
  wait?: boolean;
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

interface TranscriptionJobResponse {
  id?: string;
  job_id?: string;
  job_type?: string;
  status: "pending" | "processing" | "completed" | "failed";
  poll_url?: string;
  message?: string;
  result?: TranscribeResult;
  error_message?: string;
}

export interface TranscriptionJob {
  id: string;
  jobType: string;
  status: string;
  pollUrl?: string;
  message?: string;
  result?: TranscribeResult;
  error?: string;
}

export class AudioResource {
  constructor(private http: HTTPClient) {}

  /**
   * Transcribe an audio file with optional diarization and summarization.
   */
  async transcribe(options: TranscribeOptions): Promise<TranscribeResult | TranscriptionJob> {
    const formData = new FormData();

    // Handle file input
    if (typeof options.file === "string") {
      // File path
      const buffer = readFileSync(options.file);
      const filename = basename(options.file);
      formData.append("file", new Blob([new Uint8Array(buffer)]), filename);
    } else if (Buffer.isBuffer(options.file)) {
      const filename = options.filename ?? "audio.wav";
      formData.append("file", new Blob([new Uint8Array(options.file)]), filename);
    } else {
      // ReadableStream — collect into single buffer
      const reader = options.file.getReader();
      const chunks: Uint8Array[] = [];
      let totalLen = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = new Uint8Array(value);
        chunks.push(chunk);
        totalLen += chunk.length;
      }
      const merged = new Uint8Array(totalLen);
      let offset = 0;
      for (const c of chunks) {
        merged.set(c, offset);
        offset += c.length;
      }
      formData.append("file", new Blob([merged]), options.filename ?? "audio.wav");
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
    if (options.forceAsync) {
      formData.append("force_async", "true");
    }

    const response = await this.http.uploadRaw<TranscribeResult | TranscriptionJobResponse>(
      "/v1/audio/transcribe",
      formData,
      600_000, // 10 min timeout
    );

    // If status is 200, return result directly
    if (response.status === 200) {
      return response.data as TranscribeResult;
    }

    // If status is 202, poll for completion
    if (response.status === 202) {
      const jobResponse = response.data as TranscriptionJobResponse;
      const job = this.mapTranscriptionJob(jobResponse);
      return options.wait === false ? job : this.waitForTranscription(job.id);
    }

    // Should not reach here due to error handling in uploadRaw
    throw new Error(`Unexpected response status: ${response.status}`);
  }

  /**
   * Schedule an async transcription job and return immediately.
   */
  async transcribeAsync(options: Omit<TranscribeOptions, "forceAsync" | "wait">): Promise<TranscriptionJob> {
    const result = await this.transcribe({ ...options, forceAsync: true, wait: false });
    return result as TranscriptionJob;
  }

  /**
   * Poll for transcription job completion.
   */
  async waitForTranscription(jobId: string, options?: { timeoutMs?: number; pollIntervalMs?: number }): Promise<TranscribeResult> {
    const pollInterval = 3000; // 3 seconds
    const maxPollTime = options?.timeoutMs ?? 1_800_000; // 30 minutes
    const startTime = Date.now();

    while (true) {
      // Check if we've exceeded max poll time
      if (Date.now() - startTime > maxPollTime) {
        throw new Error(`Transcription job ${jobId} timed out after ${maxPollTime}ms`);
      }

      // Poll the job status
      const jobResponse = await this.http.request<TranscriptionJobResponse>("GET", `/v1/jobs/${jobId}`);

      if (jobResponse.status === "completed") {
        if (!jobResponse.result) {
          throw new Error(`Transcription job ${jobId} completed but no result returned`);
        }
        return jobResponse.result;
      }

      if (jobResponse.status === "failed") {
        throw new Error(
          `Transcription job ${jobId} failed: ${jobResponse.error_message ?? "Unknown error"}`,
        );
      }

      // Status is pending or processing, wait before polling again
      await new Promise((resolve) => setTimeout(resolve, options?.pollIntervalMs ?? pollInterval));
    }
  }

  private mapTranscriptionJob(raw: TranscriptionJobResponse): TranscriptionJob {
    return {
      id: raw.job_id ?? raw.id ?? "",
      jobType: raw.job_type ?? "stt",
      status: raw.status,
      pollUrl: raw.poll_url,
      message: raw.message,
      result: raw.result,
      error: raw.error_message,
    };
  }
}
