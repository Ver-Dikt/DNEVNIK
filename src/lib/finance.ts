import type { DiaryEntry, FinanceTransaction, SavingsGoal } from "@/lib/types";

export interface BudgetSummary {
  planned: number;
  actual: number;
  byArea: Array<{ area: string; amount: number }>;
}

export function calculateBudget(entries: DiaryEntry[]): BudgetSummary {
  const byArea = new Map<string, number>();
  let planned = 0;
  let actual = 0;

  for (const entry of entries) {
    if (entry.kind !== "purchase" || entry.status === "cancelled") continue;
    const purchase = entry.purchase;
    const plannedValue = purchase?.totalPrice ?? entry.totalPrice ?? ((purchase?.unitPrice ?? entry.unitPrice ?? 0) * (purchase?.quantity ?? entry.quantity ?? 1));
    const actualValue = purchase?.actualPrice ?? plannedValue;
    const area = entry.area ?? "Личное";

    if (purchase?.status === "purchased" || entry.status === "bought") {
      actual += actualValue;
      byArea.set(area, (byArea.get(area) ?? 0) + actualValue);
    } else {
      planned += plannedValue;
      byArea.set(area, (byArea.get(area) ?? 0) + plannedValue);
    }
  }

  return {
    planned,
    actual,
    byArea: [...byArea.entries()].map(([area, amount]) => ({ area, amount })).sort((a, b) => b.amount - a.amount)
  };
}

export function createSavingsGoal(title: string, targetAmount: number, currency = "RUB"): SavingsGoal {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title,
    targetAmount,
    currentAmount: 0,
    currency,
    createdBy: "me",
    visibility: "shared",
    createdAt: now,
    updatedAt: now,
    revision: 1
  };
}

export function addToSavingsGoal(goal: SavingsGoal, amount: number): { goal: SavingsGoal; transaction: FinanceTransaction } {
  const now = new Date().toISOString();
  return {
    goal: {
      ...goal,
      currentAmount: goal.currentAmount + amount,
      updatedAt: now,
      revision: goal.revision + 1
    },
    transaction: {
      id: crypto.randomUUID(),
      type: "savings_deposit",
      amount,
      currency: goal.currency,
      relatedGoalId: goal.id,
      createdAt: now
    }
  };
}

export function parseSavingsCommand(text: string): { action: "create" | "deposit" | "query"; title: string; amount?: number } | null {
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
  const create = normalized.match(/(?:создай|создать)\s+накоплени[ея]\s+на\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s*(тысяч[аи]?|тыс\.?|к)?(?:\s|$)/i);
  if (create) return { action: "create", title: normalizeGoalTitle(create[1]), amount: parseMoney(create[2], create[3]) };

  const deposit = normalized.match(/(?:добавь|добавить|положи|положить)\s+(\d+(?:[.,]\d+)?)\s*(тысяч[аи]?|тыс\.?|к)?\s+(?:в\s+накоплени[ея]\s+)?(?:на\s+)?(.+)$/i);
  if (deposit) return { action: "deposit", title: normalizeGoalTitle(deposit[3]), amount: parseMoney(deposit[1], deposit[2]) };

  const query = normalized.match(/сколько\s+осталось\s+накопить\s+на\s+(.+)$/i);
  if (query) return { action: "query", title: normalizeGoalTitle(query[1]) };

  return null;
}

function parseMoney(value: string, multiplier?: string): number {
  const number = Number(value.replace(",", "."));
  return number * (multiplier ? 1000 : 1);
}

function normalizeGoalTitle(value: string): string {
  return value.replace(/[?.!]+$/g, "").trim();
}
