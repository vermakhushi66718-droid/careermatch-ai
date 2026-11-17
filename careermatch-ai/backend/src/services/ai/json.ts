import { ZodSchema } from "zod";
import { AIUnavailableError } from "./provider";

/** Pulls the first JSON object/array out of a model reply (handles ```json fences and prose around it). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.search(/[\[{]/);
  if (start === -1) throw new Error("no JSON found");
  const open = candidate[start];
  const close = open === "{" ? "}" : "]";
  const end = candidate.lastIndexOf(close);
  if (end <= start) throw new Error("unterminated JSON");
  return JSON.parse(candidate.slice(start, end + 1));
}

export function parseWith<T>(schema: ZodSchema<T>, text: string): T {
  try {
    return schema.parse(extractJson(text));
  } catch (e: any) {
    throw new AIUnavailableError("The AI returned an unexpected response format. Please try again.", "AI_BAD_OUTPUT");
  }
}
