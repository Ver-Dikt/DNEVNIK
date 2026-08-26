"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useRef } from "react";
import { Button, Segmented, Surface } from "@/components/ui/native";
import { EntryCard } from "@/features/entries/EntryCard";
import { calculateSharedPlan, money as formatMoney } from "@/features/family/shared-plan-utils";
import { addDays, addMonths, formatHeaderDate, formatMonth, getMonthGrid, getWeekDays, isPast, isToday, sameMonth, shortWeekday } from "@/features/shared/date-utils";
import { matchesOwner, ownerLabel } from "@/features/shared/entry-utils";
import type { CalendarEvent, DiaryEntry, ImportantDate, Member, PlanTransaction, SharedPlan, Space } from "@/lib/types";

export function PlanView({
  entries,
  calendarEvents,
  importantDates,
  members,
  planTransactions,
  sharedPlans,
  spaces,
  ownerFilter,
  mode,
  selectedDate,
  onModeChange,
  onDateChange,
  onOwnerFilterChange,
  onComplete,
  onOpen,
  onAdd
}: {
  entries: DiaryEntry[];
  calendarEvents: CalendarEvent[];
  importantDates: ImportantDate[];
  members: Member[];
  planTransactions: PlanTransaction[];
  sharedPlans: SharedPlan[];
  spaces: Space[];
  ownerFilter: "all" | "me" | "partner" | "shared";
  mode: "day" | "week" | "month";
  selectedDate: string;
  onModeChange: (mode: "day" | "week" | "month") => void;
  onDateChange: (date: string) => void;
  onOwnerFilterChange: (filter: "all" | "me" | "partner" | "shared") => void;
  onComplete: (entry: DiaryEntry) => void;
  onOpen: (entry: DiaryEntry) => void;
  onAdd: () => void;
}) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const activeEntries = entries.filter((entry) => entry.status !== "cancelled" && entry.status !== "done" && matchesOwner(entry, ownerFilter));
  const weekDays = getWeekDays(selectedDate);
  const monthDays = getMonthGrid(selectedDate);
  const entriesByDate = useMemo(() => {
    const map = new Map<string, DiaryEntry[]>();
    for (const entry of activeEntries) {
      if (!entry.dueDate) continue;
      map.set(entry.dueDate, [...(map.get(entry.dueDate) ?? []), entry]);
    }
    return map;
  }, [activeEntries]);
  const markersByDate = useMemo(() => {
    const map = new Map<string, number>();
    const days = mode === "month" ? monthDays : weekDays;
    for (const date of days) {
      const count = importantDates.filter((item) => importantDateOccursOn(item, date)).length + calendarEvents.filter((event) => eventOccursOn(event, date)).length;
      if (count) map.set(date, count);
    }
    return map;
  }, [calendarEvents, importantDates, mode, monthDays, weekDays]);

  const dated = activeEntries.filter((entry) => entry.dueDate === selectedDate).sort((a, b) => (a.time ?? "99:99").localeCompare(b.time ?? "99:99"));
  const timed = dated.filter((entry) => entry.time);
  const untimed = dated.filter((entry) => !entry.time);
  const purchases = dated.filter((entry) => entry.kind === "purchase");
  const neededPurchases = activeEntries.filter((entry) => entry.kind === "purchase").slice(0, 12);
  const importantToday = importantDates.filter((item) => importantDateOccursOn(item, selectedDate));
  const eventsToday = calendarEvents.filter((event) => eventOccursOn(event, selectedDate));
  const nextImportantDate = nextDate(importantDates, selectedDate);
  const activeSharedPlan = sharedPlans.find((plan) => plan.status === "active");
  const overdue = activeEntries.filter((entry) => isPast(entry.dueDate));
  const unscheduled = activeEntries.filter((entry) => !entry.dueDate && entry.schedule === "none");
  const someday = activeEntries.filter((entry) => entry.schedule === "someday");
  const scheduledLater = activeEntries.filter((entry) => !entry.dueDate && entry.schedule !== "none" && entry.schedule !== "someday");

  function shift(direction: number) {
    if (mode === "month") {
      onDateChange(addMonths(selectedDate, direction));
      return;
    }
    onDateChange(addDays(selectedDate, mode === "week" ? direction * 7 : direction));
  }

  function handleTouchEnd(clientX: number, clientY: number) {
    if (touchStart.current === null) return;
    const delta = clientX - touchStart.current.x;
    const verticalDelta = clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.abs(delta) < 54) return;
    if (Math.abs(verticalDelta) > Math.abs(delta) * 0.65) return;
    shift(delta > 0 ? -1 : 1);
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[var(--muted)]">План</p>
          <h1 className="text-3xl font-black leading-tight">{formatHeaderDate(selectedDate)}</h1>
        </div>
        <Segmented
          onChange={onOwnerFilterChange}
          options={[
            { label: "Все", value: "all" },
            { label: ownerLabel("me", members), value: "me" },
            { label: ownerLabel("partner", members), value: "partner" },
            { label: "Общее", value: "shared" }
          ]}
          value={ownerFilter}
        />
      </div>

      <SummaryStrip
        activePlan={activeSharedPlan}
        importantDate={nextImportantDate}
        planTransactions={planTransactions}
        purchasesCount={neededPurchases.length}
        selectedDate={selectedDate}
        sharedPlans={sharedPlans}
      />

      <Surface className="grid gap-3 p-3" onTouchStart={(event) => (touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY })} onTouchEnd={(event) => handleTouchEnd(event.changedTouches[0].clientX, event.changedTouches[0].clientY)}>
        <div className="flex items-center justify-between gap-2">
          <Button aria-label="Назад" className="h-11 w-11 p-0" onClick={() => shift(-1)}><ChevronLeft size={20} /></Button>
          <Segmented
            options={[
              { label: "День", value: "day" },
              { label: "Неделя", value: "week" },
              { label: "Месяц", value: "month" }
            ]}
            value={mode}
            onChange={onModeChange}
          />
          <Button aria-label="Вперёд" className="h-11 w-11 p-0" onClick={() => shift(1)}><ChevronRight size={20} /></Button>
        </div>
        {mode === "month" ? (
          <div>
            <div className="mb-2 text-center text-sm font-black capitalize">{formatMonth(selectedDate)}</div>
            <div className="grid grid-cols-7 gap-1">
              {monthDays.map((date) => <CalendarDay count={(entriesByDate.get(date)?.length ?? 0) + (markersByDate.get(date) ?? 0)} date={date} faded={!sameMonth(date, selectedDate)} key={date} selected={date === selectedDate} onClick={() => { onDateChange(date); onModeChange("day"); }} />)}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {weekDays.map((date) => <CalendarDay count={(entriesByDate.get(date)?.length ?? 0) + (markersByDate.get(date) ?? 0)} date={date} key={date} selected={date === selectedDate} onClick={() => onDateChange(date)} />)}
          </div>
        )}
      </Surface>

      <CalendarMarkers dates={importantToday} events={eventsToday} />
      <AgendaSection title="По времени" entries={timed} members={members} spaces={spaces} onComplete={onComplete} onOpen={onOpen} />
      <AgendaSection title="Без времени" entries={untimed} members={members} spaces={spaces} onComplete={onComplete} onOpen={onOpen} emptyAction={onAdd} />
      <AgendaSection title="Покупки на дату" entries={purchases} members={members} spaces={spaces} onComplete={onComplete} onOpen={onOpen} />
      <AgendaSection title="Просрочено" entries={overdue} members={members} spaces={spaces} onComplete={onComplete} onOpen={onOpen} />
      <AgendaSection title="Со сроком без даты" entries={scheduledLater} members={members} spaces={spaces} onComplete={onComplete} onOpen={onOpen} />
      <AgendaSection title="Без даты" entries={unscheduled} members={members} spaces={spaces} onComplete={onComplete} onOpen={onOpen} />
      <AgendaSection title="Когда-нибудь" entries={someday} members={members} spaces={spaces} onComplete={onComplete} onOpen={onOpen} />
    </div>
  );
}

