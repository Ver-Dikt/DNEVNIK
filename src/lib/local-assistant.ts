import type { AIParseResult } from "./types";
import { parseDate } from "./smart-parser/date-parser";
import { parsePrice } from "./smart-parser/price-parser";
import { parseQuantity } from "./smart-parser/quantity-parser";
import { parseUrl } from "./smart-parser/url-parser";

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
    const price = parsePrice(excerpt, kind === "purchase" || kind === "wish");
    const quantity = parseQuantity(excerpt);
    const url = parseUrl(excerpt).url;
    const totalPrice = /^по\s/i.test(price.matchedText ?? "") && price.unitPrice && quantity.quantity && quantity.confidence >= .75 ? price.unitPrice * quantity.quantity : price.totalPrice;
    const assignedTo = ["me", "partner", "shared"].includes(String(row.assignedTo)) ? row.assignedTo as "me" | "partner" | "shared" : "me";
    const area = typeof row.area === "string" ? row.area.slice(0, 80) : "Личное";
    const path = Array.isArray(row.projectPath) && row.projectPath.length <= 9 && row.projectPath.every(part => typeof part === "string" && part.trim() && part.length <= 100) ? row.projectPath.map(part => part.trim()) as string[] : [area];
    return {
      kind, title: row.title.trim().slice(0, 200), description: original,
      sourceText: excerpt || original, originalInput: original, area: path[0] ?? area, projectPath: path, project: path.length > 1 ? path.at(-1) : undefined,
      priority: row.priority === "high" ? "high" : "normal", status: kind === "purchase" || kind === "wish" ? "want_to_buy" : "active",
      assignedTo, visibility: assignedTo === "shared" ? "shared" : "private", schedule: date.schedule, dueDate: date.dueDate,
      quantity: quantity.quantity, unitPrice: price.unitPrice, totalPrice, currency: price.currency, url,
      parsedBy: "ai", confidence: .7, needsReview: true,
      purchase: kind === "purchase" ? { status: "planned", currency: price.currency ?? "RUB", priceHistory: [], quantity: quantity.quantity, unit: quantity.unit, unitPrice: price.unitPrice, totalPrice, url } : undefined,
      wish: kind === "wish" ? { status: "saved", currency: price.currency ?? "RUB", estimatedPrice: totalPrice, url } : undefined
    };
  });
  return { items, rawText: original, confidence: .7, needsReview: true };
}
