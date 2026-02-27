# Leanvox Node.js/TypeScript SDK

Official Node.js/TypeScript SDK for the [Leanvox](https://leanvox.com) text-to-speech API.

## Installation

```bash
npm install leanvox
```

Requires Node.js 18 or later.

## Quick Start

```typescript
import { Leanvox } from "leanvox";

const client = new Leanvox({ apiKey: "lv_live_..." });

const result = await client.generate({
  text: "Hello from Leanvox!",
  model: "standard",
  voice: "af_heart",
});

console.log(result.audioUrl);

// Download and save
await result.save("hello.mp3");
```

## Authentication

API keys are resolved in this order:

1. Constructor parameter: `new Leanvox({ apiKey: "lv_live_..." })`
2. Environment variable: `LEANVOX_API_KEY`
3. Config file: `~/.lvox/config.toml`

```toml
# ~/.lvox/config.toml
api_key = "lv_live_..."
```

## Streaming

Stream audio as it's generated (MP3 only):

```typescript
import { createWriteStream } from "fs";

const stream = await client.stream({
  text: "Long narration text here...",
  model: "standard",
});

const writer = createWriteStream("output.mp3");
for await (const chunk of stream) {
  writer.write(chunk);
}
writer.end();
```

## Max (Instruction-Based Voice)

```typescript
const result = await client.generate({
  text: "Welcome to our podcast!",
  model: "max",
  voiceInstructions: "A warm, confident female narrator with a slight British accent",
});
console.log(result.generatedVoiceId); // Reuse for consistent voice
```

## Dialogue

Generate multi-speaker dialogue:

```typescript
const result = await client.dialogue({
  model: "pro",
  lines: [
    { text: "Welcome to the show!", voice: "narrator_warm_male", language: "en" },
    { text: "Thanks for having me.", voice: "assistant_pro_female", language: "en", exaggeration: 0.6 },
  ],
  gapMs: 500,
});
```

## Async Generation

For long text that takes time to process:

```typescript
const job = await client.generateAsync({
  text: "Very long text...",
  model: "standard",
  webhookUrl: "https://yourapp.com/webhook",
});

// Poll for completion
const result = await client.getJob(job.id);
```

Text longer than `autoAsyncThreshold` (default 5000 chars) is automatically routed to async when calling `generate()`.

## Voice Management

```typescript
// List voices
const voices = await client.voices.list("pro");
console.log(voices.proVoices);

// Curated voices
const curated = await client.voices.listCurated();

// Clone a voice
const voice = await client.voices.clone({
  name: "My Voice",
  audio: fs.readFileSync("reference.wav"),
  description: "My custom voice",
});

// Unlock cloned voice ($3.00)
await client.voices.unlock(voice.voiceId);

// Design a voice ($1.00)
const design = await client.voices.design({
  name: "Deep Narrator",
  prompt: "A deep, warm male voice with a gentle storytelling tone",
});

// Delete a voice
await client.voices.delete(voice.voiceId);
```

## Generation History

```typescript
const gens = await client.generations.list({ limit: 20, offset: 0 });
const audio = await client.generations.getAudio("generation_id");
await client.generations.delete("generation_id");
```

## Account & Billing

```typescript
const balance = await client.account.balance();
console.log(`Balance: ${balance.balanceCents} cents`);

const usage = await client.account.usage({ days: 30 });
const checkout = await client.account.buyCredits(2000);
```

## File Processing

Extract text from files (.txt, .epub):

```typescript
const result = await client.files.extractText(
  fs.readFileSync("book.epub"),
  "book.epub",
);
console.log(result.charCount, result.truncated);
```

## Error Handling

```typescript
import {
  LeanvoxError,
  InvalidRequestError,
  AuthenticationError,
  InsufficientBalanceError,
  RateLimitError,
  StreamingFormatError,
} from "leanvox";

try {
  const result = await client.generate({ text: "Hello" });
} catch (e) {
  if (e instanceof InsufficientBalanceError) {
    console.log(`Need more credits: balance=${e.balanceCents}`);
  } else if (e instanceof RateLimitError) {
    console.log(`Rate limited, retry after: ${e.retryAfter}`);
  } else if (e instanceof LeanvoxError) {
    console.log(`API error: ${e.code} - ${e.message}`);
  }
}
```

## Configuration

```typescript
const client = new Leanvox({
  apiKey: "lv_live_...",
  baseUrl: "https://api.leanvox.com", // default
  timeout: 30,                         // seconds, default 30
  maxRetries: 2,                       // default 2 (exponential backoff: 1s, 2s, 4s)
  autoAsyncThreshold: 5000,            // chars, default 5000
});
```

## License

MIT
