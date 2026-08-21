import type { RepeatRule } from "@/lib/types";

export function parseRepeat(text: string): { repeat: RepeatRule; confidence: number; matchedText?: string } {
  if (/кажд(?:ый|ое|ого)\s+день|ежедневно/i.test(text)) return { repeat: "daily", confidence: 0.94, matchedText: "daily" };
  if (/кажд(?:ую|ой)\s+недел/i.test(text)) return { repeat: "weekly", confidence: 0.92, matchedText: "weekly" };
  if (/кажд(?:ый|ого)\s+понедельник/i.test(text)) return { repeat: "weekly_monday", confidence: 0.94, matchedText: "weekly monday" };
  if (/кажд(?:ый|ого)\s+месяц|раз\s+в\s+месяц/i.test(text)) return { repeat: "monthly", confidence: 0.92, matchedText: "monthly" };
  if (/кажд(?:ого|ый)\s+перв(?:ого|ое)\s+числа/i.test(text)) return { repeat: "monthly_first", confidence: 0.95, matchedText: "monthly first" };
  return { repeat: "none", confidence: 0 };
}

export function parseTime(text: string): { time?: string; confidence: number; matchedText?: string } {
  const explicit = text.match(/(?:в|к)\s+(\d{1,2})(?::|\.| часов?\s*)?(\d{2})?/i);
  if (!explicit) return { confidence: 0 };
  const hours = Number(explicit[1]);
  if (!Number.isFinite(hours) || hours > 23) return { confidence: 0 };
  const minutes = explicit[2] ? Number(explicit[2]) : 0;
  if (minutes > 59) return { confidence: 0 };
  return { time: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`, confidence: 0.88, matchedText: explicit[0] };
}
