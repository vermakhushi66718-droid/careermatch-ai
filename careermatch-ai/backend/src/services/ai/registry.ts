import { env } from "../../config/env";
import { AnthropicProvider } from "./anthropic";
import { OpenAIProvider } from "./openai";
import { LLMProvider } from "./provider";

const factories: Record<string, () => LLMProvider> = {
  anthropic: () => new AnthropicProvider(),
  openai: () => new OpenAIProvider(),
};

let active: LLMProvider | null = null;

export function getProvider(): LLMProvider {
  if (!active) {
    const f = factories[env.AI_PROVIDER.toLowerCase()];
    if (!f) throw new Error(`Unknown AI_PROVIDER "${env.AI_PROVIDER}". Available: ${Object.keys(factories).join(", ")}`);
    active = f();
  }
  return active;
}

/** Used by tests to inject a fake provider. */
export function setProvider(p: LLMProvider | null) { active = p; }
