"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DesktopNav, MobileNav } from "@/components/navigation/AppNav";
import { Button, Surface } from "@/components/ui/native";
import { CaptureSheet } from "@/features/capture/CaptureSheet";
import { EntryDetailSheet } from "@/features/entries/EntryDetailSheet";
import { MoreView } from "@/features/more/MoreView";
import { PlanView } from "@/features/planner/PlanView";
import { PurchasesView } from "@/features/purchases/PurchasesView";
import { SpacesView } from "@/features/spaces/SpacesView";
import type { MoreSection, ScreenId } from "@/features/app/types";
import { addToSavingsGoal, createSavingsGoal, parseSavingsCommand } from "@/lib/finance";
import { createEntryFromParsed } from "@/lib/mock-ai";
import { parseSmartInput } from "@/lib/smart-parser";
import { loadLearnedRules, rememberIntentRule, saveLearnedRules } from "@/lib/smart-parser/learned-rules";
import type { LearnedRule } from "@/lib/smart-parser/types";
import { todayIso } from "@/lib/dates";
import { useDnevnikData } from "@/hooks/use-dnevnik-data";
import type { AIParseResult, DiaryEntry, ProjectNode, PurchaseStatus, Space } from "@/lib/types";

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

const appBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function DnevnikApp() {
  const data = useDnevnikData();
  const [screen, setScreen] = useState<ScreenId>("plan");
  const [moreSection, setMoreSection] = useState<MoreSection>(null);
  const [ownerFilter, setOwnerFilter] = useState<"all" | "me" | "shared">("all");
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [planMode, setPlanMode] = useState<"day" | "week" | "month">("day");
  const [purchaseView, setPurchaseView] = useState<PurchaseStatus>("planned");
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | undefined>();
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>();
  const [captureOpen, setCaptureOpen] = useState(false);
  const [quickText, setQuickText] = useState("");
  const [preview, setPreview] = useState<AIParseResult | null>(null);
  const [editingPreviewIndex, setEditingPreviewIndex] = useState<number | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState("");
  const [toast, setToast] = useState<{ title: string; detail?: string; action?: () => void; actionLabel?: string } | null>(null);
  const [query, setQuery] = useState("");
  const [learnedRules, setLearnedRules] = useState<LearnedRule[]>([]);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const keepListeningRef = useRef(false);
  const latestTextRef = useRef("");
  const voiceBaseRef = useRef("");
  const restoredRef = useRef(false);
  const recoveryAppliedRef = useRef(false);
  const dbReady = data.status.ready;
  const persistDraft = data.setDraft;
  const persistPreviewState = data.setPreviewState;

  useEffect(() => {
    queueMicrotask(() => setLearnedRules(loadLearnedRules()));
  }, []);

  useEffect(() => {
    if (!dbReady || restoredRef.current) return;
    restoredRef.current = true;
    queueMicrotask(() => {
      setQuickText(data.draft?.quickText ?? "");
      setPreview(data.previewState?.preview ?? null);
      setPlanMode(data.settings.planMode ?? "day");
      if (data.draft?.quickText || data.previewState?.preview) setCaptureOpen(true);
      recoveryAppliedRef.current = true;
    });
  }, [data.draft, data.previewState, data.settings.planMode, dbReady]);

  useEffect(() => {
    latestTextRef.current = quickText;
    if (!dbReady || !recoveryAppliedRef.current) return;
    persistDraft(quickText.trim() ? { quickText, source: isListening ? "voice" : "typing", timestamp: new Date().toISOString() } : null);
  }, [dbReady, isListening, persistDraft, quickText]);

  useEffect(() => {
    if (!dbReady || !recoveryAppliedRef.current) return;
    persistPreviewState(preview ? { preview, timestamp: new Date().toISOString() } : null);
  }, [dbReady, persistPreviewState, preview]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    document.documentElement.dataset.theme = data.settings.appearance;
    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, [data.settings.appearance]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register(`${appBasePath}/sw.js`, { scope: `${appBasePath || "/"}` }).then((registration) => {
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            setToast({ title: "Доступно обновление", detail: "Можно сразу обновить приложение.", actionLabel: "Обновить", action: () => window.location.reload() });
          }
        });
      });
    }).catch(() => undefined);
  }, []);

  const selectedEntry = useMemo(() => data.entries.find((entry) => entry.id === detailId) ?? null, [data.entries, detailId]);

  function setMode(mode: "day" | "week" | "month") {
    setPlanMode(mode);
    data.setSettings({ ...data.settings, planMode: mode });
  }

  function navigate(next: ScreenId) {
    setScreen(next);
    setMoreSection(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeCapture() {
    keepListeningRef.current = false;
    recognitionRef.current?.stop();
    setIsListening(false);
    setCaptureOpen(false);
  }

  function addEntries(entries: DiaryEntry[]) {
    data.setEntries((current) => [...entries, ...current]);
  }

  async function parseText() {
    const text = quickText.trim();
    if (!text) return;
    const savings = parseSavingsCommand(text);
    if (savings?.action === "create" && savings.amount) {
      const amount = savings.amount;
      data.setSavingsGoals((current) => [createSavingsGoal(savings.title, amount, data.settings.defaultCurrency), ...current]);
      setQuickText("");
      setToast({ title: "Накопление создано", detail: savings.title });
      return;
    }
    if (savings?.action === "deposit" && savings.amount) {
      const amount = savings.amount;
      const goal = data.savingsGoals.find((item) => item.title.toLowerCase().includes(savings.title.toLowerCase()));
      if (goal) {
        const result = addToSavingsGoal(goal, amount);
        data.setSavingsGoals((current) => current.map((item) => item.id === goal.id ? result.goal : item));
        data.setFinanceTransactions((current) => [result.transaction, ...current]);
        setQuickText("");
        setToast({ title: "Накопление обновлено", detail: `+${amount.toLocaleString("ru-RU")} ${goal.currency}` });
        return;
      }
    }

    setIsParsing(true);
    setVoiceMessage("Разбираю...");
    try {
      const result = parseSmartInput(text, {
        timezone: data.settings.timezone,
        learnedRules,
        projects: data.projects,
        areas: data.spaces.map(spaceToLegacyArea),
        knowledge: data.knowledge,
        settings: data.settings
      });
      if (!result.items.length) {
        saveFallback(text);
        return;
      }
      const parsed: AIParseResult = { confidence: result.confidence, items: result.items, rawText: text, needsReview: result.needsReview };
      setPreview(parsed);
      setVoiceMessage(`Найдено ${parsed.items.length} записей. Проверь и сохрани.`);
      if (data.settings.autoSaveAfterParse && !parsed.needsReview && parsed.confidence >= 0.82) savePreview(parsed);
    } catch {
      saveFallback(text);
    } finally {
      setIsParsing(false);
    }
  }

  function saveFallback(text: string) {
    const now = new Date().toISOString();
    addEntries([{
      id: crypto.randomUUID(),
      kind: "note",
      title: text.slice(0, 86) || "Неразобранная запись",
      description: text,
      projectPath: [],
      assignedTo: "me",
      visibility: "private",
      createdBy: "me",
      updatedBy: "me",
      status: "active",
      priority: "normal",
      schedule: "none",
      repeat: "none",
      checklist: [],
      needsReview: true,
      sourceText: text,
      originalInput: text,
      parsedBy: "local",
      confidence: 0.2,
      createdAt: now,
      updatedAt: now,
      revision: 1
    }]);
    setPreview(null);
    setQuickText("");
    setToast({ title: "Сохранено в Разобрать", detail: "Исходный текст не потерян." });
  }

  function savePreview(target = preview) {
    if (!target) return;
    const saved = target.items.map((item) => normalizeSavedEntry(createEntryFromParsed(item), data.spaces, data.projects));
    addEntries(saved);
    setPreview(null);
    setQuickText("");
    setEditingPreviewIndex(null);
    closeCapture();
    setToast({ title: saved.length === 1 ? "Сохранено" : `Сохранено: ${saved.length}`, detail: saved[0]?.title, actionLabel: "Открыть", action: () => setDetailId(saved[0]?.id ?? null) });
  }

  function removePreviewItem(index: number) {
    setPreview((current) => {
      if (!current) return null;
      const items = current.items.filter((_, itemIndex) => itemIndex !== index);
      return items.length ? { ...current, items } : null;
    });
  }

  function updatePreviewItem(index: number, patch: Partial<AIParseResult["items"][number]>) {
    setPreview((current) => current ? { ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) } : current);
  }

  function toggleVoice() {
    if (isListening) {
      keepListeningRef.current = false;
      recognitionRef.current?.stop();
      setIsListening(false);
      setVoiceMessage("Запись остановлена. Теперь можно разобрать текст.");
      return;
    }
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      setVoiceMessage("Этот браузер не поддерживает голосовой ввод. Можно написать текст.");
      return;
    }
    keepListeningRef.current = true;
    voiceBaseRef.current = quickText.trim();
    startRecognition(Recognition);
  }

  function startRecognition(Recognition: SpeechRecognitionConstructor) {
    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.lang = "ru-RU";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.onstart = () => {
      setIsListening(true);
      setVoiceMessage("Слушаю. Можно делать паузы.");
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      if (!keepListeningRef.current) return;
      voiceBaseRef.current = latestTextRef.current.trim();
      window.setTimeout(() => keepListeningRef.current ? startRecognition(Recognition) : undefined, 250);
    };
    recognition.onerror = (event) => {
      if (keepListeningRef.current && (event.error === "no-speech" || event.error === "aborted")) {
        setVoiceMessage("Слушаю. Можно продолжать после паузы.");
        return;
      }
      keepListeningRef.current = false;
      setIsListening(false);
      setVoiceMessage("Не удалось распознать речь. Текстовый ввод работает.");
    };
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0].transcript).join(" ").trim();
      const next = [voiceBaseRef.current, transcript].filter(Boolean).join(" ");
      setQuickText(next);
      latestTextRef.current = next;
    };
    try {
      recognition.start();
    } catch {
      setVoiceMessage("Голосовой ввод уже запускается.");
    }
  }

  function completeEntry(entry: DiaryEntry) {
    const status = entry.kind === "purchase" ? "bought" : "done";
    data.setEntries((current) => current.map((item) => item.id === entry.id ? {
      ...item,
      status,
      purchase: item.purchase ? { ...item.purchase, status: "purchased" } : item.purchase,
      wish: item.wish ? { ...item.wish, status: "purchased" } : item.wish,
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      revision: (item.revision ?? 1) + 1
    } : item));
  }

  function updateEntry(id: string, patch: Partial<DiaryEntry>) {
    data.setEntries((current) => current.map((entry) => entry.id === id ? { ...entry, ...patch, updatedAt: new Date().toISOString(), revision: (entry.revision ?? 1) + 1 } : entry));
  }

  function deleteEntry(entry: DiaryEntry) {
    data.setEntries((current) => current.filter((item) => item.id !== entry.id));
    setToast({ title: "Удалено", detail: entry.title, actionLabel: "Отменить", action: () => data.setEntries((current) => [entry, ...current]) });
  }

  function createSpace(name: string): Space {
    const now = new Date().toISOString();
    const space = { id: slug(name), name, accent: "#607085", createdAt: now, updatedAt: now, revision: 1 };
    data.setSpaces((current) => current.some((item) => item.id === space.id) ? current : [space, ...current]);
    return space;
  }

  function createProject(name: string, spaceId?: string): ProjectNode {
    const now = new Date().toISOString();
    const space = data.spaces.find((item) => item.id === spaceId);
    const project = { id: slug(`${spaceId ?? "free"}-${name}`), name, spaceId, area: space?.name, status: "active" as const, aliases: [name.toLowerCase()], createdAt: now, updatedAt: now, revision: 1 };
    data.setProjects((current) => current.some((item) => item.id === project.id) ? current : [project, ...current]);
    return project;
  }

  function rememberCurrentEntry() {
    const entry = selectedEntry;
    if (!entry?.sourceText) return;
    const rule = rememberIntentRule(entry.sourceText.slice(0, 48).toLowerCase(), entry.kind);
    const next = [rule, ...learnedRules].slice(0, 80);
    setLearnedRules(next);
    saveLearnedRules(next);
    data.setKnowledge((current) => ({ ...current, corrections: [{ id: crypto.randomUUID(), phrase: entry.sourceText ?? entry.title, patch: { kind: entry.kind, area: entry.area, project: entry.project, spaceId: entry.spaceId, projectId: entry.projectId }, createdAt: new Date().toISOString() }, ...current.corrections] }));
    updateEntry(entry.id, { needsReview: false });
    setToast({ title: "Запомнил", detail: "Похожую запись будет проще разобрать." });
  }

  async function exportData() {
    const exported = await data.exportData();
    const blob = new Blob([JSON.stringify(exported, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dnevnik-export-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function importData(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const ok = data.importData(JSON.parse(String(reader.result)));
        setToast({ title: ok ? "Импорт выполнен" : "Импорт не выполнен" });
      } catch {
        setToast({ title: "Импорт не выполнен", detail: "Файл не похож на экспорт." });
      }
    };
    reader.readAsText(file);
  }

  if (!data.status.ready) {
    return <main className="mx-auto grid min-h-screen max-w-xl place-items-center px-4"><Surface className="p-6 text-center font-black">Загружаю ежедневник...</Surface></main>;
  }

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-7xl gap-5 px-4 pb-28 pt-4 md:grid-cols-[220px_minmax(0,1fr)] md:px-6 md:pb-8">
      <DesktopNav active={screen} onChange={navigate} />
      <div className="min-w-0">
        {data.status.warning ? <Surface className="mb-4 p-3 text-sm text-[#a15c00]">{data.status.warning}</Surface> : null}
        {screen === "plan" ? (
          <PlanView entries={data.entries} spaces={data.spaces} ownerFilter={ownerFilter} mode={planMode} selectedDate={selectedDate} onModeChange={setMode} onDateChange={setSelectedDate} onOwnerFilterChange={setOwnerFilter} onComplete={completeEntry} onOpen={(entry) => setDetailId(entry.id)} onAdd={() => setCaptureOpen(true)} />
        ) : null}
        {screen === "spaces" ? (
          <SpacesView
            entries={data.entries}
            projects={data.projects}
            spaces={data.spaces}
            selectedProjectId={selectedProjectId}
            selectedSpaceId={selectedSpaceId}
            onCreateProject={createProject}
            onCreateSpace={createSpace}
            onComplete={completeEntry}
            onOpenEntry={(entry) => setDetailId(entry.id)}
            onSelectProject={setSelectedProjectId}
            onSelectSpace={(id) => {
              setSelectedSpaceId(id);
              setSelectedProjectId(undefined);
            }}
          />
        ) : null}
        {screen === "purchases" ? (
          <PurchasesView entries={data.entries} spaces={data.spaces} status={purchaseView} onStatusChange={setPurchaseView} onComplete={completeEntry} onOpen={(entry) => setDetailId(entry.id)} />
        ) : null}
        {screen === "more" ? (
          <MoreView activeSection={moreSection} entries={data.entries} members={data.members} query={query} settings={data.settings} spaces={data.spaces} onChangeQuery={setQuery} onChangeSection={setMoreSection} onChangeSettings={data.setSettings} onClearAll={data.clearEverything} onClearEntries={data.clearEntries} onComplete={completeEntry} onExport={exportData} onImport={importData} onNavigate={navigate} onOpenEntry={(entry) => setDetailId(entry.id)} />
        ) : null}
      </div>

      <MobileNav active={screen} onAdd={() => setCaptureOpen(true)} onChange={navigate} />
      {captureOpen ? <CaptureSheet text={quickText} isListening={isListening} isParsing={isParsing} preview={preview} voiceMessage={voiceMessage} onClose={closeCapture} onTextChange={setQuickText} onToggleVoice={toggleVoice} onParse={parseText} onSaveAll={() => savePreview()} onEditPreview={setEditingPreviewIndex} onRemovePreview={removePreviewItem} /> : null}
      {editingPreviewIndex !== null && preview?.items[editingPreviewIndex] ? (
        <EntryDetailSheet
          entry={normalizeSavedEntry(createEntryFromParsed(preview.items[editingPreviewIndex]), data.spaces, data.projects)}
          projects={data.projects}
          spaces={data.spaces}
          onChange={(patch) => updatePreviewItem(editingPreviewIndex, patch)}
          onCreateProject={createProject}
          onCreateSpace={createSpace}
          onClose={() => setEditingPreviewIndex(null)}
          onDelete={() => {
            removePreviewItem(editingPreviewIndex);
            setEditingPreviewIndex(null);
          }}
          onRemember={() => undefined}
        />
      ) : null}
      {selectedEntry ? <EntryDetailSheet entry={selectedEntry} projects={data.projects} spaces={data.spaces} onChange={(patch) => updateEntry(selectedEntry.id, patch)} onCreateProject={createProject} onCreateSpace={createSpace} onClose={() => setDetailId(null)} onDelete={() => { deleteEntry(selectedEntry); setDetailId(null); }} onRemember={rememberCurrentEntry} /> : null}
      {toast ? <Toast title={toast.title} detail={toast.detail} action={toast.action} actionLabel={toast.actionLabel} /> : null}
    </main>
  );
}

