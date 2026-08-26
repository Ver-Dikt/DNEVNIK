"use client";

import { CalendarHeart, HeartHandshake, Plus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button, Field, Input, Segmented, Surface } from "@/components/ui/native";
import { EntryCard } from "@/features/entries/EntryCard";
import { calculateBudget } from "@/lib/finance";
import type { AppSettings, CalendarEvent, DiaryEntry, ImportantDate, LoyaltyCard, Member, SharedPlan, Space } from "@/lib/types";

export function UsView({ calendarEvents, importantDates, members }: { calendarEvents: CalendarEvent[]; importantDates: ImportantDate[]; members: Member[] }) {
  const birthdays = importantDates.filter((item) => item.type === "birthday");
  const memberBirthdays = members.filter((member) => member.birthday);
  const anniversaries = importantDates.filter((item) => item.type === "anniversary");
  const nextDate = [...importantDates].sort((a, b) => a.date.localeCompare(b.date))[0];
  return (
    <div className="grid gap-4">
      <Header eyebrow="Общее пространство" title="Мы" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Surface className="summary-card"><span>Профили</span><b>{members.map((member) => member.name).join(" + ")}</b><small>Настраиваются в Настройках</small></Surface>
        <Surface className="summary-card"><span>Дни рождения</span><b>{birthdays.length + memberBirthdays.length || "Пока нет"}</b><small>{memberBirthdays.length ? members.filter((member) => member.birthday).map((member) => member.name).join(", ") : "Заполни в Настройках"}</small></Surface>
        <Surface className="summary-card"><span>Годовщины</span><b>{anniversaries.length || "Пока нет"}</b><small>Потом посчитаем дни вместе</small></Surface>
      </div>
      <Surface className="grid gap-3 p-4">
        <div className="flex items-center gap-3"><HeartHandshake size={20} /><h2 className="text-lg font-black">Нас двое</h2></div>
        {members.map((member) => <div className="rounded-2xl bg-black/[.035] p-3" key={member.id}><div className="font-black">{member.avatar} {member.name}</div><div className="text-sm text-[var(--muted)]">{member.role === "owner" ? "Твой профиль" : "Профиль партнёра"}{member.birthday ? ` · ${member.birthday}` : ""}</div></div>)}
      </Surface>
      <Surface className="grid gap-2 p-4">
        <div className="flex items-center gap-3"><CalendarHeart size={20} /><h2 className="text-lg font-black">Ближайшее</h2></div>
        {nextDate ? <p className="font-bold">{nextDate.title} · {nextDate.date}</p> : <p className="text-sm text-[var(--muted)]">Пока нет важных дат.</p>}
        {calendarEvents.slice(0, 3).map((event) => <p className="text-sm text-[var(--muted)]" key={event.id}>{event.title} · {event.startDate}</p>)}
      </Surface>
    </div>
  );
}

export function TasksView({ entries, members, spaces, onAdd, onComplete, onOpen }: EntryListProps) {
  const [filter, setFilter] = useStateFilter();
  const tasks = entries.filter((entry) => entry.kind === "task" && entry.status !== "done" && matchesAssignee(entry, filter));
  return (
    <div className="grid gap-4">
      <Header action={<Button onClick={onAdd}><Plus size={17} />Добавить</Button>} eyebrow="Ответственность" title="Задачи" />
      <Segmented value={filter} onChange={setFilter} options={[{ label: "Все", value: "all" }, { label: memberName(members, "me"), value: "me" }, { label: "Общие", value: "shared" }, { label: memberName(members, "partner"), value: "partner" }]} />
      <EntryList entries={tasks} members={members} spaces={spaces} onComplete={onComplete} onOpen={onOpen} />
    </div>
  );
}

export function WorkView({ entries, members, spaces, onAdd, onComplete, onOpen }: EntryListProps) {
  const work = entries.filter((entry) => entry.area === "Работа" || entry.domain === "work" || entry.spaceId === "работа");
  return (
    <div className="grid gap-4">
      <Header action={<Button onClick={onAdd}><Plus size={17} />Добавить</Button>} eyebrow="Твои темы" title="Работа" />
      <EntryList entries={work} members={members} spaces={spaces} onComplete={onComplete} onOpen={onOpen} empty="Рабочих записей пока нет." />
    </div>
  );
}

export function IdeasView({ entries, members, spaces, onAdd, onComplete, onOpen }: EntryListProps) {
  return (
    <div className="grid gap-4">
      <Header action={<Button onClick={onAdd}><Plus size={17} />Добавить</Button>} eyebrow="Наброски" title="Идеи" />
      <EntryList entries={entries.filter((entry) => entry.kind === "idea")} members={members} spaces={spaces} onComplete={onComplete} onOpen={onOpen} empty="Идей пока нет." />
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

export function SettingsView({ members, onChangeMembers, onChangeSettings, onClearAll, onClearEntries, onExport, onImport, settings }: { members: Member[]; settings: AppSettings; onChangeMembers: (members: Member[] | ((current: Member[]) => Member[])) => void; onChangeSettings: (settings: AppSettings) => void; onClearAll: () => void; onClearEntries: () => void; onExport: () => void; onImport: (file: File) => void }) {
  return (
    <div className="grid gap-4">
      <Header eyebrow="Система" title="Настройки" />
      <Surface className="grid gap-3 p-4">
        <h2 className="text-lg font-black">Общие</h2>
        <Field label="Валюта"><Input value={settings.defaultCurrency} onChange={(event) => onChangeSettings({ ...settings, defaultCurrency: event.target.value })} /></Field>
        <Field label="Часовой пояс"><Input value={settings.timezone} onChange={(event) => onChangeSettings({ ...settings, timezone: event.target.value })} /></Field>
        <Field label="Внешний вид">
          <Segmented value={settings.appearance} onChange={(appearance) => onChangeSettings({ ...settings, appearance })} options={[{ label: "Система", value: "system" }, { label: "Светлая", value: "light" }, { label: "Тёмная", value: "dark" }]} />
        </Field>
      </Surface>
      <Surface className="grid gap-3 p-4">
        <h2 className="text-lg font-black">Мы</h2>
        {members.map((member) => <MemberEditor key={member.id} member={member} onChange={(patch) => updateMember(member.id, patch, onChangeMembers)} />)}
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
  return <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-bold text-[var(--muted)]">{eyebrow}</p><h1 className="text-3xl font-black">{title}</h1></div>{action}</div>;
}

function EntryList({ empty = "Здесь пока пусто.", entries, members, onComplete, onOpen, spaces }: EntryListProps & { empty?: string }) {
  return entries.length ? entries.map((entry) => <EntryCard entry={entry} key={entry.id} members={members} spaces={spaces} onComplete={() => onComplete(entry)} onOpen={() => onOpen(entry)} />) : <Surface className="p-6 text-center text-sm text-[var(--muted)]">{empty}</Surface>;
}

function matchesAssignee(entry: DiaryEntry, filter: "all" | "me" | "shared" | "partner") {
  if (filter === "all") return true;
  if (filter === "me") return !entry.assignedTo || entry.assignedTo === "me";
  return entry.assignedTo === filter;
}

function matchesText(needle: string, ...values: Array<string | undefined>) {
  return values.filter(Boolean).join(" ").toLowerCase().includes(needle);
}

function useStateFilter() {
  return useState<"all" | "me" | "shared" | "partner">("all");
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
