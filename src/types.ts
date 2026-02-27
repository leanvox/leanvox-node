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
  estimatedSeconds?: number;
  audioUrl?: string;
  error?: string;
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

export interface LeanvoxOptions {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  autoAsyncThreshold?: number;
}
