"use client";

import { CalendarHeart, CheckCircle2, ChevronRight, HeartHandshake, Plus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button, Field, Input, Segmented, Surface } from "@/components/ui/native";
import { EntryCard } from "@/features/entries/EntryCard";
import { calculateBudget } from "@/lib/finance";
import type { AppSettings, CalendarEvent, DiaryEntry, ImportantDate, LoyaltyCard, Member, SharedPlan, Space } from "@/lib/types";

export function UsView({ calendarEvents, importantDates, members, onOpenSettings }: { calendarEvents: CalendarEvent[]; importantDates: ImportantDate[]; members: Member[]; onOpenSettings: () => void }) {
  const nextDate = [...importantDates].sort((a, b) => a.date.localeCompare(b.date))[0];
  return (
    <div className="grid gap-5">
      <Header eyebrow="Общее пространство" title="Мы" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Surface className="couple-stat-card"><b>{daysTogether(importantDates)}</b><span>дней вместе</span></Surface>
        <Surface className="couple-stat-card accent"><b>{daysToAnniversary(importantDates)}</b><span>до годовщины</span></Surface>
      </div>
      <Surface className="summary-panel p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase text-[var(--muted)]">Наши данные</p>
            <h2 className="mt-2 text-xl font-black">{members.map((member) => member.name).join(" + ")}</h2>
          </div>
          <button className="text-sm font-black text-[var(--accent)]" onClick={onOpenSettings} type="button">Смотреть ›</button>
        </div>
        <div className="mt-5 grid grid-cols-4 gap-3">
          <MiniStat label="хотелок" value="0" />
          <MiniStat label="поездок" value="0" />
          <MiniStat label="планов" value="0" />
          <MiniStat label="файлов" value="0" />
        </div>
      </Surface>
      <Surface className="grid gap-3 p-4">
        <div className="flex items-center gap-3"><HeartHandshake size={20} /><h2 className="text-lg font-black">Нас двое</h2></div>
        {members.map((member) => <div className="rounded-2xl bg-black/[.035] p-3" key={member.id}><div className="font-black">{member.avatar} {member.name}</div><div className="text-sm text-[var(--muted)]">{member.role === "owner" ? "Твой профиль" : "Профиль партнёра"}{member.birthday ? ` · ${member.birthday}` : ""}</div></div>)}
      </Surface>
      <Surface className="grid gap-2 p-4">
        <div className="flex items-center gap-3"><CalendarHeart size={20} /><h2 className="text-lg font-black">Ближайшее</h2></div>
        {nextDate ? <p className="font-bold">{nextDate.title} · {nextDate.date}</p> : <p className="text-sm text-[var(--muted)]">Пока нет важных дат.</p>}
        {calendarEvents.slice(0, 3).map((event) => <p className="text-sm text-[var(--muted)]" key={event.id}>{event.title} · {event.startDate}</p>)}
      </Surface>
      <button className="settings-row" onClick={onOpenSettings} type="button"><span>Настройки пары</span><ChevronRight size={22} /></button>
    </div>
  );
}

export function TasksView({ entries, members, spaces, onAdd, onComplete, onOpen }: EntryListProps) {
  const [filter, setFilter] = useOwnerFilter();
  const tasks = entries.filter((entry) => entry.kind === "task" && entry.status !== "done" && matchesAssignee(entry, filter));
  return (
    <div className="grid gap-4">
      <Header action={<IconAddButton label="Добавить задачу" onClick={() => onAdd?.()} />} eyebrow="Ответственность" title="Задачи" />
      <Segmented value={filter} onChange={setFilter} options={[{ label: "Общее", value: "shared" }, { label: memberName(members, "me"), value: "me" }, { label: memberName(members, "partner"), value: "partner" }]} />
      <EntryList entries={tasks} members={members} spaces={spaces} onComplete={onComplete} onOpen={onOpen} emptyAction={onAdd} emptyButton="Добавить задачу" emptyIcon={<CheckCircle2 size={58} />} emptyTitle="Список дел на двоих" empty="Пишите, что нужно сделать. Задачу можно оставить себе или отдать партнёру." />
    </div>
  );
}

export function WorkView({ entries, members, spaces, onAdd, onComplete, onOpen }: EntryListProps) {
  const work = entries.filter((entry) => entry.area === "Работа" || entry.domain === "work" || entry.spaceId === "работа");
  return (
    <div className="grid gap-4">
      <Header action={<IconAddButton label="Добавить" onClick={() => onAdd?.()} />} eyebrow="Твои темы" title="Работа" />
      <EntryList entries={work} members={members} spaces={spaces} onComplete={onComplete} onOpen={onOpen} empty="Рабочих записей пока нет." emptyAction={onAdd} emptyButton="Добавить запись" />
    </div>
  );
}

