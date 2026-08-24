import type { AssignedTo, DiaryEntry, EntryKind, EntryStatus, PurchaseStatus, Space, WishStatus } from "@/lib/types";

export const kindLabels: Record<EntryKind, string> = {
  task: "Дело",
  purchase: "Покупка",
  wish: "Хотелка",
  idea: "Идея",
  note: "Заметка",
  inbox: "Разобрать"
};

export function ownerLabel(owner?: AssignedTo): string {
  if (owner === "shared") return "Общее";
  if (owner === "partner") return "Партнёр";
  return "Моё";
}

export function matchesOwner(entry: DiaryEntry, filter: "all" | "me" | "shared"): boolean {
  if (filter === "all") return true;
  if (filter === "shared") return entry.assignedTo === "shared" || entry.visibility === "shared";
  return !entry.assignedTo || entry.assignedTo === "me";
}

export function entrySpaceName(entry: DiaryEntry, spaces: Space[]): string {
  return spaces.find((space) => space.id === entry.spaceId)?.name ?? entry.area ?? "Без пространства";
}

export function purchaseStatus(entry: DiaryEntry): PurchaseStatus {
  if (entry.purchase?.status) return entry.purchase.status;
  if (entry.status === "selected") return "selected";
  if (entry.status === "ordered") return "ordered";
  if (entry.status === "bought" || entry.status === "done") return "purchased";
  if (entry.status === "researching") return "researching";
  return "planned";
}

export function purchaseStatusToEntryStatus(status: PurchaseStatus): EntryStatus {
  if (status === "selected") return "selected";
  if (status === "ordered") return "ordered";
  if (status === "purchased") return "bought";
  if (status === "researching") return "researching";
  if (status === "cancelled") return "cancelled";
  return "want_to_buy";
}

export function wishStatus(entry: DiaryEntry): WishStatus {
  return entry.wish?.status ?? "saved";
}

export function money(entry: DiaryEntry): number {
  return entry.purchase?.actualPrice ?? entry.purchase?.totalPrice ?? entry.purchase?.plannedPrice ?? entry.wish?.estimatedPrice ?? entry.totalPrice ?? entry.unitPrice ?? 0;
}

export function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
