import type { ImportantDate } from "@/lib/types";
import { addMonths } from "@/features/shared/date-utils";
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

export function relationshipMilestones(start: string | undefined, today: string) {
  if (!start || relationshipDays(start, today).together === null) return null;
  let months = (Number(today.slice(0, 4)) - Number(start.slice(0, 4))) * 12 + Number(today.slice(5, 7)) - Number(start.slice(5, 7));
  if (addMonths(start, months) > today) months--;
  const lastMonthlyDate = addMonths(start, months);
  const days = dayNumber(today)! - dayNumber(lastMonthlyDate)!;
  return { months, days, nextMonthlyDate: lastMonthlyDate === today && months > 0 ? today : addMonths(start, months + 1), anniversaryDate: nextOccurrence({ date: start, repeat: "yearly" }, today) };
}

export function pluralRu(value: number, words: [string, string, string]) {
  const last = value % 10, lastTwo = value % 100;
  return lastTwo >= 11 && lastTwo <= 14 ? words[2] : last === 1 ? words[0] : last >= 2 && last <= 4 ? words[1] : words[2];
}
