import { fillerWords, numberWords } from "@/lib/smart-parser/phrase-rules";
import type { NormalizedInput } from "@/lib/smart-parser/types";

export function normalizeInput(input: string): NormalizedInput {
  let normalized = input
    .toLowerCase()
    .replace(/[ё]/g, "е")
    .replace(/[“”«»]/g, '"')
    .replace(/[—–]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  for (const word of fillerWords) {
    normalized = normalized.replace(new RegExp(`(^|\\s)${escapeRegExp(word)}(?=\\s|$)`, "g"), " ");
  }

  for (const [word, value] of Object.entries(numberWords)) {
    normalized = normalized.replace(new RegExp(`\\b${word}\\b`, "g"), String(value));
  }

  normalized = normalized.replace(/\s+/g, " ").trim();

  return {
    original: input,
    normalized,
    tokens: normalized.split(/\s+/).filter(Boolean)
  };
}

export function stripRussianEnding(value: string): string {
  return value.replace(/(ами|ями|ого|ему|ыми|ими|ах|ях|ом|ем|ой|ей|ую|юю|а|я|у|ю|ы|и|е|о)$/i, "");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
