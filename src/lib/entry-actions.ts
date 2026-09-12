import type { DiaryEntry } from "@/lib/types";

export function toggleEntryCompletion(entry: DiaryEntry, now = new Date().toISOString()): DiaryEntry {
  const reopen = entry.status === "done" || entry.status === "bought";
  return {
    ...entry,
    status: reopen ? (entry.kind === "purchase" ? "want_to_buy" : "active") : (entry.kind === "purchase" ? "bought" : "done"),
    purchase: entry.purchase ? { ...entry.purchase, status: reopen ? "planned" : "purchased" } : undefined,
    wish: entry.wish ? { ...entry.wish, status: reopen ? "saved" : "purchased" } : undefined,
    completedAt: reopen ? undefined : now,
    updatedAt: now,
    revision: (entry.revision ?? 1) + 1
  };
}
