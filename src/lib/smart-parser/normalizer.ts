import { fillerWords, numberWords } from "@/lib/smart-parser/phrase-rules";
import type { NormalizedInput } from "@/lib/smart-parser/types";

export function normalizeInput(input: string): NormalizedInput {
  const links: string[] = [];
  const masked = input.replace(/(?:https?:\/\/|www\.)[^\s]+/gi, value => { links.push(value); return `zzlinktoken${links.length - 1}zz`; });
  let normalized = masked
    .replace(/\n+/g, "; ")
    .toLowerCase()
    .replace(/[ё]/g, "е")
    .replace(/(^|\s)полторы(?=\s|$)/g, "$11.5")
    .replace(/(^|\s)полтора(?=\s|$)/g, "$11.5")
    .replace(/[“”«»]/g, '"')
    .replace(/[—–]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  for (const word of fillerWords) {
    normalized = normalized.replace(new RegExp(`(^|\\s)${escapeRegExp(word)}(?=\\s|$)`, "g"), " ");
  }

  for (const [word, value] of Object.entries(numberWords)) {
    normalized = normalized.replace(new RegExp(`(^|\\s)${word}(?=\\s|$)`, "g"), `$1${value}`);
  }

  normalized = normalized.replace(/\s+/g, " ").trim();

  normalized = normalized.replace(/zzlinktoken(\d+)zz/g, (_, index) => links[Number(index)]);
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
