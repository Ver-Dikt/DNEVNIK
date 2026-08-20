import { MockAIProvider } from "@/lib/mock-ai";
import { OpenAICompatibleProvider } from "@/lib/openai-compatible";
import type { AIProvider } from "@/lib/types";

export function getAIProvider(): AIProvider {
  const provider = process.env.AI_PROVIDER ?? "mock";
  const enabled = process.env.AI_ENABLED === "true";

  if (!enabled || provider === "mock") {
    return new MockAIProvider();
  }

  const baseUrl = process.env.AI_BASE_URL;
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;

  if (!baseUrl || !apiKey || !model) {
    return new MockAIProvider();
  }

  return new OpenAICompatibleProvider(baseUrl, apiKey, model);
}
