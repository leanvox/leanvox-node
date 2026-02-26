import type { HTTPClient } from "../http.js";
import type { Generation, GenerationList } from "../types.js";

interface RawGeneration {
  id: string;
  audio_url?: string;
  model?: string;
  voice?: string;
  characters?: number;
  cost_cents?: number;
  created_at?: string;
}

interface RawGenerationList {
  generations: RawGeneration[];
  total: number;
}

function mapGeneration(raw: RawGeneration): Generation {
  return {
    id: raw.id,
    audioUrl: raw.audio_url,
    model: raw.model,
    voice: raw.voice,
    characters: raw.characters,
    costCents: raw.cost_cents,
    createdAt: raw.created_at,
  };
}

export class GenerationsResource {
  constructor(private http: HTTPClient) {}

  async list(options?: { limit?: number; offset?: number }): Promise<GenerationList> {
    const params: Record<string, number> = {};
    if (options?.limit !== undefined) params["limit"] = options.limit;
    if (options?.offset !== undefined) params["offset"] = options.offset;

    const raw = await this.http.request<RawGenerationList>("GET", "/v1/generations", { params });
    return {
      generations: raw.generations.map(mapGeneration),
      total: raw.total,
    };
  }

  async getAudio(generationId: string): Promise<Generation> {
    const raw = await this.http.request<RawGeneration>("GET", `/v1/generations/${generationId}/audio`);
    return mapGeneration(raw);
  }

  async delete(generationId: string): Promise<void> {
    await this.http.request("DELETE", `/v1/generations/${generationId}`);
  }
}
