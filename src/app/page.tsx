"use client";

import {
  Archive,
  CalendarDays,
  Check,
  Circle,
  Clock3,
  Inbox,
  Lightbulb,
  Mic,
  MoreHorizontal,
  Plus,
  Search,
  ShoppingCart,
  Sparkles,
  Trash2,
  Undo2,
  WalletCards
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createEntryFromParsed } from "@/lib/mock-ai";
import { confidenceLabel } from "@/lib/smart-parser/confidence";
import { formatDateRu, isOverdue, isThisWeek, todayIso } from "@/lib/dates";
import { loadLearnedRules, rememberIntentRule, saveLearnedRules } from "@/lib/smart-parser/learned-rules";
import { defaultSettings, loadEntries, loadSettings, saveEntries, saveSettings } from "@/lib/storage";
import { GlassBadge, GlassButton, GlassCard, GlassInput, GlassPanel, GlassSegmentedControl, GlassTextarea } from "@/components/glass";
import type { AIParseResult, AIQueryResult, AppSettings, DiaryEntry, EntryKind, ProjectNode, SchedulePreset } from "@/lib/types";
import type { LearnedRule } from "@/lib/smart-parser/types";

type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
};

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const tabs = [
  { id: "today", label: "Сегодня", icon: CalendarDays },
  { id: "week", label: "Неделя", icon: Clock3 },
  { id: "tasks", label: "Задачи", icon: Check },
  { id: "projects", label: "Проекты", icon: Archive },
  { id: "purchases", label: "Покупки", icon: ShoppingCart },
  { id: "ideas", label: "Идеи", icon: Lightbulb },
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "settings", label: "Ещё", icon: MoreHorizontal }
] as const;

type TabId = (typeof tabs)[number]["id"];

const kindLabel: Record<EntryKind, string> = {
  task: "Задача",
  purchase: "Покупка",
  idea: "Идея",
  inbox: "Inbox"
};

const kindTone: Record<EntryKind, string> = {
  task: "text-blue-700 dark:text-blue-200",
  purchase: "text-emerald-700 dark:text-emerald-200",
  idea: "text-fuchsia-700 dark:text-fuchsia-200",
  inbox: "text-zinc-700 dark:text-zinc-200"
};

