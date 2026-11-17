import Anthropic from "@anthropic-ai/sdk";
import { env } from "../../config/env";
import { AIUnavailableError, CompletionRequest, LLMProvider } from "./provider";

export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic";
  private client: Anthropic | null = null;

  isConfigured() { return !!env.ANTHROPIC_API_KEY; }

  private get sdk() {
    if (!this.client) this.client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    return this.client;
  }

  async complete(req: CompletionRequest): Promise<string> {
    if (!this.isConfigured()) {
      throw new AIUnavailableError("AI is not configured. Set ANTHROPIC_API_KEY in the backend environment.", "AI_NOT_CONFIGURED");
    }
    try {
      const res = await this.sdk.messages.create({
        model: env.ANTHROPIC_MODEL,
        max_tokens: req.maxTokens ?? 2048,
        system: req.system,
        messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
      });
      return res.content.map((b: any) => (b.type === "text" ? b.text : "")).join("").trim();
    } catch (e: any) {
      throw new AIUnavailableError(`AI request failed: ${e?.message ?? "unknown error"}`, "AI_REQUEST_FAILED");
    }
  }
}
