import { intentPhrases, intentToKind } from "@/lib/smart-parser/phrase-rules";
import type { IntentResult, LearnedRule, SmartIntent } from "@/lib/smart-parser/types";
import type { EntryKind } from "@/lib/types";

export function detectIntent(text: string, learnedRules: LearnedRule[] = []): IntentResult {
  for (const rule of learnedRules) {
    if (rule.intent && text.includes(rule.phrase.toLowerCase())) {
      return { intent: rule.intent, confidence: 0.98, matchedText: rule.phrase };
    }
  }

  if (/(?:^|[^\p{L}])(?:в (?:мои |наши )?хотелки|хочу потом купить)(?![\p{L}])/iu.test(text)) return { intent: "wish", confidence: 0.97, matchedText: "explicit wish" };
  if (/(?:^|[^\p{L}])(?:в (?:мои )?дела|в задачи|запиши задачу|напомни)(?![\p{L}])/iu.test(text)) return { intent: "task", confidence: 0.97, matchedText: "explicit task" };
  let best: IntentResult = { intent: "unknown", confidence: 0.18 };

  if (/(хочу|хотим|давай\s+сохраним|сохрани).{0,40}(потом|хотелк|может|когда-нибудь)|\bв\s+(?:мои|наши)?\s*хотелки\b/i.test(text)) {
    best = { intent: "wish", confidence: 0.94, matchedText: "wishlist phrase" };
  }

  for (const [intent, phrases] of Object.entries(intentPhrases) as Array<[SmartIntent, string[]]>) {
    for (const phrase of phrases) {
      if (!phrase) continue;
      const index = text.indexOf(phrase);
      if (index === -1) continue;
      const confidence = phrase.length > 10 ? 0.9 : 0.78;
      if (confidence > best.confidence) {
        best = { intent, confidence: confidence - Math.min(index * 0.005, 0.12), matchedText: phrase };
      }
    }
  }

  const hasPriceContext = /\b\d+[\s.,]?\d*\s*(?:руб|р|₽|\$|доллар|бакс|евро|nok|крон)/i.test(text);

  if ((best.intent === "unknown" || best.intent === "link") && hasPriceContext) {
    best = { intent: "purchase", confidence: 0.72, matchedText: "price context" };
  }

  if (best.intent === "unknown" && /(?:https?:\/\/|www\.)/i.test(text)) {
    best = { intent: "link", confidence: 0.72, matchedText: "url" };
  }

  return best;
}

export function intentAsKind(intent: SmartIntent): EntryKind {
  return intentToKind[intent] ?? "inbox";
}
