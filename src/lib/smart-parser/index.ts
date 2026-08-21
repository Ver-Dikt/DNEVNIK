import { combineConfidence } from "@/lib/smart-parser/confidence";
import { parseDate } from "@/lib/smart-parser/date-parser";
import { detectAssignee, detectDomain, detectProjectCandidate } from "@/lib/smart-parser/domain-detector";
import { cleanTitle } from "@/lib/smart-parser/entity-extractor";
import { detectIntent, intentAsKind } from "@/lib/smart-parser/intent-detector";
import { normalizeInput } from "@/lib/smart-parser/normalizer";
import { parsePrice } from "@/lib/smart-parser/price-parser";
import { matchProject } from "@/lib/smart-parser/project-matcher";
import { parsePriority } from "@/lib/smart-parser/priority-parser";
import { parseQuantity } from "@/lib/smart-parser/quantity-parser";
import { parseRepeat, parseTime } from "@/lib/smart-parser/repeat-parser";
import { parseStatus } from "@/lib/smart-parser/status-parser";
import { splitIntoSegments } from "@/lib/smart-parser/tokenizer";
import { parseUrl } from "@/lib/smart-parser/url-parser";
import { defaultKnowledge, defaultSettings } from "@/lib/storage";
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
  const settings = { ...defaultSettings, ...(context.settings ?? {}) };
  const knowledge = context.knowledge ?? defaultKnowledge;
  const domain = detectDomain(segment, knowledge);
  const date = parseDate(segment, context.now);
  const repeat = parseRepeat(segment);
  const time = parseTime(segment);
  const project = matchProject(segment, context.projects, context.learnedRules);
  const inheritedProject = context.recentContext?.project && isRecentContext(context) ? [context.recentContext.area ?? domain.area, context.recentContext.project] : [];
  const projectPath = project.projectPath.length ? project.projectPath : inheritedProjectPath.length ? inheritedProjectPath : inheritedProject;
  const projectName = projectPath.length > 1 ? projectPath.at(-1) : undefined;
  const area = projectPath.length > 1 ? (projectPath[0] ?? domain.area) : domain.area;
  const priority = parsePriority(segment);
  const status = parseStatus(segment, kind);
  const quantity = parseQuantity(segment);
  const price = parsePrice(segment, kind === "purchase");
  const url = parseUrl(segment);
  const assignedTo = detectAssignee(`${originalInput} ${segment}`, area, kind, settings.defaultHomePurchaseAssignee, settings.defaultPersonalAssignee);
  const existingProjectNames = context.projects?.map((item) => item.name) ?? [];
  const projectCandidate = projectName ? undefined : detectProjectCandidate(originalInput, area, existingProjectNames);
  const isVagueReference = /(эту штуку|эта штука|на аппарате|то самое)/i.test(segment);

  const priceTotal = price.unitPrice && quantity.quantity && quantity.confidence >= 0.75 ? price.unitPrice * quantity.quantity : price.totalPrice;
  const confidence = combineConfidence([
    intent.confidence,
    domain.confidence,
    project.confidence || undefined,
    date.confidence || undefined,
    price.confidence || undefined,
    quantity.confidence || undefined,
    url.confidence || undefined
  ]);

  return {
    kind,
    title: refineTitle(cleanTitle(segment), kind, domain.area),
    description: segment,
    area,
    project: projectName,
    assignedTo,
    visibility: assignedTo === "shared" ? "shared" : "private",
    domain: domain.domain,
    category: inferCategory(segment, domain.domain),
    projectCandidate,
    projectPath,
    status: status.status,
    priority: priority.priority,
    schedule: date.schedule,
    dueDate: date.dueDate,
    time: time.time,
    repeat: repeat.repeat,
    quantity: quantity.quantity,
    purchase:
      kind === "purchase"
        ? {
            quantity: quantity.quantity,
            unit: quantity.unit,
            unitPrice: price.unitPrice,
            totalPrice: priceTotal,
            currency: price.currency ?? "RUB",
            url: url.url,
            status: "planned",
            priceHistory: [],
            ...(extractPurchaseNotes(segment) ? {} : {})
          }
        : undefined,
    unitPrice: price.unitPrice,
    totalPrice: priceTotal,
    currency: price.currency,
    url: url.url,
    notes: extractPurchaseNotes(segment),
    needsReview: confidence < 0.5 || intent.intent === "unknown" || isVagueReference,
    sourceText: segment,
    originalInput,
    parsedBy: "local",
    confidence,
    fieldConfidence: {
      intent: intent.confidence,
      project: project.confidence || (projectCandidate ? 0.45 : 0),
      date: date.confidence,
      price: price.confidence,
      quantity: quantity.confidence
    }
  };
}

