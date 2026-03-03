import Anthropic from "@anthropic-ai/sdk";

type AiProvider = "claude" | "gemini" | "openai" | "custom";

interface GenerateOptions {
  provider: AiProvider;
  apiKey?: string | null;
  prompt: string;
  maxTokens?: number;
}

// System AI용 클라이언트 (서버 API 키)
function getSystemClaudeClient(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
}

export async function generateText(options: GenerateOptions): Promise<string> {
  const { provider, apiKey, prompt, maxTokens = 300 } = options;

  switch (provider) {
    case "claude": {
      const client = apiKey
        ? new Anthropic({ apiKey })
        : getSystemClaudeClient();
      const msg = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      });
      const textBlock = msg.content.find((b) => b.type === "text");
      return textBlock?.text?.trim() ?? "";
    }

    case "gemini": {
      const key = apiKey || process.env.GOOGLE_AI_API_KEY!;
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: maxTokens },
          }),
        }
      );
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
    }

    case "openai": {
      if (!apiKey) throw new Error("OpenAI requires an API key");
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
      });
      const data = await res.json();
      return data.choices?.[0]?.message?.content?.trim() ?? "";
    }

    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}
