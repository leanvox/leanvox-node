import type { HTTPClient } from "../http.js";
import type { FileExtractResult } from "../types.js";

interface RawFileExtractResult {
  text: string;
  filename: string;
  char_count: number;
  truncated: boolean;
}

export class FilesResource {
  constructor(private http: HTTPClient) {}

  async extractText(file: Blob | Buffer, filename = "upload"): Promise<FileExtractResult> {
    const formData = new FormData();
    const blob = file instanceof Blob ? file : new Blob([new Uint8Array(file)]);
    formData.set("file", blob, filename);

    const raw = await this.http.upload<RawFileExtractResult>("/v1/files/extract-text", formData);
    return {
      text: raw.text,
      filename: raw.filename,
      charCount: raw.char_count,
      truncated: raw.truncated,
    };
  }
}
