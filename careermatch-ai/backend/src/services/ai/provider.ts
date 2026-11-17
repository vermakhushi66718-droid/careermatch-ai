export interface ChatMessage { role: "user" | "assistant"; content: string; }

export interface CompletionRequest {
  system: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
}

/**
 * Provider-independent contract. Application code only ever talks to AIService
 * (see ./index.ts), which talks to whichever LLMProvider is configured.
 * To add a provider: implement this interface and register it in ./registry.ts.
 */
export interface LLMProvider {
  readonly name: string;
  isConfigured(): boolean;
  complete(req: CompletionRequest): Promise<string>;
}

export class AIUnavailableError extends Error {
  constructor(message: string, public code: "AI_NOT_CONFIGURED" | "AI_REQUEST_FAILED" | "AI_BAD_OUTPUT") {
    super(message);
  }
}
