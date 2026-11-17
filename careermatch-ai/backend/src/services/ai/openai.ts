import { env } from "../../config/env";
import { AIUnavailableError, CompletionRequest, LLMProvider } from "./provider";

/** Minimal OpenAI Chat Completions adapter (fetch-based, no SDK) to prove provider swap-ability. */
export class OpenAIProvider implements LLMProvider {
  readonly name = "openai";
  isConfigured() { return !!env.OPENAI_API_KEY; }

  async complete(req: CompletionRequest): Promise<string> {
    if (!this.isConfigured()) {
      throw new AIUnavailableError("AI is not configured. Set OPENAI_API_KEY in the backend environment.", "AI_NOT_CONFIGURED");
    }
    try {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: env.OPENAI_MODEL,
          max_tokens: req.maxTokens ?? 2048,
          temperature: req.temperature ?? 0.3,
          messages: [{ role: "system", content: req.system }, ...req.messages],
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data: any = await r.json();
      return String(data.choices?.[0]?.message?.content ?? "").trim();
    } catch (e: any) {
      throw new AIUnavailableError(`AI request failed: ${e?.message ?? "unknown error"}`, "AI_REQUEST_FAILED");
    }
  }
}
