export interface GenerateOptions {
  text: string;
  model?: string;
  voice?: string;
  /** Natural language voice description (Max model only, max 300 chars) */
  voiceInstructions?: string;
  language?: string;
  format?: string;
  speed?: number;
  exaggeration?: number;
}

export interface DialogueLine {
  text: string;
  voice?: string;
  /** Natural language voice description (Max model only) */
  voiceInstructions?: string;
  language?: string;
  exaggeration?: number;
}

export interface DialogueOptions {
  model?: string;
  lines: DialogueLine[];
  gapMs?: number;
}

export interface AsyncGenerateOptions extends GenerateOptions {
  webhookUrl?: string;
}

export interface GenerateResult {
  audioUrl: string;
  model: string;
  voice: string;
  characters: number;
  costCents: number;
  /** Generated voice ID for reuse (Max model only) */
  generatedVoiceId?: string;
  /** Suggestion for better results */
  suggestion?: string;
  download: () => Promise<Buffer>;
  save: (path: string) => Promise<void>;
}

export interface Voice {
  voiceId: string;
  name: string;
  model?: string;
  language?: string;
  status?: string;
  description?: string;
  previewUrl?: string;
  unlockCostCents?: number;
}

export interface VoiceList {
  standardVoices: Voice[];
  proVoices: Voice[];
  clonedVoices: Voice[];
}

export interface Job {
  id: string;
  status: string;
  jobType?: string;
  estimatedSeconds?: number;
  audioUrl?: string;
  error?: string;
  result?: unknown;
}

export interface FileExtractResult {
  text: string;
  filename: string;
  charCount: number;
  truncated: boolean;
}

export interface Generation {
  id: string;
  audioUrl?: string;
  model?: string;
  voice?: string;
  characters?: number;
  costCents?: number;
  createdAt?: string;
}

export interface GenerationList {
  generations: Generation[];
  total: number;
}

export interface AccountBalance {
  balanceCents: number;
  totalSpentCents: number;
}

export interface AccountUsage {
  entries: Record<string, unknown>[];
}

export interface VoiceDesign {
  id: string;
  name: string;
  status?: string;
  costCents?: number;
}

export interface VoiceOverOptions {
  /** Audio file path, Buffer, or ReadableStream. */
  file: string | Buffer | ReadableStream<Uint8Array>;
  /** Filename hint when file is Buffer/stream. */
  filename?: string;
  /** Map speaker labels to voice IDs. e.g. {"Speaker 1": "narrator_warm_male"} */
  voiceMap?: Record<string, string>;
  /** Default voice for unmapped speakers. Default: "narrator_warm_male" */
  defaultVoice?: string;
  /** TTS model for re-voicing. Default: "pro" */
  model?: string;
  /** Silence gap between lines in ms. Default: 500 */
  gapMs?: number;
  /** STT features. Default: ["transcript", "diarization"] */
  features?: string[];
  /** Language hint for transcription. */
  language?: string;
  /** Expected number of speakers. */
  numSpeakers?: number;
}

export interface VoiceOverResult {
  /** Transcription result with segments and speakers. */
  transcription: import("./resources/audio.js").TranscribeResult;
  /** Re-voiced dialogue audio result. */
  audio: GenerateResult;
  /** Voice mapping used. */
  voiceMap: Record<string, string>;
}

export interface LeanvoxOptions {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  autoAsyncThreshold?: number;
}
