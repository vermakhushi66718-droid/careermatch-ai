import { env } from "../../config/env";
import { AIUnavailableError, CompletionRequest, LLMProvider } from "./provider";

/** Gemini adapter (fetch-based, no SDK needed). */
export class GeminiProvider implements LLMProvider {
  readonly name = "gemini";
  isConfigured() { return !!env.GEMINI_API_KEY; }

  async complete(req: CompletionRequest): Promise<string> {
    if (!this.isConfigured()) {
      throw new AIUnavailableError("AI is not configured. Set GEMINI_API_KEY in the backend environment.", "AI_NOT_CONFIGURED");
    }
    try {
      const generationConfig: Record<string, unknown> = {
        // extra room, because "thinking" models spend part of this budget before answering
        maxOutputTokens: Math.max(req.maxTokens ?? 2048, 4096),
        temperature: req.temperature ?? 0.3,
      };
      // Turn off thinking on 2.5 Flash models so JSON answers are not cut short
      if (/2\.5-flash/.test(env.GEMINI_MODEL)) generationConfig.thinkingConfig = { thinkingBudget: 0 };

      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.GEMINI_MODEL)}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: req.system }] },
            contents: req.messages.map((m) => ({
              role: m.role === "assistant" ? "model" : "user",
              parts: [{ text: m.content }],
            })),
            generationConfig,
          }),
        },
      );
      const data: any = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg = data?.error?.message ?? `HTTP ${r.status}`;
        throw new Error(r.status === 429 ? "Rate limit reached on the free tier. Please wait a minute and try again." : msg);
      }
      const text = (data.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? "").join("").trim();
      if (!text) throw new Error(`Empty response (${data.candidates?.[0]?.finishReason ?? data.promptFeedback?.blockReason ?? "unknown"})`);
      return text;
    } catch (e: any) {
      throw new AIUnavailableError(`AI request failed: ${e?.message ?? "unknown error"}`, "AI_REQUEST_FAILED");
    }
  }
}