export function IdeasView({ entries, members, spaces, onAdd, onComplete, onOpen }: EntryListProps) {
  return (
    <div className="grid gap-4">
      <Header action={<IconAddButton label="Добавить" onClick={() => onAdd?.()} />} eyebrow="Наброски" title="Идеи" />
      <EntryList entries={entries.filter((entry) => entry.kind === "idea")} members={members} spaces={spaces} onComplete={onComplete} onOpen={onOpen} empty="Идей пока нет." emptyAction={onAdd} emptyButton="Добавить идею" />
    </div>
  );
}

export function MoneyView({ entries, members, sharedPlans, spaces, onOpen }: { entries: DiaryEntry[]; members: Member[]; sharedPlans: SharedPlan[]; spaces: Space[]; onOpen: (entry: DiaryEntry) => void }) {
  const budget = calculateBudget(entries);
  const moneyEntries = entries.filter((entry) => entry.kind === "purchase");
  return (
    <div className="grid gap-4">
      <Header eyebrow="Пока без заполнения" title="Деньги" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Surface className="summary-card"><span>Покупки</span><b>{budget.planned.toLocaleString("ru-RU")} ₽</b><small>Планируется</small></Surface>
        <Surface className="summary-card"><span>Потрачено</span><b>{budget.actual.toLocaleString("ru-RU")} ₽</b><small>Из покупок</small></Surface>
        <Surface className="summary-card"><span>Планы</span><b>{sharedPlans.length}</b><small>Цели и копилки</small></Surface>
      </div>
      <EntryList entries={moneyEntries} members={members} spaces={spaces} onComplete={() => undefined} onOpen={onOpen} empty="Финансовых записей пока нет." />
    </div>
  );
}

export function CardsOverview({ cards }: { cards: LoyaltyCard[] }) {
  return <Surface className="summary-card"><span>Карты</span><b>{cards.length || "Пока нет"}</b><small>Открываются офлайн</small></Surface>;
}

export function SearchView({ calendarEvents, entries, importantDates, loyaltyCards, members, onChangeQuery, onComplete, onOpen, query, sharedPlans, spaces }: { calendarEvents: CalendarEvent[]; entries: DiaryEntry[]; importantDates: ImportantDate[]; loyaltyCards: LoyaltyCard[]; members: Member[]; onChangeQuery: (query: string) => void; onComplete: (entry: DiaryEntry) => void; onOpen: (entry: DiaryEntry) => void; query: string; sharedPlans: SharedPlan[]; spaces: Space[] }) {
  const needle = query.toLowerCase().trim();
  const results = needle ? entries.filter((entry) => `${entry.title} ${entry.description ?? ""} ${entry.area ?? ""} ${entry.project ?? ""} ${entry.url ?? ""}`.toLowerCase().includes(needle)) : [];
  const familyResults = needle ? [
    ...sharedPlans.filter((item) => matchesText(needle, item.title, item.description, item.type)).map((item) => ({ id: item.id, title: item.title, meta: "Общий план" })),
    ...importantDates.filter((item) => matchesText(needle, item.title, item.personName, item.date)).map((item) => ({ id: item.id, title: item.title, meta: "Важная дата" })),
    ...calendarEvents.filter((item) => matchesText(needle, item.title, item.notes, item.startDate, item.endDate)).map((item) => ({ id: item.id, title: item.title, meta: "Событие" })),
    ...loyaltyCards.filter((item) => matchesText(needle, item.title, item.barcodeValue)).map((item) => ({ id: item.id, title: item.title, meta: "Карта" }))
  ] : [];
  return (
    <div className="grid gap-4">
      <Header eyebrow="По всему дневнику" title="Поиск" />
      <Input autoFocus placeholder="Что ищем?" value={query} onChange={(event) => onChangeQuery(event.target.value)} />
      <EntryList entries={results} members={members} spaces={spaces} onComplete={onComplete} onOpen={onOpen} empty={needle ? "Ничего не нашлось." : "Начни вводить запрос."} />
      {familyResults.map((item) => <Surface className="p-4" key={`${item.meta}-${item.id}`}><div className="font-black">{item.title}</div><div className="text-sm text-[var(--muted)]">{item.meta}</div></Surface>)}
    </div>
  );
}

