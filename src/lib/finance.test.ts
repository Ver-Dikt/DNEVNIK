import { describe, expect, it } from "vitest";
import { addToSavingsGoal, calculateBudget, createSavingsGoal, parseSavingsCommand } from "@/lib/finance";
import type { DiaryEntry } from "@/lib/types";

const base = {
  id: "1",
  title: "Купить краску",
  projectPath: ["Дом", "Гардероб"],
  area: "Дом",
  project: "Гардероб",
  status: "want_to_buy",
  priority: "normal",
  schedule: "none",
  createdAt: "2026-08-20T00:00:00.000Z",
  updatedAt: "2026-08-20T00:00:00.000Z"
} satisfies Partial<DiaryEntry>;

describe("finance", () => {
  it("counts planned purchase spending", () => {
    const summary = calculateBudget([{ ...base, kind: "purchase", purchase: { status: "planned", totalPrice: 3600, currency: "RUB" } } as DiaryEntry]);
    expect(summary.planned).toBe(3600);
    expect(summary.actual).toBe(0);
  });

  it("counts purchased items as actual spending", () => {
    const summary = calculateBudget([{ ...base, kind: "purchase", purchase: { status: "purchased", actualPrice: 3400, totalPrice: 3600, currency: "RUB" } } as DiaryEntry]);
    expect(summary.actual).toBe(3400);
  });

  it("groups spending by area", () => {
    const summary = calculateBudget([{ ...base, kind: "purchase", purchase: { status: "planned", totalPrice: 3600, currency: "RUB" } } as DiaryEntry]);
    expect(summary.byArea[0]).toEqual({ area: "Дом", amount: 3600 });
  });

  it("parses savings goal creation", () => {
    expect(parseSavingsCommand("Создай накопление на компьютер 150 тысяч")).toEqual({ action: "create", title: "компьютер", amount: 150000 });
  });

  it("parses savings deposit", () => {
    expect(parseSavingsCommand("Добавь 10 тысяч на компьютер")).toEqual({ action: "deposit", title: "компьютер", amount: 10000 });
  });

  it("parses savings query", () => {
    expect(parseSavingsCommand("Сколько осталось накопить на компьютер?")).toEqual({ action: "query", title: "компьютер" });
  });

  it("adds money to savings deterministically", () => {
    const goal = createSavingsGoal("компьютер", 150000);
    const result = addToSavingsGoal(goal, 10000);
    expect(result.goal.currentAmount).toBe(10000);
    expect(result.transaction.amount).toBe(10000);
  });
});
