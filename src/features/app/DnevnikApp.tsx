"use client";

import { encodeBackupFiles, decodeBackupFiles } from "@/lib/backup-files";
import { Mic, Search, X } from "lucide-react";
import { toggleEntryCompletion } from "@/lib/entry-actions";
import { useEffect, useMemo, useRef, useState } from "react";
import { DesktopNav, MobileNav } from "@/components/navigation/AppNav";
import { Button, Surface } from "@/components/ui/native";
import { kindLabels } from "@/features/shared/entry-utils";
import { CaptureSheet } from "@/features/capture/CaptureSheet";
import { EntryDetailSheet } from "@/features/entries/EntryDetailSheet";
import { IdeasView, MoneyView, SettingsView, TasksView, UsView, WorkView } from "@/features/app/DirectViews";
import { DocumentsHubView } from "@/features/family/FamilyViews";
import { PlanView } from "@/features/planner/PlanView";
import { PurchasesView } from "@/features/purchases/PurchasesView";
import { WishlistView } from "@/features/wishlist/WishlistView";
import type { ScreenId } from "@/features/app/types";
import { addToSavingsGoal, createSavingsGoal, parseSavingsCommand } from "@/lib/finance";
import { createEntryFromParsed } from "@/lib/mock-ai";
import { parseSmartInput } from "@/lib/smart-parser";
import { validateLearnedRules, loadLearnedRules, rememberIntentRule, saveLearnedRules } from "@/lib/smart-parser/learned-rules";
import type { LearnedRule } from "@/lib/smart-parser/types";
import { todayIso } from "@/lib/dates";
import { useDnevnikData } from "@/hooks/use-dnevnik-data";
import type { AIParseResult, DiaryEntry, ProjectNode, Space } from "@/lib/types";

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
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [screen, setScreen] = useState<ScreenId>("us");
  const [ownerFilter, setOwnerFilter] = useState<"me" | "partner" | "shared">("shared");
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [planMode, setPlanMode] = useState<"day" | "week" | "month">("day");
  const [purchaseView, setPurchaseView] = useState<"planned" | "ordered" | "purchased">("planned");
  const [captureOpen, setCaptureOpen] = useState(false);
  const [quickText, setQuickText] = useState("");
  const [preview, setPreview] = useState<AIParseResult | null>(null);
  const [editingPreviewIndex, setEditingPreviewIndex] = useState<number | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const restoringRef = useRef(false);
  const savedPreviewsRef = useRef(new WeakSet<AIParseResult>());
  const [isListening, setIsListening] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState("");
  const [toast, setToast] = useState<{ title: string; detail?: string; action?: () => void; actionLabel?: string } | null>(null);
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
    const preference = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => { document.documentElement.dataset.theme = data.settings.appearance === "system" ? (preference.matches ? "dark" : "light") : data.settings.appearance; };
    apply();
    preference.addEventListener("change", apply);
    return () => { preference.removeEventListener("change", apply); delete document.documentElement.dataset.theme; };
  }, [data.settings.appearance]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const swUrl = `${appBasePath}/sw.js`;
    const swScope = `${appBasePath || ""}/`;
    // Updating must never interrupt a draft or microphone session.
    const onControllerChange = () => setToast({ title: "Обновление установлено", detail: "Откройте приложение заново, когда закончите ввод." });
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    navigator.serviceWorker.register(swUrl, { scope: swScope }).then((registration) => {
      void registration.update();
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            setToast({ title: "Доступно обновление", detail: "Можно сразу обновить приложение.", actionLabel: "Обновить", action: () => worker.postMessage({ type: "SKIP_WAITING" }) });
          }
        });
      });
    }).catch(() => undefined);
    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);

  useEffect(() => () => {
    keepListeningRef.current = false;
    recognitionRef.current?.abort();
  }, []);

  useEffect(() => {
    const screens: ScreenId[] = ["us", "plan", "tasks", "work", "purchases", "wishlist", "money", "documents", "ideas", "settings"];
    const applyRoute = () => {
      const target = window.location.hash.slice(1) as ScreenId;
      setScreen(screens.includes(target) ? target : "us");
      setSearch(""); setDetailId(null); setEditingPreviewIndex(null); setCaptureOpen(false);
      keepListeningRef.current = false; recognitionRef.current?.stop(); setIsListening(false);
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    const initial = window.location.hash.slice(1) as ScreenId;
    if (screens.includes(initial)) queueMicrotask(() => setScreen(initial));
    else window.history.replaceState(null, "", window.location.pathname + window.location.search + "#us");
    const shortcuts = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); searchRef.current?.focus(); }
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && !document.querySelector('[role="dialog"]')) { event.preventDefault(); setCaptureOpen(true); }
    };
    const resize = () => {
      document.documentElement.style.setProperty("--visible-height", (window.visualViewport?.height ?? window.innerHeight) + "px");
      document.documentElement.style.setProperty("--visible-top", (window.visualViewport?.offsetTop ?? 0) + "px");
    };
    resize();
    window.addEventListener("hashchange", applyRoute);
    window.addEventListener("keydown", shortcuts);
    window.visualViewport?.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("scroll", resize);
    return () => {
      window.removeEventListener("hashchange", applyRoute); window.removeEventListener("keydown", shortcuts);
      window.visualViewport?.removeEventListener("resize", resize); window.visualViewport?.removeEventListener("scroll", resize);
    };
  }, []);

  const selectedEntry = useMemo(() => data.entries.find((entry) => entry.id === detailId) ?? null, [data.entries, detailId]);

  function setMode(mode: "day" | "week" | "month") {
    setPlanMode(mode);
    data.setSettings({ ...data.settings, planMode: mode });
  }

  function navigate(next: ScreenId) {
    setScreen(next);
    setSearch("");
    if (window.location.hash !== `#${next}`) window.location.hash = next;
    window.scrollTo({ top: 0, behavior: "instant" });
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

  function createManualEntry(kind: DiaryEntry["kind"], patch: Partial<DiaryEntry> = {}) {
    const now = new Date().toISOString();
    const titleByKind: Record<DiaryEntry["kind"], string> = {
      task: "Новая задача",
      purchase: "Новая покупка",
      wish: "Новая хотелка",
      idea: "Новая идея",
      note: "Новая заметка",
      inbox: "Новая запись"
    };
    const entry: DiaryEntry = {
      id: crypto.randomUUID(),
      kind,
      title: titleByKind[kind],
      projectPath: [],
      assignedTo: kind === "purchase" ? "shared" : "me",
      visibility: kind === "purchase" ? "shared" : "private",
      createdBy: "me",
      updatedBy: "me",
      status: kind === "purchase" || kind === "wish" ? "want_to_buy" : "active",
      priority: "normal",
      schedule: kind === "wish" ? "someday" : "none",
      repeat: "none",
      checklist: [],
      purchase: kind === "purchase" ? { status: "planned", currency: data.settings.defaultCurrency, priceHistory: [] } : undefined,
      wish: kind === "wish" ? { status: "saved", owner: "me", currency: data.settings.defaultCurrency } : undefined,
      createdAt: now,
      updatedAt: now,
      revision: 1,
      ...patch
    };
    data.setEntries((current) => [entry, ...current]);
    setDetailId(entry.id);
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
    if (!target || savedPreviewsRef.current.has(target)) return;
    savedPreviewsRef.current.add(target);
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
    if (isListening || recognitionRef.current) {
      keepListeningRef.current = false;
      recognitionRef.current?.stop();
      setIsListening(false);
      setVoiceMessage("Запись остановлена. Теперь можно разобрать текст.");
      return;
    }
    if (!window.isSecureContext) {
      setVoiceMessage("Для микрофона откройте приложение по HTTPS или на localhost.");
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
    setIsListening(true);
    setVoiceMessage("Подключаю микрофон…");
    recognition.onstart = () => {
      if (recognitionRef.current !== recognition) return;
      setIsListening(true);
      setVoiceMessage("Слушаю. Можно делать паузы.");
    };
    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return;
      recognitionRef.current = null;
      if (!keepListeningRef.current) return;
      voiceBaseRef.current = latestTextRef.current.trim();
      window.setTimeout(() => keepListeningRef.current ? startRecognition(Recognition) : undefined, 250);
    };
    recognition.onerror = (event) => {
      if (recognitionRef.current !== recognition) return;
      if (keepListeningRef.current && (event.error === "no-speech" || event.error === "aborted")) {
        setVoiceMessage("Слушаю. Можно продолжать после паузы.");
        return;
      }
      keepListeningRef.current = false;
      setIsListening(false);
      const messages: Record<string, string> = {
        "not-allowed": "Микрофон запрещён. Разрешите доступ в настройках сайта возле адресной строки и нажмите микрофон снова.",
        "service-not-allowed": "Распознавание заблокировано браузером. Попробуйте Chrome или Edge, либо диктовку клавиатуры.",
        "audio-capture": "Микрофон не найден или занят. Проверьте устройство ввода.",
        network: "Нет связи со службой распознавания. Проверьте интернет. Надиктованный текст остаётся здесь."
      };
      setVoiceMessage(messages[event.error] ?? "Распознавание остановлено. Текст сохранён в поле; можно продолжить вручную.");
    };
    recognition.onresult = (event) => {
      if (recognitionRef.current !== recognition) return;
      const transcript = Array.from(event.results).map((result) => result[0].transcript).join(" ").trim();
      const next = [voiceBaseRef.current, transcript].filter(Boolean).join(" ");
      setQuickText(next);
      latestTextRef.current = next;
    };
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      keepListeningRef.current = false;
      setIsListening(false);
      setVoiceMessage("Не удалось запустить микрофон. Попробуйте ещё раз.");
    }
  }

  function completeEntry(entry: DiaryEntry) {
    data.setEntries(current => current.map(item => item.id === entry.id ? toggleEntryCompletion(item) : item));
    setToast({ title: entry.status === "done" || entry.status === "bought" ? "Вернул в список" : "Готово", detail: entry.title, actionLabel: "Отменить", action: () => updateEntry(entry.id, { status: entry.status, purchase: entry.purchase, wish: entry.wish, completedAt: entry.completedAt }) });
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
    try { saveLearnedRules(next); } catch { setToast({ title: "Память браузера недоступна", detail: "Сделайте экспорт данных." }); }
    data.setKnowledge((current) => ({ ...current, corrections: [{ id: crypto.randomUUID(), phrase: entry.sourceText ?? entry.title, patch: { kind: entry.kind, area: entry.area, project: entry.project, spaceId: entry.spaceId, projectId: entry.projectId }, createdAt: new Date().toISOString() }, ...current.corrections] }));
    updateEntry(entry.id, { needsReview: false });
    setToast({ title: "Запомнил", detail: "Похожую запись будет проще разобрать." });
  }

  async function exportData() {
    const exported = { ...await data.exportData(), learnedRules };
    const blob = new Blob([JSON.stringify(await encodeBackupFiles(exported), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dnevnik-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  function importData(file: File) {
    if (restoringRef.current) return;
    restoringRef.current = true;
    setIsRestoring(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const imported = decodeBackupFiles(JSON.parse(String(reader.result))) as Awaited<ReturnType<typeof data.exportData>> & { learnedRules?: LearnedRule[] };
        if (!imported || !Array.isArray(imported.entries)) throw new Error("Invalid backup");
        if (!window.confirm("Импорт заменит текущие данные. Сначала будет скачана резервная копия текущего ежедневника. Продолжить?")) return;
        keepListeningRef.current = false;
        recognitionRef.current?.abort();
        recognitionRef.current = null;
        setIsListening(false);
        await exportData();
        const ok = await data.importData(imported);
        if (ok) {
          setQuickText(imported.draft?.quickText ?? "");
          setPreview(imported.preview?.preview ?? null);
          const rules = validateLearnedRules(imported.learnedRules);
          setLearnedRules(rules);
          try { saveLearnedRules(rules); } catch {}
        }
        setToast({ title: ok ? "Импорт выполнен" : "Импорт не выполнен" });
      } catch {
        setToast({ title: "Импорт не выполнен", detail: "Проверьте файл и доступность хранилища. Прежние записи не заменены." });
      } finally { restoringRef.current = false; setIsRestoring(false); }
    };
    reader.onerror = () => { restoringRef.current = false; setIsRestoring(false); setToast({ title: "Файл не прочитан", detail: "Попробуйте выбрать резервную копию ещё раз." }); };
    reader.readAsText(file);
  }

  const searchResults = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("ru");
    return needle ? data.entries.filter(entry => `${entry.title} ${entry.description ?? ""} ${entry.project ?? ""} ${entry.area ?? ""} ${entry.url ?? ""}`.toLocaleLowerCase("ru").includes(needle)) : [];
  }, [search, data.entries]);

  if (isRestoring) return <main className="grid min-h-screen place-items-center p-6"><Surface role="status" aria-live="polite" className="p-6">Восстанавливаю резервную копию. Не закрывайте приложение…</Surface></main>;

  if (!data.status.ready) {
    return <main className="mx-auto grid min-h-screen max-w-xl place-items-center px-4"><Surface className="p-6 text-center font-black">Загружаю ежедневник...</Surface></main>;
  }

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-7xl gap-5 px-4 pb-28 pt-4 md:grid-cols-[240px_minmax(0,1fr)] md:px-6 md:pb-8">
      <DesktopNav active={screen} onChange={navigate} />
      <div className="min-w-0">
        <div className="app-toolbar">
          <div className="global-search"><Search size={19} aria-hidden="true" /><input ref={searchRef} aria-label="Поиск по всем записям" title="Поиск · Ctrl K" placeholder="Найти запись…" value={search} onChange={event => setSearch(event.target.value)} />{search ? <button type="button" aria-label="Очистить поиск" className="icon-control" onClick={() => { setSearch(""); searchRef.current?.focus(); }}><X size={16} /></button> : null}</div>
          <Button onClick={() => setCaptureOpen(true)} variant="primary" aria-label="Быстрый ввод: текст или голос" title="Добавить · Ctrl Enter"><Mic size={19} />Добавить</Button>
        </div>
        {search.trim() ? <Surface className="search-results" aria-label="Результаты поиска"><p className="px-3 py-2 text-sm text-[var(--muted)]">{searchResults.length ? "Найдено: " + searchResults.length : "Ничего не найдено. Попробуйте другое слово."}</p>{searchResults.slice(0, 50).map(entry => <button type="button" className="search-result" key={entry.id} onClick={() => setDetailId(entry.id)}><b>{entry.title}</b><span>{entry.area ?? "Личное"} · {kindLabels[entry.kind] ?? "Запись"}</span></button>)}{searchResults.length > 50 ? <p className="p-3 text-sm text-[var(--muted)]">Показаны первые 50 записей. Уточните поиск.</p> : null}</Surface> : null}
        {data.status.warning ? <Surface className="mb-4 p-3 text-sm text-[#a15c00]">{data.status.warning}</Surface> : null}
        {screen === "plan" ? (
          <PlanView calendarEvents={data.calendarEvents} entries={data.entries} importantDates={data.importantDates} members={data.members} planTransactions={data.planTransactions} sharedPlans={data.sharedPlans} spaces={data.spaces} ownerFilter={ownerFilter} mode={planMode} selectedDate={selectedDate} onModeChange={setMode} onDateChange={setSelectedDate} onOwnerFilterChange={setOwnerFilter} onComplete={completeEntry} onOpen={(entry) => setDetailId(entry.id)} onAdd={() => setCaptureOpen(true)} />
        ) : null}
        {screen === "us" ? (
          <UsView calendarEvents={data.calendarEvents} entries={data.entries} importantDates={data.importantDates} members={data.members} sharedPlans={data.sharedPlans} spaces={data.spaces} onOpenEntry={(entry) => setDetailId(entry.id)} onComplete={completeEntry} onNavigate={navigate} />
        ) : null}
        {screen === "tasks" ? (
          <TasksView entries={data.entries} members={data.members} spaces={data.spaces} onAdd={(assignedTo = "me") => createManualEntry("task", { assignedTo, visibility: assignedTo === "shared" ? "shared" : "private" })} onComplete={completeEntry} onOpen={(entry) => setDetailId(entry.id)} />
        ) : null}
        {screen === "work" ? (
          <WorkView entries={data.entries} members={data.members} spaces={data.spaces} onAdd={() => createManualEntry("task", { area: "Работа", projectPath: ["Работа"], domain: "work" })} onComplete={completeEntry} onOpen={(entry) => setDetailId(entry.id)} />
        ) : null}
        {screen === "purchases" ? (
          <PurchasesView entries={data.entries} members={data.members} spaces={data.spaces} status={purchaseView} onAdd={() => createManualEntry("purchase", { area: "Дом", projectPath: ["Дом"], assignedTo: "shared", visibility: "shared" })} onStatusChange={setPurchaseView} onComplete={completeEntry} onOpen={(entry) => setDetailId(entry.id)} />
        ) : null}
        {screen === "wishlist" ? (
          <WishlistView defaultCurrency={data.settings.defaultCurrency} entries={data.entries} members={data.members} planTransactions={data.planTransactions} sharedPlans={data.sharedPlans} spaces={data.spaces} onChangeEntries={data.setEntries} onChangePlanTransactions={data.setPlanTransactions} onChangeSharedPlans={data.setSharedPlans} onCreateManual={(planned, owner = "me") => createManualEntry("wish", { wish: { status: planned ? "planned" : "saved", owner, currency: data.settings.defaultCurrency }, assignedTo: owner, visibility: owner === "shared" ? "shared" : "private" })} onComplete={completeEntry} onOpen={(entry) => setDetailId(entry.id)} />
        ) : null}
        {screen === "money" ? (
          <MoneyView entries={data.entries} members={data.members} sharedPlans={data.sharedPlans} spaces={data.spaces} onOpen={(entry) => setDetailId(entry.id)} onComplete={completeEntry} />
        ) : null}
        {screen === "documents" ? (
          <DocumentsHubView documents={data.documents} loyaltyCards={data.loyaltyCards} onChangeDocuments={data.setDocuments} onChangeLoyaltyCards={data.setLoyaltyCards} />
        ) : null}
        {screen === "ideas" ? (
          <IdeasView entries={data.entries} members={data.members} spaces={data.spaces} onAdd={() => createManualEntry("idea")} onComplete={completeEntry} onOpen={(entry) => setDetailId(entry.id)} />
        ) : null}
        {screen === "settings" ? (
          <SettingsView importantDates={data.importantDates} members={data.members} settings={data.settings} onChangeImportantDates={data.setImportantDates} onChangeMembers={data.setMembers} onChangeSettings={data.setSettings} onClearAll={() => { if (window.confirm("Удалить все данные ежедневника? Перед этим сохраните экспорт JSON.")) { keepListeningRef.current = false; recognitionRef.current?.abort(); setIsListening(false); setQuickText(""); setPreview(null); setLearnedRules([]); setDetailId(null); setCaptureOpen(false); setToast(null); latestTextRef.current = ""; voiceBaseRef.current = ""; data.clearEverything(); } }} onClearEntries={() => { if (window.confirm("Удалить все записи? Перед этим сохраните экспорт JSON.")) data.clearEntries(); }} onExport={exportData} onImport={importData} />
        ) : null}
      </div>

      <MobileNav active={screen} onChange={navigate} />
      {captureOpen ? <CaptureSheet text={quickText} isListening={isListening} isParsing={isParsing} preview={preview} voiceMessage={voiceMessage} onClose={closeCapture} onTextChange={setQuickText} onToggleVoice={toggleVoice} onParse={parseText} onSaveAll={() => savePreview()} onEditPreview={setEditingPreviewIndex} onRemovePreview={removePreviewItem} /> : null}
      {editingPreviewIndex !== null && preview?.items[editingPreviewIndex] ? (
        <EntryDetailSheet
          key={editingPreviewIndex}
          entry={normalizeSavedEntry(createEntryFromParsed(preview.items[editingPreviewIndex]), data.spaces, data.projects)}
          members={data.members}
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
      {selectedEntry ? <EntryDetailSheet key={selectedEntry.id} entry={selectedEntry} members={data.members} projects={data.projects} spaces={data.spaces} onChange={(patch) => updateEntry(selectedEntry.id, patch)} onCreateProject={createProject} onCreateSpace={createSpace} onClose={() => setDetailId(null)} onDelete={() => { deleteEntry(selectedEntry); setDetailId(null); }} onRemember={rememberCurrentEntry} /> : null}
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
