"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useRef } from "react";
import { Button, Segmented, Surface } from "@/components/ui/native";
import { EntryCard } from "@/features/entries/EntryCard";
import { addDays, addMonths, formatHeaderDate, formatMonth, getMonthGrid, getWeekDays, isPast, isToday, sameMonth, shortWeekday } from "@/features/shared/date-utils";
import { matchesOwner } from "@/features/shared/entry-utils";
import type { DiaryEntry, Space } from "@/lib/types";

export function PlanView({
  entries,
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
  spaces: Space[];
  ownerFilter: "all" | "me" | "shared";
  mode: "day" | "week" | "month";
  selectedDate: string;
  onModeChange: (mode: "day" | "week" | "month") => void;
  onDateChange: (date: string) => void;
  onOwnerFilterChange: (filter: "all" | "me" | "shared") => void;
  onComplete: (entry: DiaryEntry) => void;
  onOpen: (entry: DiaryEntry) => void;
  onAdd: () => void;
}) {
  const touchStart = useRef<number | null>(null);
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

  const dated = activeEntries.filter((entry) => entry.dueDate === selectedDate).sort((a, b) => (a.time ?? "99:99").localeCompare(b.time ?? "99:99"));
  const timed = dated.filter((entry) => entry.time);
  const untimed = dated.filter((entry) => !entry.time);
  const purchases = dated.filter((entry) => entry.kind === "purchase");
  const overdue = activeEntries.filter((entry) => isPast(entry.dueDate));
  const unscheduled = activeEntries.filter((entry) => !entry.dueDate && entry.schedule === "none");
  const someday = activeEntries.filter((entry) => entry.schedule === "someday");

  function shift(direction: number) {
    onDateChange(mode === "month" ? addMonths(selectedDate, direction) : addDays(selectedDate, direction * 7));
  }

  function handleTouchEnd(clientX: number) {
    if (touchStart.current === null) return;
    const delta = clientX - touchStart.current;
    touchStart.current = null;
    if (Math.abs(delta) < 54) return;
    shift(delta > 0 ? -1 : 1);
  }

  return (
    <div className="grid gap-4" onTouchStart={(event) => (touchStart.current = event.touches[0].clientX)} onTouchEnd={(event) => handleTouchEnd(event.changedTouches[0].clientX)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[var(--muted)]">План</p>
          <h1 className="text-3xl font-black leading-tight">{formatHeaderDate(selectedDate)}</h1>
        </div>
        <Segmented
          onChange={onOwnerFilterChange}
          options={[
            { label: "Все", value: "all" },
            { label: "Моё", value: "me" },
            { label: "Общее", value: "shared" }
          ]}
          value={ownerFilter}
        />
      </div>

      <Surface className="grid gap-3 p-3">
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
              {monthDays.map((date) => <CalendarDay count={entriesByDate.get(date)?.length ?? 0} date={date} faded={!sameMonth(date, selectedDate)} key={date} selected={date === selectedDate} onClick={() => { onDateChange(date); onModeChange("day"); }} />)}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {weekDays.map((date) => <CalendarDay count={entriesByDate.get(date)?.length ?? 0} date={date} key={date} selected={date === selectedDate} onClick={() => onDateChange(date)} />)}
          </div>
        )}
      </Surface>

      <AgendaSection title="По времени" entries={timed} spaces={spaces} onComplete={onComplete} onOpen={onOpen} />
      <AgendaSection title="Без времени" entries={untimed} spaces={spaces} onComplete={onComplete} onOpen={onOpen} emptyAction={onAdd} />
      <AgendaSection title="Покупки на дату" entries={purchases} spaces={spaces} onComplete={onComplete} onOpen={onOpen} />
      <AgendaSection title="Просрочено" entries={overdue} spaces={spaces} onComplete={onComplete} onOpen={onOpen} />
      <AgendaSection title="Без даты" entries={unscheduled} spaces={spaces} onComplete={onComplete} onOpen={onOpen} />
      <AgendaSection title="Когда-нибудь" entries={someday} spaces={spaces} onComplete={onComplete} onOpen={onOpen} />
    </div>
  );
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

function AgendaSection({ emptyAction, entries, onComplete, onOpen, spaces, title }: { emptyAction?: () => void; entries: DiaryEntry[]; onComplete: (entry: DiaryEntry) => void; onOpen: (entry: DiaryEntry) => void; spaces: Space[]; title: string }) {
  if (!entries.length && !emptyAction) return null;
  return (
    <section className="grid gap-2">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-base font-black">{title}</h2>
        {entries.length ? <span className="text-sm font-bold text-[var(--muted)]">{entries.length}</span> : null}
      </div>
      {entries.length ? entries.map((entry) => <EntryCard entry={entry} key={entry.id} spaces={spaces} onComplete={() => onComplete(entry)} onOpen={() => onOpen(entry)} />) : (
        <Surface className="p-5 text-center">
          <div className="font-black">На выбранный день пусто</div>
          <p className="mt-1 text-sm text-[var(--muted)]">Добавь голосом или текстом.</p>
          <Button className="mt-3 px-4" onClick={emptyAction}>Добавить</Button>
        </Surface>
      )}
    </section>
  );
}
