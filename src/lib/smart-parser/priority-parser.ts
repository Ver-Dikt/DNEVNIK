import type { Priority } from "@/lib/types";

export function parsePriority(text: string): { priority: Priority; confidence: number } {
  if (/\b(срочно|важно|критично|прямо сейчас|горит)\b/i.test(text)) return { priority: "high", confidence: 0.9 };
  if (/\b(не срочно|когда-нибудь|потом|низкий приоритет)\b/i.test(text)) return { priority: "low", confidence: 0.78 };
  return { priority: "normal", confidence: 0.4 };
}
