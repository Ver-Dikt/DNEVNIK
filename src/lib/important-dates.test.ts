import { describe, expect, it } from "vitest";
import { nextOccurrence, relationshipDays, upcomingImportantDate } from "./important-dates";
import type { ImportantDate } from "./types";
describe("calendar dates", () => {
  it("does not invent a relationship date", () => expect(relationshipDays(undefined,"2026-09-14")).toEqual({together:null,anniversary:null}));
  it("keeps the anniversary on today", () => expect(relationshipDays("2025-09-14","2026-09-14")).toEqual({together:365,anniversary:0}));
  it("counts calendar days across DST", () => expect(relationshipDays("2026-03-28","2026-03-30").together).toBe(2));
  it("rejects malformed and future start dates", () => { for(const date of ["invalid","2026-02-30","2027-01-01"]) expect(relationshipDays(date,"2026-09-14").together).toBeNull(); });
  it("waits for a real leap day", () => expect(nextOccurrence({date:"2024-02-29",repeat:"yearly"},"2026-09-14")).toBe("2028-02-29"));
  it("omits past one-off dates and displays the next year", () => {
    const dates = [{date:"2020-01-01",repeat:"none"},{date:"2020-01-02",repeat:"yearly"}] as ImportantDate[];
    expect(upcomingImportantDate(dates,"2026-09-14")?.date).toBe("2027-01-02");
  });
});
