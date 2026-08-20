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
  const phraseProject = matchProject(normalized.normalized, context.projects, context.learnedRules);
  const segments = splitSemantically(normalized.normalized, phraseProject.projectPath.at(-1) ?? phraseProject.matchedText);
  const items = segments.map((segment) => parseSegment(segment, normalized.original, context, phraseProject.projectPath));
  const confidence = combineConfidence(items.map((item) => item.confidence));

  return {
    confidence,
    items,
    originalInput: input,
    parsedBy: "local",
    needsReview: confidence < 0.5 || items.some((item) => item.needsReview)
  };
}

function parseSegment(segment: string, originalInput: string, context: ParserContext, inheritedProjectPath: string[] = []): SmartParsedItem {
  const intent = detectIntent(segment, context.learnedRules);
  const kind = intentAsKind(intent.intent);
  const date = parseDate(segment, context.now);
  const project = matchProject(segment, context.projects, context.learnedRules);
  const projectPath = project.projectPath.length ? project.projectPath : inheritedProjectPath;
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
    projectPath,
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

function splitSemantically(text: string, projectHint?: string): string[] {
  const prepared = propagatePronoun(text, projectHint ?? inferObjectContext(text));

  const ideaSplit = prepared.match(/^(.+?)\s+и\s+идея\s+(.+)$/i);
  if (ideaSplit) return [ideaSplit[1].trim(), `идея ${ideaSplit[2].trim()}`];

  const projectList = prepared.match(/^для\s+(.+?)\s+нужн(?:ы|а|о)\s+(.+)$/i);
  if (projectList) {
    const context = projectList[1].trim();
    const items = splitList(projectList[2]);
    if (items.length > 1) return items.map((item) => `нужны ${item} для ${context}`);
  }

  const repeatedNeeded = prepared.match(/^нужн(?:ы|а|о)\s+(.+)$/i);
  if (repeatedNeeded) {
    const parts = splitRepeatedObjects(repeatedNeeded[1]);
    if (parts.length > 1) return parts.map((part) => `нужна ${part}`);
  }

  const buyList = prepared.match(/^(?:надо\s+)?купить\s+(.+)$/i);
  if (buyList && !/\b(идея|потом\s+надо|надо\s+будет|проверить|написать|покрасить)\b/i.test(buyList[1])) {
    const parts = splitListWithSharedTail(buyList[1]);
    if (parts.length > 1) return parts.map((part) => `купить ${part}`);
  }

  return splitIntoSegments(prepared).flatMap((segment) => {
    if (/^идея\b/i.test(segment)) return segment;
    const actionSplit = segment.split(/\s*,?\s+потом\s+(?=(?:надо\s+(?:будет\s+)?)?(?:купить|сделать|проверить|покрасить|написать|добавить|заказать))/i);
    if (actionSplit.length > 1) {
      const [first, ...rest] = actionSplit;
      return [first, ...rest.map((part) => (/^(надо|купить|сделать|проверить|покрасить|написать|добавить|заказать)\b/i.test(part) ? part : `надо ${part}`))];
    }
    return segment;
  });
}

function splitList(text: string): string[] {
  return text
    .replace(/\s+и\s+/gi, ", ")
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 1);
}

function splitRepeatedObjects(text: string): string[] {
  const parts = text
    .split(/\s+и\s+(?=(?:банк[аи]?|банку|ручк[аи]|петл[иья]|краск[аи]|кабель|потенциометр))/i)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 1 ? parts : [text.trim()];
}

function splitListWithSharedTail(text: string): string[] {
  const tail = text.match(/\s+для\s+(.+)$/i)?.[0] ?? "";
  const withoutTail = tail ? text.slice(0, -tail.length).trim() : text.trim();
  const parts = splitList(withoutTail);
  if (parts.length <= 1) return [text.trim()];
  return parts.map((part) => `${part}${tail}`);
}

function propagatePronoun(text: string, projectHint?: string): string {
  if (!projectHint) return text;
  return text.replace(/(^|\s)(его|её|ее)(?=\s|$)/gi, `$1${projectHint}`);
}

function inferObjectContext(text: string): string | undefined {
  const match = text.match(/\bдля\s+(?:самого\s+)?([а-яa-z0-9-]{4,})/i);
  if (!match) return undefined;
  return match[1].replace(/(а|я|у|ю|ом|ем|е|и)$/i, "");
}
