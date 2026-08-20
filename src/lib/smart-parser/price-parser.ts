import type { PriceParseResult } from "@/lib/smart-parser/types";

const currencyMap: Array<[RegExp, string]> = [
  [/(?:руб(?:лей|ля|ль)?|₽|р\b|rub)/i, "RUB"],
  [/(?:\$|доллар(?:ов|а)?|бакс(?:ов|а)?|usd)/i, "USD"],
  [/(?:евро|eur|€)/i, "EUR"],
  [/(?:крон|nok)/i, "NOK"]
];

export function parsePrice(text: string, purchaseContext: boolean): PriceParseResult {
  const perUnit = text.match(/(?:^|\s)по\s+(\d+(?:[.,]\d+)?)\s*(к|k|тысяч[аи]?|тыс\.?)?\s*(руб(?:лей|ля|ль)?|₽|р(?=\s|$)|rub|доллар(?:ов|а)?|бакс(?:ов|а)?|usd|евро|eur|€|крон|nok)?/i);
  if (perUnit) {
    const value = Number(perUnit[1].replace(",", ".")) * (perUnit[2] ? 1000 : 1);
    return {
      unitPrice: value,
      totalPrice: value,
      currency: detectCurrency(perUnit[3] ?? "") ?? "RUB",
      confidence: 0.94,
      matchedText: perUnit[0].trim()
    };
  }

  const explicit = text.match(/(?:за\s+)?(\$|€)?\s*(\d+(?:[.,]\d+)?)\s*(к|k|тысяч[аи]?|тыс\.?)?\s*(руб(?:лей|ля|ль)?|₽|р(?=\s|$)|rub|доллар(?:ов|а)?|бакс(?:ов|а)?|usd|евро|eur|€|крон|nok)?/i);
  if (!explicit) return { confidence: 0 };

  const hasCurrency = Boolean(explicit[1] || explicit[4]);
  const hasMultiplier = Boolean(explicit[3]);
  if (!hasCurrency && !hasMultiplier && !purchaseContext) return { confidence: 0 };

  const rawNumber = Number(explicit[2].replace(",", "."));
  if (!rawNumber) return { confidence: 0 };

  const multiplier = hasMultiplier ? 1000 : 1;
  const value = rawNumber * multiplier;
  const currency = detectCurrency(`${explicit[1] ?? ""} ${explicit[4] ?? ""}`) ?? (purchaseContext ? "RUB" : undefined);

  return {
    unitPrice: value,
    totalPrice: value,
    currency,
    confidence: hasCurrency || hasMultiplier ? 0.92 : 0.58,
    matchedText: explicit[0].trim()
  };
}

export function detectCurrency(text: string): string | undefined {
  for (const [pattern, currency] of currencyMap) {
    if (pattern.test(text)) return currency;
  }
  return undefined;
}
