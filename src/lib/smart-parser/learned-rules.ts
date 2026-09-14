"use client";

import type { LearnedRule } from "@/lib/smart-parser/types";

const learnedRulesKey = "dnevnik.learnedRules";

export function loadLearnedRules(): LearnedRule[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(learnedRulesKey);
    if (!raw) return [];
    const rules = JSON.parse(raw);
    return validateLearnedRules(rules);
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

export function validateLearnedRules(value: unknown): LearnedRule[] {
  if (!Array.isArray(value)) return [];
  return value.filter((rule): rule is LearnedRule => Boolean(rule && typeof rule.id === "string" && typeof rule.phrase === "string" && rule.phrase.trim().length >= 2 && (!rule.intent || ["task","purchase","wish","idea","note","inbox"].includes(rule.intent)) && (!rule.projectPath || (Array.isArray(rule.projectPath) && rule.projectPath.every((part: unknown) => typeof part === "string")))));
}
