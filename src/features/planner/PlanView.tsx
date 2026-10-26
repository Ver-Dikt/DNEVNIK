"use client";

import { CalendarDays, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { useRef, useState } from "react";
import { Button, Segmented, Surface } from "@/components/ui/native";
import { EntryCard } from "@/features/entries/EntryCard";
import { useModalLayer } from "@/hooks/use-modal-layer";
import { addDays, addMonths, formatHeaderDate, formatMonth, getMonthGrid, getWeekDays, isToday, sameMonth, shortWeekday } from "@/features/shared/date-utils";
import { matchesOwner } from "@/features/shared/entry-utils";
import { nextOccurrence } from "@/lib/important-dates";
import { todayIso } from "@/lib/dates";
import type { CalendarEvent, DiaryEntry, ImportantDate, Member, PlanTransaction, SharedPlan, Space } from "@/lib/types";

type Props = {
  entries: DiaryEntry[]; calendarEvents: CalendarEvent[]; importantDates: ImportantDate[];
  members: Member[]; planTransactions: PlanTransaction[]; sharedPlans: SharedPlan[]; spaces: Space[];
  ownerFilter: "me" | "partner" | "shared"; mode: "day" | "week" | "month"; selectedDate: string;
  onModeChange: (mode: "day" | "week" | "month") => void; onDateChange: (date: string) => void;
  onOwnerFilterChange: (filter: "me" | "partner" | "shared") => void;
  onComplete: (entry: DiaryEntry) => void; onOpen: (entry: DiaryEntry) => void; onAdd: () => void;
};

export function PlanView(props: Props) {
  const { entries, calendarEvents, importantDates, members, spaces, ownerFilter, mode, selectedDate, onModeChange, onDateChange, onOwnerFilterChange, onComplete, onOpen, onAdd } = props;
  const [openedDate, setOpenedDate] = useState<string | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const active = entries.filter(entry => !["done", "bought", "cancelled"].includes(entry.status) && matchesOwner(entry, ownerFilter));
  const belongs = (item: ImportantDate | CalendarEvent) => item.visibility === "shared" ? ownerFilter === "shared" : ownerFilter !== "shared" && item.createdBy === (ownerFilter === "partner" ? "partner" : "me");
  const birthdays: ImportantDate[] = members.filter(member => member.birthday && !importantDates.some(item => item.type === "birthday" && item.date === member.birthday)).map(member => ({ id: `member-birthday-${member.id}`, title: `День рождения · ${member.name}`, date: member.birthday!, type: "birthday", repeat: "yearly", createdBy: "me", visibility: "shared", revision: 1, createdAt: member.createdAt, updatedAt: member.updatedAt ?? member.createdAt }));
  const dates = [...importantDates, ...birthdays].filter(belongs);
  const events = calendarEvents.filter(belongs);
  const entriesOn = (date: string) => active.filter(entry => entry.dueDate === date).sort((a, b) => (a.time ?? "99:99").localeCompare(b.time ?? "99:99"));
  const datesOn = (date: string) => dates.filter(item => nextOccurrence(item, date) === date);
  const eventsOn = (date: string) => events.filter(event => event.startDate <= date && date <= (event.endDate ?? event.startDate));
  const countOn = (date: string) => entriesOn(date).length + datesOn(date).length + eventsOn(date).length;
  const days = mode === "month" ? getMonthGrid(selectedDate) : getWeekDays(selectedDate);
  const weekDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString("ru-RU", { day: "numeric", month: "short", ...(days[0].slice(0, 4) !== days[6].slice(0, 4) ? { year: "numeric" } : {}) });
  const weekLabel = `${weekDate(days[0])} – ${weekDate(days[6])}${days[0].slice(0, 4) === days[6].slice(0, 4) ? ` ${days[6].slice(0, 4)}` : ""}`;
  function shift(direction: number) { onDateChange(mode === "month" ? addMonths(selectedDate, direction) : addDays(selectedDate, direction * (mode === "week" ? 7 : 1))); }
  function openDate(date: string) { onDateChange(date); setOpenedDate(date); }

  return <div className="calendar-view">
    <div className="screen-header"><div><p className="screen-eyebrow">Время для важного</p><h1 className="screen-title">Календарь</h1></div><button aria-label="Добавить событие" className="icon-control" onClick={onAdd} type="button"><Plus size={23} /></button></div>
    <Segmented value={ownerFilter} onChange={onOwnerFilterChange} options={[{ label: "Моё", value: "me" }, { label: "Партнёра", value: "partner" }, { label: "Общее", value: "shared" }]} />
    <Surface className="calendar-panel" onTouchStart={event => { touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }} onTouchEnd={event => {
      const start = touchStart.current; touchStart.current = null;
      if (!start) return;
      const dx = event.changedTouches[0].clientX - start.x, dy = event.changedTouches[0].clientY - start.y;
      if (Math.abs(dx) > 64 && Math.abs(dy) < Math.abs(dx) / 2) shift(dx > 0 ? -1 : 1);
    }}>
      <div className="calendar-mode"><Segmented options={[{ label: "День", value: "day" }, { label: "Неделя", value: "week" }, { label: "Месяц", value: "month" }]} value={mode} onChange={onModeChange} /></div>
      <div className="calendar-period"><Button aria-label="Предыдущий период" onClick={() => shift(-1)}><ChevronLeft size={19} /></Button><h2>{mode === "day" ? formatHeaderDate(selectedDate) : mode === "week" ? weekLabel : formatMonth(selectedDate)}</h2><Button aria-label="Следующий период" onClick={() => shift(1)}><ChevronRight size={19} /></Button></div>
      {mode === "day" ? <div className="calendar-focus-day"><CalendarDays size={27} /><span>{shortWeekday(selectedDate)}</span><strong>{Number(selectedDate.slice(8))}</strong><p>{countOn(selectedDate) ? `На эту дату: ${countOn(selectedDate)}` : "Свободный день"}</p><Button variant="primary" onClick={() => openDate(selectedDate)}>Открыть день</Button><label>Выбрать дату<input className="input" type="date" aria-label="Выбрать дату" value={selectedDate} onChange={event => { if (event.target.value) onDateChange(event.target.value); }} /></label></div> : <>
        <div className="calendar-week-labels">{["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map(day => <span key={day}>{day}</span>)}</div>
        <div className={`calendar-grid is-${mode}`} aria-label={mode === "week" ? "Сетка недели" : "Сетка месяца"}>
          {days.map(date => <button type="button" key={date} aria-label={`${formatHeaderDate(date)} — ${countOn(date) ? `записей: ${countOn(date)}` : "нет записей"}`} aria-current={isToday(date) ? "date" : undefined} aria-pressed={date === selectedDate} className={`calendar-cell ${date === selectedDate ? "is-selected" : ""} ${isToday(date) ? "is-today" : ""} ${!sameMonth(date, selectedDate) ? "is-outside" : ""}`} onClick={() => openDate(date)}><span>{Number(date.slice(8))}</span><i aria-hidden="true" className={`calendar-dot ${countOn(date) ? "" : "empty"}`} />{mode === "week" ? <small>{countOn(date) || "—"}</small> : null}</button>)}
        </div>
      </>}
      <div className="calendar-footer"><span><i className="calendar-dot" /> Есть дела или события</span><Button onClick={() => onDateChange(todayIso())}>Сегодня</Button></div>
    </Surface>
    <p className="calendar-hint">Нажмите на дату, чтобы увидеть её дела. Записи без даты остаются в своих разделах.</p>
    {openedDate ? <DaySheet date={openedDate} entries={entriesOn(openedDate)} dates={datesOn(openedDate)} events={eventsOn(openedDate)} members={members} spaces={spaces} onClose={() => setOpenedDate(null)} onComplete={onComplete} onOpen={entry => { setOpenedDate(null); onOpen(entry); }} onAdd={() => { setOpenedDate(null); onAdd(); }} /> : null}
  </div>;
}

function DaySheet({ date, entries, dates, events, members, spaces, onClose, onComplete, onOpen, onAdd }: { date: string; entries: DiaryEntry[]; dates: ImportantDate[]; events: CalendarEvent[]; members: Member[]; spaces: Space[]; onClose: () => void; onComplete: (entry: DiaryEntry) => void; onOpen: (entry: DiaryEntry) => void; onAdd: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  useModalLayer(root, onClose);
  return <div ref={root} className="app-overlay z-[80]" onClick={onClose}><Surface role="dialog" aria-modal="true" aria-label="Дела на выбранную дату" className="app-dialog day-sheet" onClick={event => event.stopPropagation()}><div className="dialog-heading"><div><p className="screen-eyebrow">План дня</p><h2>{formatHeaderDate(date)}</h2></div><button className="icon-control" aria-label="Закрыть день" onClick={onClose} type="button"><X size={20} /></button></div><div className="day-agenda">
    {dates.map(item => <div className="calendar-event" key={item.id}><CalendarDays size={19} /><div><b>{item.title}</b><small>{item.type === "birthday" ? "День рождения" : "Памятная дата"}</small></div></div>)}
    {events.map(item => <div className="calendar-event" key={item.id}><CalendarDays size={19} /><div><b>{item.title}</b><small>{item.startTime ?? "Весь день"}</small></div></div>)}
    {entries.map(entry => <EntryCard key={entry.id} entry={entry} members={members} spaces={spaces} onComplete={() => onComplete(entry)} onOpen={() => onOpen(entry)} />)}
    {!entries.length && !dates.length && !events.length ? <div className="day-empty"><CalendarDays size={36} /><h3>Этот день свободен</h3><p>Можно оставить время для себя или добавить дело.</p></div> : null}
    <Button variant="primary" onClick={onAdd}><Plus size={18} />Добавить на этот день</Button>
  </div></Surface></div>;
}