function Toast({ action, actionLabel, detail, title }: { action?: () => void; actionLabel?: string; detail?: string; title: string }) {
  return (
    <div className="fixed left-1/2 top-4 z-[90] w-[min(92vw,420px)] -translate-x-1/2">
      <Surface className="flex items-start justify-between gap-3 p-4">
        <div>
          <div className="font-black">{title}</div>
          {detail ? <div className="mt-1 text-sm text-[var(--muted)]">{detail}</div> : null}
        </div>
        {action && actionLabel ? <Button className="shrink-0 px-3 text-sm font-bold" onClick={action}>{actionLabel}</Button> : null}
      </Surface>
    </div>
  );
}

function normalizeSavedEntry(entry: DiaryEntry, spaces: Space[], projects: ProjectNode[]): DiaryEntry {
  const space = spaces.find((item) => item.name === entry.area || item.id === entry.spaceId);
  const project = projects.find((item) => item.name === entry.project || item.id === entry.projectId);
  return {
    ...entry,
    kind: entry.kind === "inbox" ? "note" : entry.kind,
    spaceId: space?.id ?? entry.spaceId,
    area: space?.name ?? entry.area,
    projectId: project?.id ?? entry.projectId,
    project: project?.name ?? entry.project,
    projectPath: entry.projectPath?.length ? entry.projectPath : [space?.name ?? entry.area, project?.name ?? entry.project].filter(Boolean) as string[],
    repeat: entry.repeat ?? "none",
    checklist: entry.checklist ?? [],
    visibility: entry.visibility ?? (entry.assignedTo === "shared" ? "shared" : "private"),
    createdBy: entry.createdBy ?? "me",
    updatedBy: "me",
    revision: entry.revision ?? 1,
    wish: entry.kind === "wish" ? { status: "saved", currency: entry.currency ?? "RUB", estimatedPrice: entry.totalPrice ?? entry.unitPrice, url: entry.url, ...entry.wish } : entry.wish,
    purchase: entry.kind === "purchase" ? { status: "planned", currency: entry.currency ?? "RUB", quantity: entry.quantity, unitPrice: entry.unitPrice, totalPrice: entry.totalPrice, url: entry.url, priceHistory: [], ...entry.purchase } : entry.purchase
  };
}

function spaceToLegacyArea(space: Space) {
  return { id: space.id, name: space.name, icon: space.icon, createdAt: space.createdAt, updatedAt: space.updatedAt, revision: space.revision ?? 1 };
}

function slug(value: string): string {
  const fallback = crypto.randomUUID();
  const next = value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-zа-я0-9-]/gi, "");
  return next || fallback;
}
