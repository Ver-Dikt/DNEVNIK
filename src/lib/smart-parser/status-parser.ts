import type { EntryKind, EntryStatus } from "@/lib/types";

export function parseStatus(text: string, kind: EntryKind): { status: EntryStatus; confidence: number } {
  if (/\b(жду|ожидаю|после ответа|после звонка)\b/i.test(text)) return { status: "waiting", confidence: 0.88 };
  if (kind === "purchase") {
    if (/\b(заказано|заказал)\b/i.test(text)) return { status: "ordered", confidence: 0.86 };
    if (/\b(куплено|купил)\b/i.test(text)) return { status: "bought", confidence: 0.86 };
    if (/\b(ищу|найти|посмотреть где)\b/i.test(text)) return { status: "researching", confidence: 0.76 };
    return { status: "want_to_buy", confidence: 0.7 };
  }
  return { status: "active", confidence: 0.5 };
}
