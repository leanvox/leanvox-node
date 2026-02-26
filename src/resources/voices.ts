import type { HTTPClient } from "../http.js";
import type { Voice, VoiceList, VoiceDesign } from "../types.js";

interface RawVoice {
  voice_id: string;
  name: string;
  model?: string;
  language?: string;
  status?: string;
  description?: string;
  preview_url?: string;
  unlock_cost_cents?: number;
}

interface RawVoiceList {
  standard_voices: RawVoice[];
  pro_voices: RawVoice[];
  cloned_voices: RawVoice[];
}

interface RawVoiceDesign {
  id: string;
  name: string;
  status?: string;
  cost_cents?: number;
}

function mapVoice(raw: RawVoice): Voice {
  return {
    voiceId: raw.voice_id,
    name: raw.name,
    model: raw.model,
    language: raw.language,
    status: raw.status,
    description: raw.description,
    previewUrl: raw.preview_url,
    unlockCostCents: raw.unlock_cost_cents,
  };
}

function mapDesign(raw: RawVoiceDesign): VoiceDesign {
  return {
    id: raw.id,
    name: raw.name,
    status: raw.status,
    costCents: raw.cost_cents,
  };
}

export class VoicesResource {
  constructor(private http: HTTPClient) {}

  async list(model?: string): Promise<VoiceList> {
    const params: Record<string, string> = {};
    if (model) params["model"] = model;
    const raw = await this.http.request<RawVoiceList>("GET", "/v1/voices", { params });
    return {
      standardVoices: (raw.standard_voices ?? []).map(mapVoice),
      proVoices: (raw.pro_voices ?? []).map(mapVoice),
      clonedVoices: (raw.cloned_voices ?? []).map(mapVoice),
    };
  }

  async listCurated(): Promise<Voice[]> {
    const raw = await this.http.request<RawVoice[]>("GET", "/v1/voices/curated");
    return raw.map(mapVoice);
  }

  async clone(options: {
    name: string;
    audio: Blob | Buffer | string;
    description?: string;
    autoUnlock?: boolean;
  }): Promise<Voice> {
    const formData = new FormData();
    formData.set("name", options.name);
    if (options.description) formData.set("description", options.description);
    if (options.autoUnlock) formData.set("auto_unlock", "true");

    if (typeof options.audio === "string") {
      formData.set("audio_base64", options.audio);
    } else {
      const blob =
        options.audio instanceof Blob
          ? options.audio
          : new Blob([new Uint8Array(options.audio as Buffer)]);
      formData.set("audio", blob, "audio.wav");
    }

    const raw = await this.http.upload<RawVoice>("/v1/voices/clone", formData);
    return mapVoice(raw);
  }

  async unlock(voiceId: string): Promise<Record<string, unknown>> {
    return this.http.request("POST", `/v1/voices/${voiceId}/unlock`);
  }

  async design(options: {
    name: string;
    prompt: string;
    language?: string;
    description?: string;
  }): Promise<VoiceDesign> {
    const raw = await this.http.request<RawVoiceDesign>("POST", "/v1/voices/design", {
      body: {
        name: options.name,
        prompt: options.prompt,
        language: options.language ?? "",
        description: options.description ?? "",
      },
    });
    return mapDesign(raw);
  }

  async listDesigns(): Promise<VoiceDesign[]> {
    const raw = await this.http.request<RawVoiceDesign[]>("GET", "/v1/voices/designs");
    return raw.map(mapDesign);
  }

  async delete(voiceId: string): Promise<void> {
    await this.http.request("DELETE", `/v1/voices/${voiceId}`);
  }
}
