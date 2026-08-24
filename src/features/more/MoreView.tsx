"use client";

import { Archive, Lightbulb, Search, Settings, WalletCards } from "lucide-react";
import { Button, Field, Input, Segmented, Surface } from "@/components/ui/native";
import { EntryCard } from "@/features/entries/EntryCard";
import { WishlistView } from "@/features/wishlist/WishlistView";
import { calculateBudget } from "@/lib/finance";
import type { AppSettings, DiaryEntry, Member, Space } from "@/lib/types";
import type { MoreSection, ScreenId } from "@/features/app/types";

export function MoreView({
  activeSection,
  entries,
  members,
  query,
  settings,
  spaces,
  onChangeQuery,
  onChangeSection,
  onChangeSettings,
  onClearAll,
  onClearEntries,
  onComplete,
  onExport,
  onImport,
  onNavigate,
  onOpenEntry
}: {
  activeSection: MoreSection;
  entries: DiaryEntry[];
  members: Member[];
  query: string;
  settings: AppSettings;
  spaces: Space[];
  onChangeQuery: (query: string) => void;
  onChangeSection: (section: MoreSection) => void;
  onChangeSettings: (settings: AppSettings) => void;
  onClearAll: () => void;
  onClearEntries: () => void;
  onComplete: (entry: DiaryEntry) => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onNavigate: (screen: ScreenId) => void;
  onOpenEntry: (entry: DiaryEntry) => void;
}) {
  if (activeSection === "wishlist") return <WishlistView entries={entries} spaces={spaces} onComplete={onComplete} onOpen={onOpenEntry} />;
  if (activeSection === "ideas") return <EntryList title="Идеи" entries={entries.filter((entry) => entry.kind === "idea")} spaces={spaces} onComplete={onComplete} onOpenEntry={onOpenEntry} />;
  if (activeSection === "review") return <EntryList title="Разобрать" entries={entries.filter((entry) => entry.needsReview || entry.kind === "inbox")} spaces={spaces} onComplete={onComplete} onOpenEntry={onOpenEntry} />;
  if (activeSection === "archive") return <EntryList title="Архив" entries={entries.filter((entry) => entry.status === "done" || entry.status === "bought" || entry.status === "cancelled")} spaces={spaces} onComplete={onComplete} onOpenEntry={onOpenEntry} />;
  if (activeSection === "money") return <MoneyView entries={entries} spaces={spaces} onOpenEntry={onOpenEntry} />;
  if (activeSection === "search") return <SearchView entries={entries} query={query} spaces={spaces} onChangeQuery={onChangeQuery} onComplete={onComplete} onOpenEntry={onOpenEntry} />;
  if (activeSection === "settings") return <SettingsView members={members} settings={settings} onChangeSettings={onChangeSettings} onClearAll={onClearAll} onClearEntries={onClearEntries} onExport={onExport} onImport={onImport} />;

  const reviewCount = entries.filter((entry) => entry.needsReview || entry.kind === "inbox").length;
  return (
    <div className="grid gap-4">
      <div>
        <p className="text-sm font-bold text-[var(--muted)]">Дополнительно</p>
        <h1 className="text-3xl font-black">Ещё</h1>
      </div>
      <div className="grid gap-2">
        <MoreButton title="Хотелки" detail="Сохранённые вещи на будущее" icon={<Archive size={20} />} onClick={() => onChangeSection("wishlist")} />
        <MoreButton title="Идеи" detail="Мысли и наброски" icon={<Lightbulb size={20} />} onClick={() => onChangeSection("ideas")} />
        <MoreButton title="Деньги" detail="Планируемые траты и покупки" icon={<WalletCards size={20} />} onClick={() => onChangeSection("money")} />
        <MoreButton title={reviewCount ? `Разобрать · ${reviewCount}` : "Разобрать"} detail="То, что парсер не понял уверенно" icon={<Archive size={20} />} onClick={() => onChangeSection("review")} />
        <MoreButton title="Поиск" detail="Найти запись, проект или ссылку" icon={<Search size={20} />} onClick={() => onChangeSection("search")} />
        <MoreButton title="Архив" detail="Готовое и старое" icon={<Archive size={20} />} onClick={() => onChangeSection("archive")} />
        <MoreButton title="Настройки" detail="Совместное, ввод, данные" icon={<Settings size={20} />} onClick={() => onChangeSection("settings")} />
      </div>
      <Button className="font-bold" onClick={() => onNavigate("plan")}>Вернуться в план</Button>
    </div>
  );
}

function MoreButton({ detail, icon, onClick, title }: { detail: string; icon: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button className="text-left" onClick={onClick} type="button">
      <Surface className="flex items-center gap-3 p-4">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-black/[.045]">{icon}</span>
        <span className="min-w-0">
          <span className="block text-lg font-black">{title}</span>
          <span className="block text-sm text-[var(--muted)]">{detail}</span>
        </span>
      </Surface>
    </button>
  );
}

function EntryList({ entries, onComplete, onOpenEntry, spaces, title }: { entries: DiaryEntry[]; onComplete: (entry: DiaryEntry) => void; onOpenEntry: (entry: DiaryEntry) => void; spaces: Space[]; title: string }) {
  return (
    <div className="grid gap-4">
      <h1 className="text-3xl font-black">{title}</h1>
      {entries.length ? entries.map((entry) => <EntryCard entry={entry} key={entry.id} spaces={spaces} onComplete={() => onComplete(entry)} onOpen={() => onOpenEntry(entry)} />) : <Surface className="p-6 text-center text-sm text-[var(--muted)]">Здесь пока пусто.</Surface>}
    </div>
  );
}

