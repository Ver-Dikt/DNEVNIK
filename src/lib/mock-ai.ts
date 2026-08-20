import type AIProviderDefault from "@/lib/provider-shim";
import { parseSmartInput } from "@/lib/smart-parser";
import type { AIParseInput, AIParseResult, AIQueryInput, AIQueryResult, DiaryEntry } from "@/lib/types";

export class MockAIProvider implements AIProviderDefault {
  async parseInbox(input: AIParseInput): Promise<AIParseResult> {
    const result = parseSmartInput(input.text, { timezone: input.timezone });
    return {
      confidence: result.confidence,
      needsReview: result.needsReview,
      rawText: input.text,
      items: result.items
    };
  }

  async answerQuery(input: AIQueryInput): Promise<AIQueryResult> {
    const query = input.query.toLowerCase();
    const active = input.entries.filter((entry) => entry.status !== "done" && entry.status !== "cancelled");
    const purchases = active.filter((entry) => entry.kind === "purchase");
    const repair = active.filter((entry) => entry.projectPath.join(" ").toLowerCase().includes("ремонт"));

    if (query.includes("куп")) {
      const total = purchases.reduce((sum, item) => sum + (item.totalPrice ?? item.unitPrice ?? 0), 0);
      return {
        answer: purchases.length
          ? `Нужно купить: ${purchases.map((item) => item.title).join(", ")}. Примерная сумма: ${total} RUB.`
          : "Открытых покупок пока нет.",
        relatedIds: purchases.map((item) => item.id)
      };
    }

    if (query.includes("ремонт")) {
      return {
        answer: repair.length ? `По ремонту осталось: ${repair.map((item) => item.title).join(", ")}.` : "По ремонту активных записей не нашлось.",
        relatedIds: repair.map((item) => item.id)
      };
    }

    return {
      answer: active.length ? `Активных записей: ${active.length}. Самое свежее: ${active[0]?.title}.` : "Активных записей пока нет.",
      relatedIds: active.slice(0, 5).map((item) => item.id)
    };
  }
}

export function createEntryFromParsed(item: AIParseResult["items"][number]): DiaryEntry {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    ...item
  };
}
