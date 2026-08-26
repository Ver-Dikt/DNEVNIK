import type { PlanTransaction, SharedPlan } from "@/lib/types";

export function calculateSharedPlan(plans: SharedPlan[], transactions: PlanTransaction[], planId: string) {
  const plan = plans.find((item) => item.id === planId);
  const planTransactions = transactions.filter((item) => item.planId === planId);
  const saved = planTransactions.reduce((sum, item) => {
    if (item.type === "deposit") return sum + item.amount;
    if (item.type === "adjustment") return sum + item.amount;
    return sum;
  }, 0);
  const spent = planTransactions.reduce((sum, item) => item.type === "expense" ? sum + item.amount : sum, 0);
  const target = plan?.targetAmount ?? 0;
  return {
    target,
    saved,
    spent,
    available: saved - spent,
    remaining: Math.max(target - saved, 0),
    progress: target > 0 ? Math.min(saved / target, 1) : 0,
    transactions: planTransactions
  };
}

export function money(value: number, currency = "RUB") {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0, style: "currency", currency }).format(value);
}