export function SettingsView({ importantDates, members, onChangeImportantDates, onChangeMembers, onChangeSettings, onClearAll, onClearEntries, onExport, onImport, settings }: { importantDates: ImportantDate[]; members: Member[]; settings: AppSettings; onChangeImportantDates: (dates: ImportantDate[] | ((current: ImportantDate[]) => ImportantDate[])) => void; onChangeMembers: (members: Member[] | ((current: Member[]) => Member[])) => void; onChangeSettings: (settings: AppSettings) => void; onClearAll: () => void; onClearEntries: () => void; onExport: () => void; onImport: (file: File) => void }) {
  return (
    <div className="grid gap-4">
      <Header eyebrow="Мы" title="Настройки пары" />
      <Surface className="pair-settings-card grid gap-4 p-4">
        <h2 className="text-lg font-black">Наши данные</h2>
        {members.map((member) => <MemberEditor key={member.id} member={member} onChange={(patch) => updateMember(member.id, patch, onChangeMembers)} />)}
      </Surface>
      <Surface className="pair-settings-card grid gap-0 overflow-hidden p-0">
        <h2 className="px-4 pb-2 pt-4 text-lg font-black">Наши даты</h2>
        <DateRow label="Вместе с" hint="от неё считаются дни вместе" value={dateValue(importantDates, "Вместе с")} onChange={(date) => upsertImportantDate(onChangeImportantDates, "Вместе с", date, "anniversary")} />
        <DateRow label="Свадьба" hint="если планируете или уже была" value={dateValue(importantDates, "Свадьба")} onChange={(date) => upsertImportantDate(onChangeImportantDates, "Свадьба", date, "anniversary")} />
        <DateRow label="Познакомились" hint="отдельная памятная дата" value={dateValue(importantDates, "Познакомились")} onChange={(date) => upsertImportantDate(onChangeImportantDates, "Познакомились", date, "anniversary")} />
      </Surface>
      <Surface className="grid gap-3 p-4">
        <h2 className="text-lg font-black">Общие</h2>
        <Field label="Валюта"><Input value={settings.defaultCurrency} onChange={(event) => onChangeSettings({ ...settings, defaultCurrency: event.target.value })} /></Field>
        <Field label="Часовой пояс"><Input value={settings.timezone} onChange={(event) => onChangeSettings({ ...settings, timezone: event.target.value })} /></Field>
        <Field label="Внешний вид">
          <Segmented value={settings.appearance} onChange={(appearance) => onChangeSettings({ ...settings, appearance })} options={[{ label: "Система", value: "system" }, { label: "Светлая", value: "light" }, { label: "Тёмная", value: "dark" }]} />
        </Field>
      </Surface>
      <Surface className="grid gap-3 p-4">
        <h2 className="text-lg font-black">Данные</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button onClick={onExport}>Экспорт JSON</Button>
          <label className="button button-plain">
            Импорт JSON
            <input className="hidden" type="file" accept="application/json" onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              onImport(file);
              event.target.value = "";
            }} />
          </label>
          <Button onClick={onClearEntries}>Очистить записи</Button>
          <Button onClick={onClearAll} variant="danger">Очистить всё</Button>
        </div>
      </Surface>
    </div>
  );
}

type EntryListProps = {
  entries: DiaryEntry[];
  members: Member[];
  spaces: Space[];
  onAdd?: () => void;
  onComplete: (entry: DiaryEntry) => void;
  onOpen: (entry: DiaryEntry) => void;
};

function Header({ action, eyebrow, title }: { action?: ReactNode; eyebrow: string; title: string }) {
  return <div className="screen-header"><div><p className="screen-eyebrow">{eyebrow}</p><h1 className="screen-title">{title}</h1></div>{action}</div>;
}

function EntryList({ empty = "Здесь пока пусто.", emptyAction, emptyButton = "Добавить", emptyIcon, emptyTitle = "Пока пусто", entries, members, onComplete, onOpen, spaces }: EntryListProps & { empty?: string; emptyAction?: () => void; emptyButton?: string; emptyIcon?: ReactNode; emptyTitle?: string }) {
  return entries.length ? entries.map((entry) => <EntryCard entry={entry} key={entry.id} members={members} spaces={spaces} onComplete={() => onComplete(entry)} onOpen={() => onOpen(entry)} />) : <Surface className="empty-state p-6 text-center text-sm text-[var(--muted)]">{emptyIcon ? <div className="empty-icon">{emptyIcon}</div> : null}<h2>{emptyTitle}</h2><p>{empty}</p>{emptyAction ? <Button className="empty-cta" variant="primary" onClick={emptyAction}>{emptyButton}</Button> : null}</Surface>;
}

function IconAddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <Button aria-label={label} className="icon-add-button" onClick={onClick}><Plus size={30} /></Button>;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return <div className="mini-stat"><b>{value}</b><span>{label}</span></div>;
}

function matchesAssignee(entry: DiaryEntry, filter: "me" | "shared" | "partner") {
  if (filter === "me") return !entry.assignedTo || entry.assignedTo === "me";
  if (filter === "shared") return entry.assignedTo === "shared" || entry.visibility === "shared";
  return entry.assignedTo === "partner";
}

function matchesText(needle: string, ...values: Array<string | undefined>) {
  return values.filter(Boolean).join(" ").toLowerCase().includes(needle);
}

function useOwnerFilter() {
  return useState<"me" | "shared" | "partner">("shared");
}

function MemberEditor({ member, onChange }: { member: Member; onChange: (patch: Partial<Member>) => void }) {
  return (
    <div className="grid gap-3 rounded-2xl bg-black/[.035] p-3">
      <div>
        <div className="font-black">{member.role === "owner" ? "Твой профиль" : "Профиль партнёра"}</div>
        <div className="text-sm text-[var(--muted)]">{member.avatar} {member.name}</div>
      </div>
      <div className="grid gap-3 sm:grid-cols-[96px_1fr_170px]">
        <Field label="Аватар"><Input maxLength={3} value={member.avatar} onChange={(event) => onChange({ avatar: event.target.value || initials(member.name) })} /></Field>
        <Field label="Имя"><Input value={member.name} onChange={(event) => onChange({ name: event.target.value })} /></Field>
        <Field label="День рождения"><Input type="date" value={member.birthday ?? ""} onChange={(event) => onChange({ birthday: event.target.value || undefined })} /></Field>
      </div>
      <Field label="Заметка"><Input value={member.notes ?? ""} onChange={(event) => onChange({ notes: event.target.value || undefined })} /></Field>
    </div>
  );
}

function updateMember(id: Member["id"], patch: Partial<Member>, onChangeMembers: (members: Member[] | ((current: Member[]) => Member[])) => void) {
  onChangeMembers((current) => current.map((member) => member.id === id ? { ...member, ...patch, updatedAt: new Date().toISOString(), revision: (member.revision ?? 1) + 1 } : member));
}

function memberName(members: Member[], id: Member["id"]) {
  return members.find((member) => member.id === id)?.name || (id === "me" ? "Моё" : "Партнёр");
}

function initials(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "•";
}

function DateRow({ hint, label, onChange, value }: { hint: string; label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="settings-list-row">
      <span><b>{label}</b><small>{hint}</small></span>
      <Input className="settings-date-input" type="date" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function dateValue(dates: ImportantDate[], title: string) {
  return dates.find((item) => item.title === title)?.date ?? "";
}

function upsertImportantDate(onChangeImportantDates: (dates: ImportantDate[] | ((current: ImportantDate[]) => ImportantDate[])) => void, title: string, value: string, type: ImportantDate["type"]) {
  onChangeImportantDates((current) => {
    const existing = current.find((item) => item.title === title);
    if (!value) return current.filter((item) => item.title !== title);
    const now = new Date().toISOString();
    if (existing) {
      return current.map((item) => item.id === existing.id ? { ...item, date: value, repeat: "yearly", type, updatedAt: now, revision: (item.revision ?? 1) + 1 } : item);
    }
    return [{ id: crypto.randomUUID(), title, date: value, repeat: "yearly", type, visibility: "shared", createdBy: "me", updatedBy: "me", createdAt: now, updatedAt: now, revision: 1 }, ...current];
  });
}

function daysTogether(dates: ImportantDate[]) {
  const start = dates.find((item) => item.title === "Вместе с")?.date;
  if (!start) return 0;
  const diff = Date.now() - new Date(`${start}T00:00:00`).getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}

function daysToAnniversary(dates: ImportantDate[]) {
  const start = dates.find((item) => item.title === "Вместе с")?.date;
  if (!start) return 365;
  const now = new Date();
  const monthDay = start.slice(5);
  let next = new Date(`${now.getFullYear()}-${monthDay}T00:00:00`);
  if (Number.isNaN(next.getTime())) return 365;
  if (next.getTime() < now.getTime()) next = new Date(`${now.getFullYear() + 1}-${monthDay}T00:00:00`);
  return Math.max(0, Math.ceil((next.getTime() - now.getTime()) / 86400000));
}