function splitSemantically(text: string, projectHint?: string): string[] {
  const prepared = propagatePronoun(text, projectHint ?? inferObjectContext(text));

  const commaIdeaSplit = prepared.match(/^(.+?),\s*(.+?)\s+и\s+идея\s+(.+)$/i);
  if (commaIdeaSplit) return [commaIdeaSplit[1].trim(), commaIdeaSplit[2].trim(), `идея ${commaIdeaSplit[3].trim()}`];

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

  const buyList = prepared.match(/^(?:(?:мне|нам|ей|домой)\s+)*(?:надо\s+)?купить\s+(.+)$/i);
  if (buyList && !/\b(идея|потом\s+надо|надо\s+будет|проверить|написать|покрасить)\b/i.test(buyList[1])) {
    const parts = splitListWithSharedTail(buyList[1]);
    if (parts.length > 1) return parts.map((part) => `купить ${part}`);
  }

  return splitIntoSegments(prepared).flatMap((segment) => {
    if (/^идея\b/i.test(segment)) return segment;
    const innerIdeaSplit = segment.match(/^(.+?)\s+и\s+идея\s+(.+)$/i);
    if (innerIdeaSplit) return [innerIdeaSplit[1].trim(), `идея ${innerIdeaSplit[2].trim()}`];
    const actionSplit = segment.split(/\s*,?\s+потом\s+(?=(?:надо\s+(?:будет\s+)?)?(?:купить|сделать|проверить|покрасить|написать|добавить|заказать))/i);
    if (actionSplit.length > 1) {
      const [first, ...rest] = actionSplit;
      return [first, ...rest.map((part) => (/^(надо|купить|сделать|проверить|покрасить|написать|добавить|заказать)\b/i.test(part) ? part : `надо ${part}`))];
    }
    return segment;
  });
}

function refineTitle(title: string, kind: string, area: string): string {
  let next = title
    .replace(/^(домой|мне|нам|ей)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const musicMix = next.match(/^трек\s+(.+?)\s+свести$/i);
  if (musicMix) next = `Свести трек ${musicMix[1]}`;
  const musicMaster = next.match(/^по\s+(.+?)\s+еще\s+мастер\s+сделать$/i);
  if (musicMaster) next = `Сделать мастер ${musicMaster[1]}`;
  if (kind === "purchase" && !/^купить\b/i.test(next)) next = `Купить ${next[0]?.toLowerCase() ?? ""}${next.slice(1)}`;
  if (area === "Музыка") next = next.replace(/\bсведение\b/i, "свести");
  return next ? next[0].toUpperCase() + next.slice(1) : title;
}

function inferCategory(text: string, domain: string): string | undefined {
  if (domain === "music" && /(свести|сведение|mix|mixing)/i.test(text)) return "Сведение";
  if (domain === "music" && /(мастер|мастеринг|master)/i.test(text)) return "Мастеринг";
  return undefined;
}

function extractPurchaseNotes(text: string): string | undefined {
  if (!/(одну|1)\s+на\s+/i.test(text)) return undefined;
  const notes = text.match(/(?:одну|1)\s+на\s+[^,]+/gi) ?? [];
  return notes.map((note) => note.replace(/^одну/i, "1 банка")).join("; ");
}

function isRecentContext(context: ParserContext): boolean {
  if (!context.recentContext?.updatedAt) return false;
  const timeout = context.settings?.recentContextMinutes ?? defaultSettings.recentContextMinutes;
  return Date.now() - new Date(context.recentContext.updatedAt).getTime() < timeout * 60 * 1000;
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
