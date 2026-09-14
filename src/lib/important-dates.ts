import type { ImportantDate } from "@/lib/types";
// Calendar arithmetic uses UTC day numbers to avoid daylight-saving offsets.
function dayNumber(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date.getTime() / 86400000 : null;
}
export function nextOccurrence(item: Pick<ImportantDate, "date" | "repeat">, today: string): string | null {
  if (dayNumber(item.date) === null || dayNumber(today) === null) return null;
  if (item.repeat === "none" || item.date >= today) return item.date >= today ? item.date : null;
  const year = Number(today.slice(0, 4));
  for (let offset = 0; offset <= 8; offset++) {
    const candidate = String(year + offset) + item.date.slice(4);
    if (candidate >= today && dayNumber(candidate) !== null) return candidate;
  }
  return null;
}
export function relationshipDays(start: string | undefined, today: string) {
  const beginning = start ? dayNumber(start) : null;
  const current = dayNumber(today);
  if (beginning === null || current === null || beginning > current) return { together: null, anniversary: null };
  const next = nextOccurrence({date: start!, repeat: "yearly"}, today);
  return { together: current - beginning, anniversary: next ? dayNumber(next)! - current : null };
}
export function upcomingImportantDate(dates: ImportantDate[], today: string) {
  return dates.map(item => ({...item, date: nextOccurrence(item, today)}))
    .filter((item): item is ImportantDate => item.date !== null)
    .sort((a,b) => a.date.localeCompare(b.date))[0];
}
