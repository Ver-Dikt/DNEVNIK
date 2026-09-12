"use client";

import type { LearnedRule } from "@/lib/smart-parser/types";

const learnedRulesKey = "dnevnik.learnedRules";

export function loadLearnedRules(): LearnedRule[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(learnedRulesKey);
    if (!raw) return [];
    const rules = JSON.parse(raw);
    return Array.isArray(rules) ? rules : [];
  } catch {
    return [];
  }
}

export function saveLearnedRules(rules: LearnedRule[]): void {
  localStorage.setItem(learnedRulesKey, JSON.stringify(rules));
}

export function clearLearnedRules(): void {
  localStorage.setItem(learnedRulesKey, JSON.stringify([]));
}

export function rememberIntentRule(phrase: string, intent: LearnedRule["intent"]): LearnedRule {
  return {
    id: crypto.randomUUID(),
    phrase: phrase.toLowerCase().trim(),
    intent,
    createdAt: new Date().toISOString()
  };
}