function SearchView({ entries, onChangeQuery, onComplete, onOpenEntry, query, spaces }: { entries: DiaryEntry[]; onChangeQuery: (query: string) => void; onComplete: (entry: DiaryEntry) => void; onOpenEntry: (entry: DiaryEntry) => void; query: string; spaces: Space[] }) {
  const needle = query.toLowerCase().trim();
  const results = needle ? entries.filter((entry) => `${entry.title} ${entry.description ?? ""} ${entry.area ?? ""} ${entry.project ?? ""} ${entry.url ?? ""}`.toLowerCase().includes(needle)) : [];
  return (
    <div className="grid gap-4">
      <h1 className="text-3xl font-black">Поиск</h1>
      <Input autoFocus placeholder="Что ищем?" value={query} onChange={(event) => onChangeQuery(event.target.value)} />
      {results.map((entry) => <EntryCard entry={entry} key={entry.id} spaces={spaces} onComplete={() => onComplete(entry)} onOpen={() => onOpenEntry(entry)} />)}
      {needle && !results.length ? <Surface className="p-6 text-center text-sm text-[var(--muted)]">Ничего не нашлось.</Surface> : null}
    </div>
  );
}

function MoneyView({ entries, onOpenEntry, spaces }: { entries: DiaryEntry[]; onOpenEntry: (entry: DiaryEntry) => void; spaces: Space[] }) {
  const budget = calculateBudget(entries);
  const moneyEntries = entries.filter((entry) => entry.kind === "purchase" || entry.kind === "wish");
  return (
    <div className="grid gap-4">
      <h1 className="text-3xl font-black">Деньги</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        <Surface className="p-4"><div className="text-sm text-[var(--muted)]">Планируется</div><div className="text-3xl font-black">{budget.planned.toLocaleString("ru-RU")} ₽</div></Surface>
        <Surface className="p-4"><div className="text-sm text-[var(--muted)]">Потрачено</div><div className="text-3xl font-black">{budget.actual.toLocaleString("ru-RU")} ₽</div></Surface>
      </div>
      {moneyEntries.map((entry) => <EntryCard entry={entry} key={entry.id} spaces={spaces} onComplete={() => undefined} onOpen={() => onOpenEntry(entry)} />)}
    </div>
  );
}

function SettingsView({ members, onChangeSettings, onClearAll, onClearEntries, onExport, onImport, settings }: { members: Member[]; settings: AppSettings; onChangeSettings: (settings: AppSettings) => void; onClearAll: () => void; onClearEntries: () => void; onExport: () => void; onImport: (file: File) => void }) {
  return (
    <div className="grid gap-4">
      <h1 className="text-3xl font-black">Настройки</h1>
      <Surface className="grid gap-3 p-4">
        <h2 className="text-lg font-black">Общие</h2>
        <Field label="Валюта"><Input value={settings.defaultCurrency} onChange={(event) => onChangeSettings({ ...settings, defaultCurrency: event.target.value })} /></Field>
        <Field label="Часовой пояс"><Input value={settings.timezone} onChange={(event) => onChangeSettings({ ...settings, timezone: event.target.value })} /></Field>
        <Field label="Внешний вид">
          <Segmented value={settings.appearance} onChange={(appearance) => onChangeSettings({ ...settings, appearance })} options={[{ label: "Система", value: "system" }, { label: "Светлая", value: "light" }, { label: "Тёмная", value: "dark" }]} />
        </Field>
      </Surface>
      <Surface className="grid gap-3 p-4">
        <h2 className="text-lg font-black">Совместное</h2>
        {members.map((member) => <div className="rounded-2xl bg-black/[.035] p-3" key={member.id}><div className="font-black">{member.avatar} {member.name}</div><div className="text-sm text-[var(--muted)]">{member.role === "owner" ? "Основной профиль" : "Партнёр"}</div></div>)}
      </Surface>
      <Surface className="grid gap-3 p-4">
        <h2 className="text-lg font-black">Ввод и распознавание</h2>
        <label className="flex items-center justify-between gap-3"><span className="font-bold">Автосохранение после разбора</span><input checked={settings.autoSaveAfterParse} type="checkbox" onChange={(event) => onChangeSettings({ ...settings, autoSaveAfterParse: event.target.checked })} /></label>
        <label className="flex items-center justify-between gap-3"><span className="font-bold">Запоминать исправления</span><input checked={settings.learnFromCorrections} type="checkbox" onChange={(event) => onChangeSettings({ ...settings, learnFromCorrections: event.target.checked })} /></label>
      </Surface>
      <Surface className="grid gap-3 p-4">
        <h2 className="text-lg font-black">Данные</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button onClick={onExport}>Экспорт JSON</Button>
          <label className="button button-plain">
            Импорт JSON
            <input className="hidden" type="file" accept="application/json" onChange={(event) => event.target.files?.[0] ? onImport(event.target.files[0]) : undefined} />
          </label>
          <Button onClick={onClearEntries}>Очистить записи</Button>
          <Button onClick={onClearAll} variant="danger">Очистить всё</Button>
        </div>
      </Surface>
    </div>
  );
}