export default function Home() {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [learnedRules, setLearnedRules] = useState<LearnedRule[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>("today");
  const [quickText, setQuickText] = useState("");
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<AIQueryResult | null>(null);
  const [preview, setPreview] = useState<AIParseResult | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [voiceMessage, setVoiceMessage] = useState("");
  const [undoEntry, setUndoEntry] = useState<DiaryEntry | null>(null);
  const [listMode, setListMode] = useState<"this" | "next">("this");
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const keepListeningRef = useRef(false);
  const voiceBaseTextRef = useRef("");
  const latestQuickTextRef = useRef("");

  useEffect(() => {
    // localStorage is only available after hydration; this keeps server render deterministic.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEntries(loadEntries());
    setSettings(loadSettings());
    setLearnedRules(loadLearnedRules());
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    setSpeechSupported(Boolean(window.SpeechRecognition || window.webkitSpeechRecognition));
  }, []);

  useEffect(() => {
    if (entries.length) saveEntries(entries);
  }, [entries]);

  useEffect(() => {
    latestQuickTextRef.current = quickText;
  }, [quickText]);

  const projects = useMemo<ProjectNode[]>(() => {
    const names = new Map<string, ProjectNode>();
    for (const entry of entries) {
      for (const name of entry.projectPath) {
        if (!names.has(name)) {
          names.set(name, { id: name, name, aliases: [], createdAt: entry.createdAt });
        }
      }
    }
    return [...names.values()];
  }, [entries]);

  const activeEntries = entries.filter((entry) => entry.status !== "done" && entry.status !== "cancelled");
  const todayEntries = activeEntries.filter((entry) => entry.dueDate === todayIso() || entry.schedule === "today" || isOverdue(entry.dueDate));
  const importantEntries = activeEntries.filter((entry) => entry.priority === "high");
  const purchaseTotal = activeEntries.filter((entry) => entry.kind === "purchase").reduce((sum, entry) => sum + (entry.totalPrice ?? entry.unitPrice ?? 0), 0);

  const visibleEntries = useMemo(() => {
    const base = entries.filter((entry) => entry.status !== "cancelled");
    if (activeTab === "today") {
      return base.filter(
        (entry) =>
          entry.status !== "done" &&
          (entry.dueDate === todayIso() || entry.schedule === "today" || isOverdue(entry.dueDate) || entry.priority === "high")
      );
    }
    if (activeTab === "week") {
      return base.filter((entry) =>
        listMode === "this" ? entry.schedule === "this_week" || isThisWeek(entry.dueDate) : entry.schedule === "next_week"
      );
    }
    if (activeTab === "tasks") return base.filter((entry) => entry.kind === "task");
    if (activeTab === "purchases") return base.filter((entry) => entry.kind === "purchase");
    if (activeTab === "ideas") return base.filter((entry) => entry.kind === "idea");
    if (activeTab === "inbox") return base.filter((entry) => entry.kind === "inbox" || entry.needsReview);
    if (activeTab === "projects") return base.filter((entry) => entry.projectPath.length);
    return base;
  }, [activeTab, entries, listMode]);

  async function parseQuickText() {
    const text = quickText.trim();
    if (!text) return;
    setIsParsing(true);
    setPreview(null);
    try {
      const response = await fetch("/api/ai/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, timezone: settings.timezone, learnedRules, projects })
      });
      if (!response.ok) throw new Error("parse failed");
      setPreview((await response.json()) as AIParseResult);
    } catch {
      const now = new Date().toISOString();
      addEntries([
        {
          id: crypto.randomUUID(),
          kind: "inbox",
          title: text.slice(0, 86),
          description: text,
          projectPath: [],
          status: "active",
          priority: "normal",
          schedule: "none",
          needsReview: true,
          sourceText: text,
          originalInput: text,
          parsedBy: "manual",
          confidence: 0.2,
          createdAt: now,
          updatedAt: now
        }
      ]);
      setQuickText("");
    } finally {
      setIsParsing(false);
    }
  }

  function toggleVoiceInput() {
    if (isListening) {
      keepListeningRef.current = false;
      recognitionRef.current?.stop();
      setIsListening(false);
      setVoiceMessage("Остановлено. Можно проверить текст и разобрать.");
      return;
    }

    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      setSpeechSupported(false);
      setVoiceMessage("Этот браузер не поддерживает голосовой ввод. Можно ввести текст вручную.");
      return;
    }

    keepListeningRef.current = true;
    voiceBaseTextRef.current = quickText.trim();
    startVoiceRecognition(Recognition);
  }

  function startVoiceRecognition(Recognition: SpeechRecognitionConstructor) {
    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.lang = "ru-RU";
    recognition.interimResults = true;
    recognition.continuous = true;
    setVoiceMessage("Слушаю... можно делать паузы.");

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => {
      recognitionRef.current = null;
      if (keepListeningRef.current) {
        voiceBaseTextRef.current = latestQuickTextRef.current.trim();
        window.setTimeout(() => {
          if (keepListeningRef.current) startVoiceRecognition(Recognition);
        }, 250);
        return;
      }
      setIsListening(false);
    };
    recognition.onerror = (event) => {
      keepListeningRef.current = false;
      setIsListening(false);
      recognitionRef.current = null;
      setVoiceMessage(
        event.error === "not-allowed"
          ? "Доступ к микрофону запрещен. Разреши микрофон в браузере или введи текст вручную."
          : "Не удалось распознать речь. Текстовый ввод остается доступен."
      );
    };
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join(" ")
        .trim();
      if (transcript) {
        const prefix = voiceBaseTextRef.current;
        const nextText = prefix ? `${prefix} ${transcript}` : transcript;
        latestQuickTextRef.current = nextText;
        setQuickText(nextText);
      }
    };

    try {
      recognition.start();
    } catch {
      setVoiceMessage("Голосовой ввод уже запускается. Подожди секунду и попробуй снова.");
    }
  }

  function addManual(kind: EntryKind) {
    const now = new Date().toISOString();
    const text = quickText.trim();
    addEntries([
      {
        id: crypto.randomUUID(),
        kind,
        title: text || "Новая запись",
        description: text,
        projectPath: [],
        status: kind === "purchase" ? "want_to_buy" : "active",
        priority: "normal",
        schedule: "none",
        originalInput: text,
        parsedBy: "manual",
        confidence: 1,
        createdAt: now,
        updatedAt: now
      }
    ]);
    setQuickText("");
  }

  function addEntries(next: DiaryEntry[]) {
    setEntries((current) => [...next, ...current]);
  }

  function savePreview() {
    if (!preview) return;
    addEntries(preview.items.map(createEntryFromParsed));
    setPreview(null);
    setQuickText("");
  }

  function updatePreviewKind(index: number, kind: EntryKind) {
    if (!preview) return;
    setPreview({
      ...preview,
      items: preview.items.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              kind,
              status: kind === "purchase" ? "want_to_buy" : "active"
            }
          : item
      )
    });
  }

  function rememberRule(index: number) {
    const item = preview?.items[index];
    if (!item?.sourceText) return;
    const phrase = item.sourceText.slice(0, 48).toLowerCase();
    const rule = rememberIntentRule(phrase, item.kind);
    const next = [rule, ...learnedRules].slice(0, 80);
    setLearnedRules(next);
    saveLearnedRules(next);
  }

  async function askDiary() {
    const value = query.trim();
    if (!value) return;
    const response = await fetch("/api/ai/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: value, entries })
    });
    setAnswer((await response.json()) as AIQueryResult);
  }

  function completeEntry(entry: DiaryEntry) {
    const completed = { ...entry, status: "done" as const, completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setUndoEntry(entry);
    setEntries((current) => current.map((item) => (item.id === entry.id ? completed : item)));
  }

  function updateEntry(id: string, patch: Partial<DiaryEntry>) {
    setEntries((current) => current.map((item) => (item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item)));
  }

  function deleteEntry(id: string) {
    setEntries((current) => current.filter((item) => item.id !== id));
  }

  function updateSettings(next: AppSettings) {
    setSettings(next);
    saveSettings(next);
  }

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-7xl gap-5 px-4 pb-28 pt-4 md:grid-cols-[220px_minmax(0,1fr)] md:px-6 md:pb-8 lg:px-8">
      <DesktopSidebar activeTab={activeTab} onChange={setActiveTab} />

      <div className="min-w-0 space-y-5">
        <Header todayCount={todayEntries.length} importantCount={importantEntries.length} />

        <GlassPanel className="overflow-hidden p-4 sm:p-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <GlassBadge>Быстрый ввод</GlassBadge>
                <GlassBadge>{isListening ? "запись идет" : "готово"}</GlassBadge>
              </div>
              <GlassTextarea
                className="min-h-28 w-full resize-y px-4 py-4 text-[16px] leading-7"
                placeholder="Наговори или напиши всё подряд: задачи, покупки, идеи, ссылки, цены..."
                value={quickText}
                onChange={(event) => setQuickText(event.target.value)}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <GlassButton className="px-5 font-bold text-white [background:linear-gradient(135deg,#176bff,#7b61ff)]" onClick={parseQuickText}>
                  <Sparkles size={18} />
                  {isParsing ? "Разбираю..." : "Разобрать"}
                </GlassButton>
                <GlassButton className="px-4 font-semibold" onClick={() => addManual("task")}>
                  <Plus size={18} />
                  Задача
                </GlassButton>
                <GlassButton className="px-4 font-semibold" onClick={() => addManual("purchase")}>
                  <ShoppingCart size={18} />
                  Покупка
                </GlassButton>
                <GlassButton className="px-4 font-semibold" onClick={() => addManual("idea")}>
                  <Lightbulb size={18} />
                  Идея
                </GlassButton>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center gap-3">
              <button
                className={`voice-orb focus-ring grid place-items-center ${isListening ? "listening" : ""}`}
                disabled={!speechSupported}
                onClick={toggleVoiceInput}
                type="button"
              >
                <Mic size={30} />
              </button>
              <div className="text-center">
                <div className="font-bold">{!speechSupported ? "Голос недоступен" : isListening ? "Остановить" : "Говорить"}</div>
                <p className="mt-1 max-w-48 text-sm text-[var(--muted)]">
                  {voiceMessage || "Диктовка дописывает текст и держит паузы."}
                </p>
              </div>
            </div>
          </div>
        </GlassPanel>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Сегодня" value={`${todayEntries.length}`} detail={`${importantEntries.length} важные`} icon={<CalendarDays size={18} />} />
          <MetricCard label="Неделя" value={`${entries.filter((entry) => entry.schedule === "this_week").length}`} detail="в работе" icon={<Clock3 size={18} />} />
          <MetricCard label="Покупки" value={purchaseTotal ? `${purchaseTotal.toLocaleString("ru-RU")} ₽` : "0 ₽"} detail="примерная сумма" icon={<WalletCards size={18} />} />
          <MetricCard label="Inbox" value={`${entries.filter((entry) => entry.kind === "inbox" || entry.needsReview).length}`} detail="на разбор" icon={<Inbox size={18} />} />
        </div>

        <GlassPanel className="p-3">
          <div className="flex gap-2">
            <GlassInput
              className="h-12 min-w-0 flex-1 px-4"
              placeholder="Спросить ежедневник..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void askDiary();
              }}
            />
            <GlassButton className="grid h-12 w-12 place-items-center text-white [background:linear-gradient(135deg,#1b6cff,#22a6f2)]" onClick={askDiary} title="Спросить">
              <Search size={19} />
            </GlassButton>
          </div>
          {answer ? <p className="px-2 pt-3 text-sm leading-6">{answer.answer}</p> : null}
        </GlassPanel>

        {preview ? <SmartPreview onKindChange={updatePreviewKind} onRemember={rememberRule} onSave={savePreview} preview={preview} /> : null}

        <GlassPanel className="p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold tracking-normal">{tabs.find((tab) => tab.id === activeTab)?.label}</h2>
              <p className="text-sm text-[var(--muted)]">{visibleEntries.length ? `${visibleEntries.length} записей` : "Пока свободно"}</p>
            </div>
            {activeTab === "week" ? (
              <GlassSegmentedControl
                onChange={(value) => setListMode(value as "this" | "next")}
                options={[
                  { label: "Эта", value: "this" },
                  { label: "Следующая", value: "next" }
                ]}
                value={listMode}
              />
            ) : null}
          </div>

          {activeTab === "settings" ? (
            <SettingsPanel settings={settings} onChange={updateSettings} rulesCount={learnedRules.length} />
          ) : (
            <div className="grid gap-3">
              {undoEntry ? (
                <GlassButton
                  className="w-fit px-4 text-sm"
                  onClick={() => {
                    updateEntry(undoEntry.id, { status: undoEntry.status, completedAt: undefined });
                    setUndoEntry(null);
                  }}
                >
                  <Undo2 size={16} />
                  Вернуть выполненную задачу
                </GlassButton>
              ) : null}
              {visibleEntries.length ? (
                visibleEntries.map((entry) => (
                  <EntryRow
                    entry={entry}
                    key={entry.id}
                    onComplete={() => completeEntry(entry)}
                    onDelete={() => deleteEntry(entry.id)}
                    onUpdate={(patch) => updateEntry(entry.id, patch)}
                  />
                ))
              ) : (
                <EmptyState onAdd={() => addManual("task")} />
              )}
            </div>
          )}
        </GlassPanel>
      </div>

      <MobileDock activeTab={activeTab} onAdd={() => addManual("task")} onChange={setActiveTab} />
    </main>
  );
}

