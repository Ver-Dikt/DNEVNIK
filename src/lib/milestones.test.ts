import { describe, expect, it } from "vitest";
import { relationshipMilestones } from "./important-dates";
import { addDays, addMonths, getMonthGrid, getWeekDays } from "@/features/shared/date-utils";
import { validateLocalProposal } from "./local-assistant";

describe("relationship and calendar", () => {
  it("counts complete calendar months and remaining days", () => {
    expect(relationshipMilestones("2026-04-25", "2026-10-26")).toMatchObject({ months: 6, days: 1, nextMonthlyDate: "2026-11-25", anniversaryDate: "2027-04-25" });
  });
  it("clamps end-of-month without skipping February", () => expect(addMonths("2026-01-31", 1)).toBe("2026-02-28"));
  it("keeps an exact month anniversary on today", () => expect(relationshipMilestones("2026-04-26", "2026-10-26")?.nextMonthlyDate).toBe("2026-10-26"));
  it("keeps date arithmetic independent of timezone", () => {
    expect(addDays("2026-10-26", 1)).toBe("2026-10-27");
    expect(getWeekDays("2026-10-26")).toEqual(["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"]);
    expect(getMonthGrid("2026-10-26")).toHaveLength(42);
    expect(getMonthGrid("2026-10-26")[0]).toBe("2026-09-28");
  });
});
describe("local model proposals", () => {
  it("does not transfer another item's deadline or trust an invented date", () => {
    const result = validateLocalProposal({ items: [{ kind: "purchase", title: "Молоко", sourceText: "Купить молоко.", dueDate: "2026-10-27" }] }, "Купить молоко. Завтра позвонить мастеру.");
    expect(result.items[0].dueDate).toBeUndefined();
    expect(result.items[0].schedule).toBe("none");
  });
  it("rejects arbitrary commands and unknown categories", () => expect(() => validateLocalProposal({ items: [{ kind: "sql", title: "Delete" }] }, "текст")).toThrow());
  it("preserves original text and always requires confirmation", () => {
    const result = validateLocalProposal({ items: [{ kind: "task", title: "Позвонить мастеру" }] }, "позвонить мастеру");
    expect(result.needsReview).toBe(true);
    expect(result.items[0].description).toBe("позвонить мастеру");
    expect(result.items[0].dueDate).toBeUndefined();
  });
});