function SummaryStrip({ activePlan, importantDate, planTransactions, purchasesCount, selectedDate, sharedPlans }: { activePlan?: SharedPlan; importantDate?: ImportantDate; planTransactions: PlanTransaction[]; purchasesCount: number; selectedDate: string; sharedPlans: SharedPlan[] }) {
  const planStats = activePlan ? calculateSharedPlan(sharedPlans, planTransactions, activePlan.id) : null;
  return (
    <div className="summary-strip">
      <Surface className="summary-card">
        <span>Ближайшая дата</span>
        <b>{importantDate ? importantDate.title : "Пока нет"}</b>
        <small>{importantDate ? readableDate(importantDate, selectedDate) : "Добавь в разделе Мы"}</small>
      </Surface>
      <Surface className="summary-card">
        <span>Общий план</span>
        <b>{activePlan ? activePlan.title : "Нет активного"}</b>
        <small>{activePlan && planStats ? `${formatMoney(planStats.saved, activePlan.currency ?? "RUB")} накоплено` : "Открой Общие планы"}</small>
      </Surface>
      <Surface className="summary-card">
        <span>Покупки</span>
        <b>{purchasesCount ? `${purchasesCount} в работе` : "Чисто"}</b>
        <small>{purchasesCount ? "Покупки и хотелки разделены" : "Новых покупок нет"}</small>
      </Surface>
    </div>
  );
}