function Header({ todayCount, importantCount }: { todayCount: number; importantCount: number }) {
  return (
    <header className="flex items-end justify-between gap-4">
      <div>
        <p className="text-sm font-semibold text-[var(--muted)]">{new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}</p>
        <h1 className="mt-1 text-4xl font-black tracking-normal sm:text-5xl">Добрый день</h1>
      </div>
      <GlassCard className="hidden min-w-44 p-4 text-right sm:block">
        <div className="text-3xl font-black">{todayCount}</div>
        <div className="text-sm text-[var(--muted)]">{importantCount} важные</div>
      </GlassCard>
    </header>
  );
}

function DesktopSidebar({ activeTab, onChange }: { activeTab: TabId; onChange: (tab: TabId) => void }) {
  return (
    <aside className="sticky top-4 hidden h-[calc(100vh-32px)] md:block">
      <GlassPanel className="flex h-full flex-col gap-2 p-3">
        <div className="px-3 py-4">
          <div className="text-xl font-black">ЕЖЕДНЕВНИК</div>
          <p className="text-xs text-[var(--muted)]">smart local parser</p>
        </div>
        {tabs.map((tab) => (
          <button
            className={`flex min-h-11 items-center gap-3 rounded-2xl px-3 text-sm font-bold transition ${
              activeTab === tab.id ? "bg-white/70 text-[var(--foreground)] shadow-sm dark:bg-white/10" : "text-[var(--muted)] hover:bg-white/40 dark:hover:bg-white/10"
            }`}
            key={tab.id}
            onClick={() => onChange(tab.id)}
            type="button"
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </GlassPanel>
    </aside>
  );
}

function MobileDock({ activeTab, onAdd, onChange }: { activeTab: TabId; onAdd: () => void; onChange: (tab: TabId) => void }) {
  const mobileTabs: TabId[] = ["today", "week", "projects", "settings"];
  return (
    <nav className="fixed inset-x-0 bottom-4 z-20 mx-auto flex w-[min(94vw,430px)] items-center justify-between rounded-full border border-white/50 bg-white/55 px-3 py-2 shadow-2xl backdrop-blur-2xl md:hidden dark:border-white/10 dark:bg-zinc-950/55">
      {mobileTabs.slice(0, 2).map((id) => {
        const tab = tabs.find((item) => item.id === id)!;
        return <DockButton active={activeTab === id} icon={<tab.icon size={19} />} key={id} label={tab.label} onClick={() => onChange(id)} />;
      })}
      <button className="grid h-14 w-14 place-items-center rounded-full bg-[var(--foreground)] text-[var(--background)] shadow-xl" onClick={onAdd} type="button">
        <Plus size={24} />
      </button>
      {mobileTabs.slice(2).map((id) => {
        const tab = tabs.find((item) => item.id === id)!;
        return <DockButton active={activeTab === id} icon={<tab.icon size={19} />} key={id} label={tab.label} onClick={() => onChange(id)} />;
      })}
    </nav>
  );
}

function DockButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button className={`grid min-h-12 min-w-12 place-items-center rounded-full px-2 text-[11px] font-bold ${active ? "bg-white/70 shadow-sm dark:bg-white/12" : "text-[var(--muted)]"}`} onClick={onClick} type="button">
      {icon}
      <span>{label}</span>
    </button>
  );
}

function MetricCard({ detail, icon, label, value }: { detail: string; icon: React.ReactNode; label: string; value: string }) {
  return (
    <GlassCard className="p-4">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-white/60 text-[var(--accent)] shadow-sm dark:bg-white/10">{icon}</div>
      <div className="text-2xl font-black">{value}</div>
      <div className="mt-1 flex items-center justify-between gap-2 text-sm">
        <span className="font-bold">{label}</span>
        <span className="text-[var(--muted)]">{detail}</span>
      </div>
    </GlassCard>
  );
}

function SmartPreview({
  onKindChange,
  onRemember,
  onSave,
  preview
}: {
  onKindChange: (index: number, kind: EntryKind) => void;
  onRemember: (index: number) => void;
  onSave: () => void;
  preview: AIParseResult;
}) {
  return (
    <GlassPanel className="p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black">Я понял так</h2>
          <p className="text-sm text-[var(--muted)]">Confidence: {confidenceLabel(preview.confidence)} · {Math.round(preview.confidence * 100)}%</p>
        </div>
        <GlassButton className="px-5 font-bold text-white [background:linear-gradient(135deg,#176bff,#7b61ff)]" onClick={onSave}>
          Сохранить
        </GlassButton>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {preview.items.map((item, index) => (
          <GlassCard className="p-4" key={`${item.title}-${index}`}>
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <GlassBadge className={kindTone[item.kind]}>{kindLabel[item.kind]}</GlassBadge>
                <h3 className="mt-3 text-lg font-black">{item.title}</h3>
              </div>
              <select className="glass-input h-10 rounded-full px-3 text-sm" value={item.kind} onChange={(event) => onKindChange(index, event.target.value as EntryKind)}>
                <option value="task">Задача</option>
                <option value="purchase">Покупка</option>
                <option value="idea">Идея</option>
                <option value="inbox">Inbox</option>
              </select>
            </div>
            <div className="grid gap-2 text-sm text-[var(--muted)]">
              <span>{item.projectPath?.length ? item.projectPath.join(" -> ") : "без проекта"}</span>
              <span>{item.dueDate ? formatDateRu(item.dueDate) : item.schedule}</span>
              {item.totalPrice || item.unitPrice ? <span>{item.quantity ? `${item.quantity} × ` : ""}{item.unitPrice ?? item.totalPrice} {item.currency ?? "RUB"}</span> : null}
              <span>parsedBy: {item.parsedBy ?? "local"} · {Math.round((item.confidence ?? preview.confidence) * 100)}%</span>
            </div>
            <div className="mt-3 flex gap-2">
              <GlassButton className="px-3 text-sm" onClick={() => onRemember(index)}>
                Запомнить правило
              </GlassButton>
            </div>
          </GlassCard>
        ))}
      </div>
    </GlassPanel>
  );
}

function EntryRow({
  entry,
  onComplete,
  onDelete,
  onUpdate
}: {
  entry: DiaryEntry;
  onComplete: () => void;
  onDelete: () => void;
  onUpdate: (patch: Partial<DiaryEntry>) => void;
}) {
  const done = entry.status === "done";
  return (
    <GlassCard className="p-3">
      <div className="flex gap-3">
        <button
          className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/65 text-[var(--accent)] shadow-sm dark:bg-white/10"
          onClick={onComplete}
          title={done ? "Выполнено" : "Завершить"}
          type="button"
        >
          {done ? <Check size={18} /> : <Circle size={18} />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <GlassBadge className={kindTone[entry.kind]}>{kindLabel[entry.kind]}</GlassBadge>
            {entry.priority === "high" ? <GlassBadge className="text-[var(--rose)]">важно</GlassBadge> : null}
            {entry.needsReview ? <GlassBadge className="text-[var(--amber)]">уточнить</GlassBadge> : null}
          </div>
          <input
            className={`mt-2 w-full rounded-2xl border border-transparent bg-transparent px-1 text-lg font-black outline-none focus:border-white/50 focus:bg-white/30 ${done ? "text-[var(--muted)] line-through" : ""}`}
            value={entry.title}
            onChange={(event) => onUpdate({ title: event.target.value })}
          />
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-[var(--muted)]">
            <span>{entry.projectPath.length ? entry.projectPath.join(" -> ") : "без проекта"}</span>
            <span>{formatDateRu(entry.dueDate)}</span>
            {entry.totalPrice || entry.unitPrice ? <span>{entry.totalPrice ?? entry.unitPrice} {entry.currency ?? "RUB"}</span> : null}
            {entry.url ? <a className="font-bold text-[var(--accent)]" href={entry.url} rel="noreferrer" target="_blank">Открыть товар</a> : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <select className="glass-input h-10 rounded-full px-2 text-sm" value={entry.schedule} onChange={(event) => onUpdate({ schedule: event.target.value as SchedulePreset })}>
            <option value="today">Сегодня</option>
            <option value="tomorrow">Завтра</option>
            <option value="this_week">Эта неделя</option>
            <option value="next_week">Следующая</option>
            <option value="someday">Когда-нибудь</option>
            <option value="none">Без даты</option>
          </select>
          <button className="grid h-10 w-10 place-items-center rounded-full bg-white/50 text-[var(--muted)] dark:bg-white/10" onClick={onDelete} title="Удалить" type="button">
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </GlassCard>
  );
}

function SettingsPanel({ settings, onChange, rulesCount }: { settings: AppSettings; onChange: (settings: AppSettings) => void; rulesCount: number }) {
  return (
    <div className="grid gap-4">
      <GlassCard className="grid gap-3 p-4">
        <label className="flex items-center justify-between gap-3">
          <span>
            <span className="block font-bold">AI включен</span>
            <span className="text-sm text-[var(--muted)]">Local smart parser работает всегда; AI используется только как fallback.</span>
          </span>
          <input checked={settings.aiEnabled} type="checkbox" onChange={(event) => onChange({ ...settings, aiEnabled: event.target.checked })} />
        </label>
        <label className="grid gap-1">
          <span className="text-sm font-bold">Provider</span>
          <select className="glass-input h-11 px-3" value={settings.aiProvider} onChange={(event) => onChange({ ...settings, aiProvider: event.target.value })}>
            <option value="mock">Mock</option>
            <option value="groq">Groq</option>
            <option value="qwen">Qwen</option>
            <option value="openai-compatible">OpenAI-compatible</option>
          </select>
        </label>
      </GlassCard>
      <GlassCard className="grid gap-3 p-4">
        <label className="grid gap-1">
          <span className="text-sm font-bold">Валюта по умолчанию</span>
          <input className="glass-input h-11 px-3" value={settings.defaultCurrency} onChange={(event) => onChange({ ...settings, defaultCurrency: event.target.value })} />
        </label>
        <label className="grid gap-1">
          <span className="text-sm font-bold">Часовой пояс</span>
          <input className="glass-input h-11 px-3" value={settings.timezone} onChange={(event) => onChange({ ...settings, timezone: event.target.value })} />
        </label>
        <GlassBadge>{rulesCount} learned rules</GlassBadge>
      </GlassCard>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="py-12 text-center">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-white/55 text-[var(--accent)] shadow-sm dark:bg-white/10">
        <Check size={24} />
      </div>
      <h3 className="text-xl font-black">Пока свободно</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--muted)]">Здесь появятся задачи, покупки и идеи, когда ты добавишь или разберёшь запись.</p>
      <GlassButton className="mx-auto mt-4 px-5 font-bold" onClick={onAdd}>
        <Plus size={18} />
        Добавить задачу
      </GlassButton>
    </div>
  );
}
