import type { QuantityParseResult } from "@/lib/smart-parser/types";

export function parseQuantity(text: string): QuantityParseResult {
  const match = text.match(/(?:^|\s)(\d+(?:[.,]\d+)?)\s*(штук(?:и)?|шт|банк(?:и|а|у|ок)?|кабел(?:я|ей|ь)?|руч(?:ки|ек|ка)?|петл(?:и|я|ь)?|потенциометр(?:а|ов)?|комплект(?:а|ов)?|метр(?:а|ов)?)(?=\s|$)/i);
  if (match) {
    return {
      quantity: Number(match[1].replace(",", ".")),
      unit: match[2],
      confidence: 0.9,
      matchedText: match[0]
    };
  }

  const lonely = text.match(/(?:^|\s)(\d+(?:[.,]\d+)?)\s+(?:по\s+\d+|[а-я]+)/i);
  if (lonely && Number(lonely[1]) <= 100) {
    return { quantity: Number(lonely[1]), confidence: 0.55, matchedText: lonely[0] };
  }

  return { confidence: 0 };
}
