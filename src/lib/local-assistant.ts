import type { AIParseResult } from "./types";
import { parseDate } from "./smart-parser/date-parser";

const kinds = new Set(["task", "purchase", "wish", "idea", "note"]);
export function validateLocalProposal(value: unknown, original: string): AIParseResult {
  if (!value || typeof value !== "object" || !Array.isArray((value as { items?: unknown }).items)) throw new Error("Модель не вернула список записей");
  const raw = (value as { items: unknown[] }).items;
  if (!raw.length || raw.length > 20) throw new Error("Проверьте длину записи: ожидается от 1 до 20 пунктов");
  const items: AIParseResult["items"] = raw.map(item => {
    if (!item || typeof item !== "object") throw new Error("Некорректный пункт разбора");
    const row = item as Record<string, unknown>;
    if (typeof row.kind !== "string" || !kinds.has(row.kind) || typeof row.title !== "string" || !row.title.trim()) throw new Error("Модель вернула неизвестную категорию или пустое название");
    const kind = row.kind as AIParseResult["items"][number]["kind"];
    const excerpt = typeof row.sourceText === "string" && original.includes(row.sourceText) ? row.sourceText : "";
    // Resolve deadlines only from this item's original words, never a model's guess.
    const date = parseDate(excerpt.toLowerCase());
    const area = typeof row.area === "string" ? row.area.slice(0, 80) : "Личное";
    return {
      kind, title: row.title.trim().slice(0, 200), description: original,
      sourceText: excerpt || original, originalInput: original, area, projectPath: [area],
      priority: row.priority === "high" ? "high" : "normal", status: kind === "purchase" || kind === "wish" ? "want_to_buy" : "active",
      assignedTo: "me", visibility: "private", schedule: date.schedule, dueDate: date.dueDate,
      parsedBy: "ai", confidence: .7, needsReview: true,
      purchase: kind === "purchase" ? { status: "planned", currency: "RUB", priceHistory: [] } : undefined,
      wish: kind === "wish" ? { status: "saved", currency: "RUB" } : undefined
    };
  });
  return { items, rawText: original, confidence: .7, needsReview: true };
}
