import Anthropic from "@anthropic-ai/sdk";

type AiProvider = "claude" | "gemini" | "openai" | "custom";

interface GenerateOptions {
  provider: AiProvider;
  apiKey?: string | null;
  prompt: string;
  maxTokens?: number;
  timeoutMs?: number;
}

// AI API 호출 타임아웃 (기본 8초 — Vercel 10초 제한 고려)
const DEFAULT_TIMEOUT_MS = 8_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`AI API timeout (${ms}ms)`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

// System AI용 클라이언트 (서버 API 키, 싱글톤)
let systemClient: Anthropic | null = null;
function getSystemClaudeClient(): Anthropic {
  if (!systemClient) {
    systemClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  }
  return systemClient;
}

export async function generateText(options: GenerateOptions): Promise<string> {
  const { provider, apiKey, prompt, maxTokens = 300, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  try {
    switch (provider) {
      case "claude": {
        const client = apiKey
          ? new Anthropic({ apiKey })
          : getSystemClaudeClient();
        const msg = await withTimeout(
          client.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: maxTokens,
            messages: [{ role: "user", content: prompt }],
          }),
          timeoutMs
        );
        const textBlock = msg.content.find((b) => b.type === "text");
        return textBlock?.text?.trim() ?? "";
      }

      case "gemini": {
        const key = apiKey || process.env.GOOGLE_AI_API_KEY!;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { maxOutputTokens: maxTokens },
              }),
              signal: controller.signal,
            }
          );
          const data = await res.json();
          return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
        } finally {
          clearTimeout(timer);
        }
      }

      case "openai": {
        if (!apiKey) throw new Error("OpenAI requires an API key");
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [{ role: "user", content: prompt }],
              max_tokens: maxTokens,
            }),
            signal: controller.signal,
          });
          const data = await res.json();
          return data.choices?.[0]?.message?.content?.trim() ?? "";
        } finally {
          clearTimeout(timer);
        }
      }

      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }
  } catch (err) {
    console.error(`[AI Engine] ${provider} error:`, err instanceof Error ? err.message : err);
    return "";
  }
}
