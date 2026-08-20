import { combineConfidence } from "@/lib/smart-parser/confidence";
import { parseDate } from "@/lib/smart-parser/date-parser";
import { cleanTitle } from "@/lib/smart-parser/entity-extractor";
import { detectIntent, intentAsKind } from "@/lib/smart-parser/intent-detector";
import { normalizeInput } from "@/lib/smart-parser/normalizer";
import { parsePrice } from "@/lib/smart-parser/price-parser";
import { matchProject } from "@/lib/smart-parser/project-matcher";
import { parsePriority } from "@/lib/smart-parser/priority-parser";
import { parseQuantity } from "@/lib/smart-parser/quantity-parser";
import { parseStatus } from "@/lib/smart-parser/status-parser";
import { splitIntoSegments } from "@/lib/smart-parser/tokenizer";
import { parseUrl } from "@/lib/smart-parser/url-parser";
import type { ParserContext, SmartParsedItem, SmartParseResult } from "@/lib/smart-parser/types";

export function parseSmartInput(input: string, context: ParserContext): SmartParseResult {
  const normalized = normalizeInput(input);
  const segments = splitIntoSegments(normalized.normalized);
  const items = segments.map((segment) => parseSegment(segment, normalized.original, context));
  const confidence = combineConfidence(items.map((item) => item.confidence));

  return {
    confidence,
    items,
    originalInput: input,
    parsedBy: "local",
    needsReview: confidence < 0.5 || items.some((item) => item.needsReview)
  };
}

function parseSegment(segment: string, originalInput: string, context: ParserContext): SmartParsedItem {
  const intent = detectIntent(segment, context.learnedRules);
  const kind = intentAsKind(intent.intent);
  const date = parseDate(segment, context.now);
  const project = matchProject(segment, context.projects, context.learnedRules);
  const priority = parsePriority(segment);
  const status = parseStatus(segment, kind);
  const quantity = parseQuantity(segment);
  const price = parsePrice(segment, kind === "purchase");
  const url = parseUrl(segment);
  const isVagueReference = /(эту штуку|эта штука|на аппарате|то самое)/i.test(segment);

  const priceTotal = price.unitPrice && quantity.quantity && quantity.confidence >= 0.75 ? price.unitPrice * quantity.quantity : price.totalPrice;
  const confidence = combineConfidence([
    intent.confidence,
    project.confidence || undefined,
    date.confidence || undefined,
    price.confidence || undefined,
    quantity.confidence || undefined,
    url.confidence || undefined
  ]);

  return {
    kind,
    title: cleanTitle(segment),
    description: segment,
    projectPath: project.projectPath,
    status: status.status,
    priority: priority.priority,
    schedule: date.schedule,
    dueDate: date.dueDate,
    quantity: quantity.quantity,
    unitPrice: price.unitPrice,
    totalPrice: priceTotal,
    currency: price.currency,
    url: url.url,
    needsReview: confidence < 0.5 || intent.intent === "unknown" || isVagueReference,
    sourceText: segment,
    originalInput,
    parsedBy: "local",
    confidence,
    fieldConfidence: {
      intent: intent.confidence,
      project: project.confidence,
      date: date.confidence,
      price: price.confidence,
      quantity: quantity.confidence
    }
  };
}
