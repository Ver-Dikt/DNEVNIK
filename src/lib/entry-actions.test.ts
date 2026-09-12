import { describe, expect, it } from "vitest";
import { toggleEntryCompletion } from "./entry-actions";
import type { DiaryEntry } from "./types";

describe("completion shared across all screens", () => {
  it("completes a task without losing its notes", () => {
    const result = toggleEntryCompletion({ id: "t", kind: "task", title: "Позвонить", description: "Вечером", status: "active", revision: 2 } as DiaryEntry, "2026-09-12T12:00:00Z");
    expect(result).toMatchObject({ status: "done", description: "Вечером", revision: 3, completedAt: "2026-09-12T12:00:00Z" });
  });
  it("reopens purchases with consistent list and purchase statuses", () => {
    const bought = { id: "p", kind: "purchase", status: "bought", purchase: { status: "purchased", totalPrice: 180 }, completedAt: "2026-09-12" } as DiaryEntry;
    expect(toggleEntryCompletion(bought)).toMatchObject({ status: "want_to_buy", purchase: { status: "planned", totalPrice: 180 }, completedAt: undefined });
    expect(bought.status).toBe("bought");
  });
  it("preserves a wish's fields when completing and reopening", () => {
    const item = { kind: "wish", status: "active", wish: { status: "saved", estimatedPrice: 100 }, revision: 1 } as DiaryEntry;
    expect(toggleEntryCompletion(toggleEntryCompletion(item))).toMatchObject({ status: "active", wish: { status: "saved", estimatedPrice: 100 }, revision: 3 });
  });
});