function CalendarMarkers({ dates, events }: { dates: ImportantDate[]; events: CalendarEvent[] }) {
  if (!dates.length && !events.length) return null;
  return (
    <section className="grid gap-2">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-base font-black">События и даты</h2>
        <span className="text-sm font-bold text-[var(--muted)]">{dates.length + events.length}</span>
      </div>
      {dates.map((item) => <Surface className="p-4" key={item.id}><div className="font-black">{item.title}</div><div className="text-sm text-[var(--muted)]">{item.type === "birthday" ? "День рождения" : item.type === "anniversary" ? "Годовщина" : "Важная дата"} · {item.repeat === "yearly" ? "ежегодно" : item.date}</div></Surface>)}
      {events.map((item) => <Surface className="p-4" key={item.id}><div className="font-black">{item.title}</div><div className="text-sm text-[var(--muted)]">{item.startDate}{item.endDate ? ` - ${item.endDate}` : ""}</div></Surface>)}
    </section>
  );
}

function importantDateOccursOn(item: ImportantDate, date: string) {
  return item.repeat === "yearly" ? item.date.slice(5) === date.slice(5) : item.date === date;
}

function eventOccursOn(event: CalendarEvent, date: string) {
  if (!event.endDate) return event.startDate === date;
  return event.startDate <= date && date <= event.endDate;
}

function nextDate(dates: ImportantDate[], selectedDate: string) {
  return [...dates].sort((a, b) => nextOccurrence(a, selectedDate).localeCompare(nextOccurrence(b, selectedDate)))[0];
}

function nextOccurrence(item: ImportantDate, fromDate: string) {
  if (item.repeat === "none") return item.date;
  const year = Number(fromDate.slice(0, 4));
  const candidate = `${year}-${item.date.slice(5)}`;
  return candidate >= fromDate ? candidate : `${year + 1}-${item.date.slice(5)}`;
}

function readableDate(item: ImportantDate, selectedDate: string) {
  const occurrence = nextOccurrence(item, selectedDate);
  return item.repeat === "yearly" ? `${occurrence.slice(8, 10)}.${occurrence.slice(5, 7)} · ежегодно` : occurrence;
}

function CalendarDay({ count, date, faded, selected, onClick }: { count: number; date: string; faded?: boolean; selected: boolean; onClick: () => void }) {
  return (
    <button className={`calendar-day ${selected ? "selected" : ""} ${isToday(date) ? "today" : ""} ${faded ? "opacity-35" : ""}`} onClick={onClick} type="button">
      <span className="text-[10px] font-bold uppercase text-[var(--muted)]">{shortWeekday(date)}</span>
      <span className="text-lg font-black">{Number(date.slice(8, 10))}</span>
      <span className="h-1.5">{count ? <i className="mx-auto block h-1.5 w-1.5 rounded-full bg-current" /> : null}</span>
    </button>
  );
}

function AgendaSection({ emptyAction, entries, members, onComplete, onOpen, spaces, title }: { emptyAction?: () => void; entries: DiaryEntry[]; members: Member[]; onComplete: (entry: DiaryEntry) => void; onOpen: (entry: DiaryEntry) => void; spaces: Space[]; title: string }) {
  if (!entries.length && !emptyAction) return null;
  return (
    <section className="grid gap-2">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-base font-black">{title}</h2>
        {entries.length ? <span className="text-sm font-bold text-[var(--muted)]">{entries.length}</span> : null}
      </div>
      {entries.length ? entries.map((entry) => <EntryCard entry={entry} key={entry.id} members={members} spaces={spaces} onComplete={() => onComplete(entry)} onOpen={() => onOpen(entry)} />) : (
        <Surface className="p-5 text-center">
          <div className="font-black">На выбранный день пусто</div>
          <p className="mt-1 text-sm text-[var(--muted)]">Добавь голосом или текстом.</p>
          <Button className="mt-3 px-4" onClick={emptyAction}>Добавить</Button>
        </Surface>
      )}
    </section>
  );
}
