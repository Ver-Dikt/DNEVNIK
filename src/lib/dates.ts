import type { SchedulePreset } from "@/lib/types";

export function todayIso(): string {
  return localDateIso(new Date());
}

export function addDaysIso(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDateIso(date);
}

export function resolveScheduleDate(schedule: SchedulePreset): string | undefined {
  if (schedule === "today") return todayIso();
  if (schedule === "tomorrow") return addDaysIso(1);
  return undefined;
}

export function isOverdue(date?: string): boolean {
  return Boolean(date && date < todayIso());
}

export function isThisWeek(date?: string): boolean {
  if (!date) return false;
  const target = new Date(`${date}T00:00:00`);
  const now = new Date();
  const day = now.getDay() || 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - day + 1);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return target >= monday && target <= sunday;
}

export function formatDateRu(date?: string): string {
  if (!date) return "без даты";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short"
  }).format(new Date(`${date}T00:00:00`));
}

function localDateIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
