import { env } from "../../config/env";
import { AIUnavailableError, CompletionRequest, LLMProvider } from "./provider";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Gemini adapter (fetch-based). Retries temporary overloads, then tries a backup model. */
export class GeminiProvider implements LLMProvider {
  readonly name = "gemini";
  isConfigured() { return !!env.GEMINI_API_KEY; }

  async complete(req: CompletionRequest): Promise<string> {
    if (!this.isConfigured()) {
      throw new AIUnavailableError("AI is not configured. Set GEMINI_API_KEY in the backend environment.", "AI_NOT_CONFIGURED");
    }
    const models = [env.GEMINI_MODEL, env.GEMINI_FALLBACK_MODEL].filter((m, i, a) => m && a.indexOf(m) === i);
    let lastErr = "unknown error";

    for (const model of models) {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const generationConfig: Record<string, unknown> = {
            maxOutputTokens: Math.max(req.maxTokens ?? 2048, 4096),
            temperature: req.temperature ?? 0.3,
          };
          if (/2\.5-flash/.test(model)) generationConfig.thinkingConfig = { thinkingBudget: 0 };

          const r = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
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

          if (r.ok) {
            const text = (data.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? "").join("").trim();
            if (!text) throw new Error(`Empty response (${data.candidates?.[0]?.finishReason ?? data.promptFeedback?.blockReason ?? "unknown"})`);
            return text;
          }

          lastErr = r.status === 429
            ? "Rate limit reached on the free tier. Please wait a minute and try again."
            : data?.error?.message ?? `HTTP ${r.status}`;
          if (![500, 503, 504].includes(r.status)) break;   // not temporary: stop retrying this model
          await sleep(1500 * (attempt + 1));                // overloaded: wait, then retry
        } catch (e: any) {
          lastErr = e?.message ?? lastErr;
          break;
        }
      }
    }
    throw new AIUnavailableError(`AI request failed: ${lastErr}`, "AI_REQUEST_FAILED");
  }
}