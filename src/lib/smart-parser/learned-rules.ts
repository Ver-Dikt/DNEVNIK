"use client";

import type { LearnedRule } from "@/lib/smart-parser/types";

const learnedRulesKey = "dnevnik.learnedRules";

export function loadLearnedRules(): LearnedRule[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(learnedRulesKey);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as LearnedRule[];
  } catch {
    return [];
  }
}

export function saveLearnedRules(rules: LearnedRule[]): void {
  localStorage.setItem(learnedRulesKey, JSON.stringify(rules));
}

export function rememberIntentRule(phrase: string, intent: LearnedRule["intent"]): LearnedRule {
  return {
    id: crypto.randomUUID(),
    phrase: phrase.toLowerCase().trim(),
    intent,
    createdAt: new Date().toISOString()
  };
}
