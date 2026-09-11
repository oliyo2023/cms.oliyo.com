import { resolveVars } from "@/lib/config";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export class AiConfigError extends Error {}

function assertKeyShape(key: string): void {
  if (!/^[\x21-\x7E]+$/.test(key)) {
    throw new AiConfigError("API key 格式不正确（含空格或非 ASCII 字符），请粘贴完整的 key");
  }
}

export type LlmConfig = { baseUrl: string; apiKey: string; model: string };

export async function llmConfig(): Promise<LlmConfig> {
  const v = await resolveVars(["LLM_API_KEY", "AGNES_API_KEY", "LLM_BASE_URL", "LLM_MODEL"]);
  const apiKey = v.LLM_API_KEY ?? v.AGNES_API_KEY;
  if (!apiKey) throw new AiConfigError("文本生成服务未配置：请在「设置」页填写 Agnes API Key");
  assertKeyShape(apiKey);
  return {
    baseUrl: (v.LLM_BASE_URL ?? "https://api.agnes-ai.cn/v1").replace(/\/$/, ""),
    apiKey,
    model: v.LLM_MODEL ?? "agnes-3.0-flash",
  };
}

export type ImageConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
  size: string;
  ratio: string;
};

export async function imageConfig(): Promise<ImageConfig | null> {
  const v = await resolveVars([
    "IMAGE_API_KEY",
    "AGNES_API_KEY",
    "IMAGE_BASE_URL",
    "IMAGE_MODEL",
    "IMAGE_SIZE",
    "IMAGE_RATIO",
  ]);
  const apiKey = v.IMAGE_API_KEY ?? v.AGNES_API_KEY;
  if (!apiKey) return null;
  assertKeyShape(apiKey);
  return {
    baseUrl: (v.IMAGE_BASE_URL ?? "https://api.agnes-ai.cn/v1").replace(/\/$/, ""),
    apiKey,
    model: v.IMAGE_MODEL ?? "agnes-image-2.5-flash",
    size: v.IMAGE_SIZE ?? "1K",
    ratio: v.IMAGE_RATIO ?? "1:1",
  };
}

export type VideoConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
  size: string;
  aspect: string;
  seconds: string;
  pollUrl: string;
};

export async function videoConfig(): Promise<VideoConfig | null> {
  const v = await resolveVars([
    "VIDEO_API_KEY",
    "AGNES_API_KEY",
    "VIDEO_BASE_URL",
    "VIDEO_MODEL",
    "VIDEO_SIZE",
    "VIDEO_ASPECT",
    "VIDEO_SECONDS",
    "VIDEO_POLL_URL",
  ]);
  const apiKey = v.VIDEO_API_KEY ?? v.AGNES_API_KEY;
  if (!apiKey) return null;
  assertKeyShape(apiKey);
  return {
    baseUrl: (v.VIDEO_BASE_URL ?? "https://api.agnes-ai.cn/v1").replace(/\/$/, ""),
    apiKey,
    model: v.VIDEO_MODEL ?? "agnes-video-2.5-flash",
    size: v.VIDEO_SIZE ?? "720P",
    aspect: v.VIDEO_ASPECT ?? "16:9",
    seconds: v.VIDEO_SECONDS ?? "5",
    pollUrl: v.VIDEO_POLL_URL ?? "",
  };
}

export function videoPollUrl(cfg: VideoConfig, taskId: string): string {
  if (cfg.pollUrl) {
    return cfg.pollUrl.replaceAll("{id}", encodeURIComponent(taskId)).replaceAll("{model}", encodeURIComponent(cfg.model));
  }
  return `${cfg.baseUrl}/videos/${encodeURIComponent(taskId)}`;
}

async function chatRequest(
  cfg: { baseUrl: string; apiKey: string; model: string },
  messages: ChatMessage[],
  stream: boolean,
  maxTokens?: number,
): Promise<Response> {
  return fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      stream,
      ...(maxTokens ? { max_tokens: maxTokens } : {}),
    }),
  });
}

/** Streams a chat completion, invoking onDelta per text chunk. Resolves with the full text. */
export async function streamChat(
  messages: ChatMessage[],
  onDelta: (delta: string) => void,
  opts?: { maxTokens?: number; signal?: AbortSignal },
): Promise<string> {
  const cfg = await llmConfig();
  const res = await chatRequest(cfg, messages, true, opts?.maxTokens);
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI 服务错误 ${res.status}: ${text.slice(0, 300)}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const parsed = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string | null }; message?: { content?: string | null } }>;
          error?: { message?: string };
        };
        if (parsed.error?.message) throw new Error(parsed.error.message);
        const delta = parsed.choices?.[0]?.delta?.content ?? parsed.choices?.[0]?.message?.content ?? "";
        if (delta) {
          full += delta;
          onDelta(delta);
        }
      } catch (e) {
        if (e instanceof SyntaxError) continue; // partial line
        throw e;
      }
    }
  }
  return full;
}

/** One-shot (non-streaming) completion. */
export async function chatOnce(messages: ChatMessage[], opts?: { maxTokens?: number }): Promise<string> {
  const cfg = await llmConfig();
  const res = await chatRequest(cfg, messages, false, opts?.maxTokens);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI 服务错误 ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };
  if (data.error?.message) throw new Error(data.error.message);
  return data.choices?.[0]?.message?.content ?? "";
}

export type GeneratedImage = { b64?: string; url?: string };

/** Agnes /images/generations：size 档位 + ratio，格式走 extra_body.response_format（顶层 response_format 禁止）。 */
export async function generateImage(prompt: string): Promise<GeneratedImage> {
  const cfg = await imageConfig();
  if (!cfg) throw new AiConfigError("文生图服务未配置（IMAGE_API_KEY / AGNES_API_KEY）");
  const body: Record<string, unknown> = {
    model: cfg.model,
    prompt,
    size: cfg.size,
    ratio: cfg.ratio,
    extra_body: { response_format: "url" },
  };
  const res = await fetch(`${cfg.baseUrl}/images/generations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`文生图服务错误 ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as { data?: Array<{ url?: string; b64_json?: string }>; error?: { message?: string } };
  if (data.error?.message) throw new Error(data.error.message);
  const img = data.data?.[0];
  if (!img) throw new Error("文生图服务返回空结果");
  return { url: img.url, b64: img.b64_json };
}
