import { defaultKnowledge } from "@/lib/storage";
import type { AssignedTo, DomainId, KnowledgeStore } from "@/lib/types";

export function detectDomain(text: string, knowledge: KnowledgeStore = defaultKnowledge): { domain: DomainId; area: string; confidence: number; matchedText?: string } {
  const normalized = text.toLowerCase();
  let best: { domain: DomainId; area: string; confidence: number; matchedText?: string } = { domain: "general", area: "Личное", confidence: 0.2 };

  if (/(^|\s)(по\s+работе|для\s+работы|клиенту|клиент|заведении|заведение)(?=\s|$)/i.test(normalized)) {
    best = { domain: "work", area: "Работа", confidence: 0.94, matchedText: "work context" };
  }
  if (/(^|\s)(для\s+студии|в\s+студии|студия)(?=\s|$)/i.test(normalized)) {
    best = { domain: "studio_equipment", area: "Студия", confidence: 0.92, matchedText: "studio context" };
  }

  for (const [domain, config] of Object.entries(knowledge.domains)) {
    for (const keyword of config.keywords) {
      if (!normalized.includes(keyword.toLowerCase())) continue;
      const confidence = keyword.length > 5 ? 0.86 : 0.72;
      if (confidence > best.confidence) best = { domain: domain as DomainId, area: config.area, confidence, matchedText: keyword };
    }
  }

  for (const [entity, mapping] of Object.entries(knowledge.knownEntities)) {
    if (!normalized.includes(entity.toLowerCase())) continue;
    const confidence = mapping.project ? 0.9 : 0.78;
    if (confidence > best.confidence) {
      best = { domain: mapping.domain ?? "general", area: mapping.area ?? best.area, confidence, matchedText: entity };
    }
  }

  return best;
}

export function detectAssignee(text: string, area: string, kind: string, defaultHomePurchaseAssignee: AssignedTo = "shared", defaultPersonalAssignee: AssignedTo = "me"): AssignedTo {
  const normalized = text.toLowerCase();
  if (/(^|\s)(нам|общее|вместе|домой|наши|наше|наш)(?=\s|$)/i.test(normalized)) return "shared";
  if (/(^|\s)(мне|себе|мой|моя)(?=\s|$)/i.test(normalized)) return "me";
  if (/(^|\s)(ей|для нее|для неё)(?=\s|$)/i.test(normalized)) return "partner";
  if (kind === "purchase" && area === "Дом") return defaultHomePurchaseAssignee;
  return defaultPersonalAssignee;
}

export function detectProjectCandidate(text: string, area: string, existingProjects: string[]): string | undefined {
  const contextual = text.match(/(?:^|\s)по\s+([a-zа-я0-9-]+(?:\s+[a-zа-я0-9-]+){0,2})/i);
  if (contextual) {
    const candidate = contextual[1].replace(/\s+(надо|нужно|проверить|сделать|купить).*$/i, "").trim();
    if (candidate && !["работе", "дому", "проекту", "музыке"].includes(candidate.toLowerCase()) && !existingProjects.some((project) => project.toLowerCase() === candidate.toLowerCase())) return candidate;
  }
  const candidates = Array.from(text.matchAll(/\b([A-ZА-Я][A-Za-zА-Яа-я0-9-]{2,})\b/g)).map((match) => match[1]);
  for (const candidate of candidates) {
    const lower = candidate.toLowerCase();
    if (["дом", "работа", "студия", "музыка", "личное", "семья"].includes(lower)) continue;
    if (existingProjects.some((project) => project.toLowerCase() === lower)) return undefined;
    if (area === "Музыка" || /grafton|pax/i.test(candidate)) return candidate;
  }
  return undefined;
}
