import { todayIso } from "@/lib/dates";

export function addDays(dateIso: string, days: number): string {
  const date = new Date(`${dateIso}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function addMonths(dateIso: string, months: number): string {
  const date = new Date(`${dateIso}T00:00:00`);
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

export function getWeekDays(dateIso: string): string[] {
  const selected = new Date(`${dateIso}T00:00:00`);
  const day = selected.getDay() || 7;
  selected.setDate(selected.getDate() - day + 1);
  return Array.from({ length: 7 }, (_, index) => addDays(selected.toISOString().slice(0, 10), index));
}

export function getMonthGrid(dateIso: string): string[] {
  const date = new Date(`${dateIso}T00:00:00`);
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const startOffset = (first.getDay() || 7) - 1;
  const start = new Date(first);
  start.setDate(first.getDate() - startOffset);
  return Array.from({ length: 42 }, (_, index) => addDays(start.toISOString().slice(0, 10), index));
}

export function formatHeaderDate(dateIso: string): string {
  return new Date(`${dateIso}T00:00:00`).toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });
}

export function formatMonth(dateIso: string): string {
  return new Date(`${dateIso}T00:00:00`).toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
}

export function shortWeekday(dateIso: string): string {
  return new Date(`${dateIso}T00:00:00`).toLocaleDateString("ru-RU", { weekday: "short" }).replace(".", "");
}

export function isToday(dateIso: string): boolean {
  return dateIso === todayIso();
}

export function isPast(dateIso?: string): boolean {
  return Boolean(dateIso && dateIso < todayIso());
}

export function sameMonth(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}
