import { describe, expect, it } from "vitest";
import { categoryChoices, inCategory } from "./entry-category";
import type { DiaryEntry } from "./types";

const item = (id: string, path: string[]): DiaryEntry => ({id,title:id,kind:"purchase",status:"want_to_buy",priority:"normal",schedule:"none",projectPath:path,createdAt:"",updatedAt:""});
describe("entry category filters", () => {
  it("includes nested projects in a selected parent without mixing equal names", () => {
    const kitchen=item("кухня",["Дом","Ремонт","Кухня"]);
    const studio=item("студия",["Работа","Ремонт","Студия"]);
    expect(inCategory(kitchen,JSON.stringify(["Дом","Ремонт"]))).toBe(true);
    expect(inCategory(studio,JSON.stringify(["Дом","Ремонт"]))).toBe(false);
    expect(categoryChoices([kitchen,studio]).map(x=>x.label)).toContain("Дом / Ремонт / Кухня");
  });
  it("handles records without a project and invalid filter values", () => {
    const record={...item("a",[]),area:"Школа"};
    expect(inCategory(record,JSON.stringify(["Школа"]))).toBe(true);
    expect(inCategory(record,"invalid")).toBe(false);
  });
});
