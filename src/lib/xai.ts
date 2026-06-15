const BASE_URL = "https://api.x.ai/v1";
// Use the `-latest` aliases so we always track xAI's newest text + image models.
// Verified against GET /v1/language-models and /v1/image-generation-models:
//   grok-4.3-latest -> grok-4.3 (newest text model)
//   grok-imagine-image-quality-latest -> grok-imagine-image-quality (newest image model)
const TEXT_MODEL = "grok-4.3-latest";
const IMAGE_MODEL = "grok-imagine-image-quality-latest";

function apiKey(): string {
  const key = process.env.XAI_API_KEY;
  if (!key) throw new Error("XAI_API_KEY is not set. Add it to .env.local and restart.");
  return key;
}

type ImageResult = { dataUri?: string; url?: string };

function pickImage(json: unknown): ImageResult {
  const data = (json as { data?: Array<{ b64_json?: string; url?: string }> }).data;
  const first = data?.[0];
  if (!first) throw new Error("xAI returned no image");
  if (first.b64_json) return { dataUri: `data:image/jpeg;base64,${first.b64_json}` };
  if (first.url) return { url: first.url };
  throw new Error("xAI image response missing data");
}

async function post(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify(body),
    // Reasoning + image models can be slow.
    signal: AbortSignal.timeout(3600_000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`xAI ${path} failed (${res.status}): ${text.slice(0, 500)}`);
  }
  return res.json();
}

/** Text-to-image at max quality. */
export async function generateImage(prompt: string, aspectRatio: string): Promise<ImageResult> {
  const json = await post("/images/generations", {
    model: IMAGE_MODEL,
    prompt,
    aspect_ratio: aspectRatio,
    resolution: "2k",
    response_format: "b64_json",
  });
  return pickImage(json);
}

/**
 * Edit / compose using 1-3 source images (data URIs or public URLs).
 * Single image preserves the source aspect ratio; multi-image honours aspect_ratio.
 */
export async function editImage(
  prompt: string,
  sources: string[],
  aspectRatio: string
): Promise<ImageResult> {
  if (sources.length === 0) throw new Error("editImage requires at least one source image");
  const imgs = sources.slice(0, 3).map((url) => ({ type: "image_url", url }));
  const body: Record<string, unknown> = {
    model: IMAGE_MODEL,
    prompt,
    response_format: "b64_json",
  };
  if (imgs.length === 1) {
    body.image = imgs[0];
  } else {
    body.images = imgs;
    body.aspect_ratio = aspectRatio;
  }
  const json = await post("/images/edits", body);
  return pickImage(json);
}

export type Block = { type: string; text?: string; image_url?: { url: string } };
type ChatContent = string | Block[];
type ChatMessage = { role: "system" | "user" | "assistant"; content: ChatContent };

/** Plain text completion from grok-4.3 (supports vision via content blocks). */
export async function chatText(messages: ChatMessage[], effort = "low"): Promise<string> {
  const json = (await post("/chat/completions", {
    model: TEXT_MODEL,
    reasoning_effort: effort,
    messages,
  })) as { choices: Array<{ message: { content: string } }> };
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}

/** Structured JSON completion from grok-4.3 against a JSON schema. */
export async function chatJson<T>(
  messages: ChatMessage[],
  schema: Record<string, unknown>,
  schemaName: string,
  effort = "low"
): Promise<T> {
  const json = (await post("/chat/completions", {
    model: TEXT_MODEL,
    reasoning_effort: effort,
    messages,
    response_format: {
      type: "json_schema",
      json_schema: { name: schemaName, schema, strict: true },
    },
  })) as { choices: Array<{ message: { content: string } }> };
  const content = json.choices?.[0]?.message?.content ?? "{}";
  return JSON.parse(content) as T;
}

export function imageBlock(url: string): Block {
  return { type: "image_url", image_url: { url } };
}
export function textBlock(text: string): Block {
  return { type: "text", text };
}
