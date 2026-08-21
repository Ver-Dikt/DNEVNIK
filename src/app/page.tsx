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
import { addToSavingsGoal, calculateBudget, createSavingsGoal, parseSavingsCommand } from "@/lib/finance";
import { createEntryFromParsed } from "@/lib/mock-ai";
import { formatDateRu, isOverdue, isThisWeek, todayIso } from "@/lib/dates";
import { clearLearnedRules, loadLearnedRules, rememberIntentRule, saveLearnedRules } from "@/lib/smart-parser/learned-rules";
import { parseSmartInput } from "@/lib/smart-parser";
import {
  clearAllDnevnikStorage,
  clearEntriesStorage,
  defaultAreas,
  defaultKnowledge,
  defaultSettings,
  exportDnevnikData,
  importDnevnikData,
  loadAreas,
  loadDraft,
  loadEntries,
  loadFinanceTransactions,
  loadKnowledge,
  loadMembers,
  loadPreviewState,
  loadProjects,
  loadSavingsGoals,
  loadSettings,
  saveAreas,
  saveDraft,
  saveEntries,
  saveFinanceTransactions,
  saveKnowledge,
  saveMembers,
  savePreviewState,
  saveProjects,
  saveSavingsGoals,
  saveSettings,
  storageVersion
} from "@/lib/storage";
import { GlassBadge, GlassButton, GlassCard, GlassInput, GlassPanel, GlassSegmentedControl, GlassTextarea } from "@/components/glass";
import type { AIParseResult, AIQueryResult, AppSettings, Area, AssignedTo, DiaryEntry, EntryKind, EntryStatus, FinanceTransaction, KnowledgeStore, Member, ProjectNode, PurchaseStatus, RepeatRule, SchedulePreset, SavingsGoal } from "@/lib/types";
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
  { id: "plan", label: "План", icon: CalendarDays },
  { id: "today", label: "Сегодня", icon: CalendarDays },
  { id: "week", label: "Неделя", icon: Clock3 },
  { id: "all", label: "Все записи", icon: Check },
  { id: "tasks", label: "Задачи", icon: Check },
  { id: "projects", label: "Проекты", icon: Archive },
  { id: "purchases", label: "Покупки", icon: ShoppingCart },
  { id: "budget", label: "Бюджет", icon: WalletCards },
  { id: "ideas", label: "Идеи", icon: Lightbulb },
  { id: "someday", label: "Когда-нибудь", icon: Clock3 },
  { id: "inbox", label: "Разобрать", icon: Inbox },
  { id: "settings", label: "Ещё", icon: MoreHorizontal }
] as const;

type TabId = (typeof tabs)[number]["id"];

const kindLabel: Record<EntryKind, string> = {
  task: "Задача",
  purchase: "Покупка",
  idea: "Идея",
  note: "Заметка",
  inbox: "Разобрать"
};

const kindTone: Record<EntryKind, string> = {
  task: "text-blue-700 dark:text-blue-200",
  purchase: "text-emerald-700 dark:text-emerald-200",
  idea: "text-fuchsia-700 dark:text-fuchsia-200",
  note: "text-zinc-700 dark:text-zinc-200",
  inbox: "text-zinc-700 dark:text-zinc-200"
};

const appBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
type PreviewItem = AIParseResult["items"][number];

export default function Home() {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [storedProjects, setStoredProjects] = useState<ProjectNode[]>([]);
  const [areas, setAreas] = useState<Area[]>(defaultAreas);
  const [members, setMembers] = useState<Member[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeStore>(defaultKnowledge);
  const [financeTransactions, setFinanceTransactions] = useState<FinanceTransaction[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [learnedRules, setLearnedRules] = useState<LearnedRule[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>("plan");
  const [ownerFilter, setOwnerFilter] = useState<"me" | "shared" | "all">("all");
  const [planMode, setPlanMode] = useState<"day" | "week" | "month">("day");
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [purchaseView, setPurchaseView] = useState<PurchaseStatus>("planned");
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
  const [isHydrated, setIsHydrated] = useState(false);
  const [toast, setToast] = useState<{ title: string; detail?: string; actionLabel?: string; onAction?: () => void } | null>(null);
  const [quickSheetOpen, setQuickSheetOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [editingPreviewIndex, setEditingPreviewIndex] = useState<number | null>(null);
  const [highlightEntryId, setHighlightEntryId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [draftRecovered, setDraftRecovered] = useState(false);
  const [detailEntryId, setDetailEntryId] = useState<string | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const keepListeningRef = useRef(false);
  const voiceBaseTextRef = useRef("");
  const latestQuickTextRef = useRef("");
  const parseAfterStopRef = useRef(false);
  const previewRef = useRef<HTMLElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    // localStorage is only available after hydration; this keeps server render deterministic.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEntries(loadEntries());
    setStoredProjects(loadProjects());
    setAreas(loadAreas());
    setMembers(loadMembers());
    setKnowledge(loadKnowledge());
    setFinanceTransactions(loadFinanceTransactions());
    setSavingsGoals(loadSavingsGoals());
    setSettings(loadSettings());
    setLearnedRules(loadLearnedRules());
    const draft = loadDraft();
    const savedPreview = loadPreviewState();
    if (draft?.quickText) {
      setQuickText(draft.quickText);
      setDraftRecovered(true);
    }
    if (savedPreview?.preview) setPreview(savedPreview.preview);
    setIsHydrated(true);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register(`${appBasePath}/sw.js`, { scope: `${appBasePath || "/"}` })
        .then((registration) => {
          registration.addEventListener("updatefound", () => {
            const worker = registration.installing;
            worker?.addEventListener("statechange", () => {
              if (worker.state === "installed" && navigator.serviceWorker.controller) {
                setToast({ title: "Доступна новая версия", detail: "Обнови страницу, чтобы увидеть свежий интерфейс.", actionLabel: "Обновить", onAction: () => window.location.reload() });
              }
            });
          });
        })
        .catch(() => undefined);
    }
    setSpeechSupported(Boolean(window.SpeechRecognition || window.webkitSpeechRecognition));
  }, []);

  useEffect(() => {
    if (isHydrated) saveEntries(entries);
  }, [entries, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    saveProjects(storedProjects);
  }, [storedProjects, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    saveAreas(areas);
  }, [areas, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    saveMembers(members);
  }, [members, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    saveKnowledge(knowledge);
  }, [knowledge, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    saveFinanceTransactions(financeTransactions);
  }, [financeTransactions, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    saveSavingsGoals(savingsGoals);
  }, [savingsGoals, isHydrated]);

  useEffect(() => {
    latestQuickTextRef.current = quickText;
    if (!isHydrated) return;
    saveDraft(quickText.trim() ? { quickText, timestamp: new Date().toISOString(), source: isListening ? "voice" : "typing" } : null);
  }, [quickText, isHydrated, isListening]);

  useEffect(() => {
    if (!isHydrated) return;
    savePreviewState(preview ? { preview, timestamp: new Date().toISOString() } : null);
  }, [preview, isHydrated]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const projects = useMemo<ProjectNode[]>(() => {
    const names = new Map<string, ProjectNode>();
    for (const project of storedProjects) {
      names.set(`${project.area ?? ""}/${project.name}`, project);
    }
    for (const entry of entries) {
      const area = entry.area ?? entry.projectPath[0];
      const name = entry.project ?? entry.projectPath.at(-1);
      if (name && !names.has(`${area ?? ""}/${name}`)) {
        names.set(`${area ?? ""}/${name}`, { id: `${area ?? ""}-${name}`, name, area, aliases: [], createdAt: entry.createdAt, updatedAt: entry.updatedAt, revision: entry.revision });
      }
    }
    return [...names.values()];
  }, [entries, storedProjects]);

  const activeEntries = entries.filter((entry) => entry.status !== "done" && entry.status !== "cancelled");
  const todayEntries = activeEntries.filter((entry) => entry.dueDate === todayIso() || entry.schedule === "today" || isOverdue(entry.dueDate));
  const importantEntries = activeEntries.filter((entry) => entry.priority === "high");
  const budgetSummary = useMemo(() => calculateBudget(entries), [entries]);
  const recentContext = useMemo(() => {
    const latest = entries.find((entry) => entry.area || entry.project || entry.domain);
    return latest
      ? {
          area: latest.area,
          project: latest.project,
          domain: latest.domain,
          updatedAt: latest.updatedAt
        }
      : undefined;
  }, [entries]);

  const visibleEntries = useMemo(() => {
    const base = entries.filter((entry) => entry.status !== "cancelled" && matchesOwner(entry, ownerFilter));
    if (activeTab === "today") {
      return base.filter(
        (entry) =>
          entry.status !== "done" &&
          (entry.dueDate === todayIso() || entry.schedule === "today" || isOverdue(entry.dueDate))
      );
    }
    if (activeTab === "week") {
      return base.filter((entry) =>
        listMode === "this" ? entry.schedule === "this_week" || isThisWeek(entry.dueDate) : entry.schedule === "next_week"
      );
    }
    if (activeTab === "plan") return base.filter((entry) => entry.status !== "done");
    if (activeTab === "tasks") return base.filter((entry) => entry.kind === "task");
    if (activeTab === "purchases") return base.filter((entry) => entry.kind === "purchase");
    if (activeTab === "ideas") return base.filter((entry) => entry.kind === "idea");
    if (activeTab === "someday") return base.filter((entry) => entry.schedule === "someday");
    if (activeTab === "inbox") return base.filter((entry) => entry.needsReview);
    if (activeTab === "projects") return base.filter((entry) => entry.projectPath.length);
    if (activeTab === "budget") return base.filter((entry) => entry.kind === "purchase");
    return base;
  }, [activeTab, entries, listMode, ownerFilter]);

  const planData = useMemo(() => {
    const base = entries.filter((entry) => entry.status !== "done" && entry.status !== "cancelled" && matchesOwner(entry, ownerFilter));
    const today = todayIso();
    const weekDays = getWeekDays(selectedDate);
    const monthPrefix = selectedDate.slice(0, 7);
    return {
      weekDays,
      overdue: base.filter((entry) => Boolean(entry.dueDate) && entry.dueDate! < today),
      selected: base.filter((entry) => entry.dueDate === selectedDate || (selectedDate === today && entry.schedule === "today")),
      week: base.filter((entry) => entry.dueDate ? weekDays.includes(entry.dueDate) : entry.schedule === "this_week"),
      month: base.filter((entry) => entry.dueDate?.startsWith(monthPrefix) || entry.schedule === "this_month"),
      unscheduled: base.filter((entry) => !entry.dueDate && entry.schedule === "none"),
      someday: base.filter((entry) => entry.schedule === "someday")
    };
  }, [entries, ownerFilter, selectedDate]);

  const selectedDetailEntry = detailEntryId ? entries.find((entry) => entry.id === detailEntryId) ?? null : null;

  async function parseText(inputText: string, options: { autoSaveEligible?: boolean; source?: "voice" | "button" } = {}) {
    const text = inputText.trim();
    if (!text) return;
    setIsParsing(true);
    setPreview(null);
    setVoiceMessage(options.source === "voice" ? "Разбираю запись..." : "Разбираю...");
    try {
      const result = parseSmartInput(text, {
        timezone: settings.timezone,
        learnedRules,
        projects,
        areas,
        knowledge,
        recentContext,
        settings
      });

        if (!result.items.length) {
          saveInboxFallback(text, "Не удалось уверенно разобрать запись. Она сохранена в Inbox.");
          return;
        }

        const nextPreview: AIParseResult = {
          confidence: result.confidence,
          needsReview: result.needsReview,
          rawText: text,
          items: result.items
        };

        const shouldAutoSave =
          options.autoSaveEligible &&
          settings.autoSaveAfterParse &&
          nextPreview.confidence >= 0.8 &&
          !nextPreview.needsReview &&
          nextPreview.items.every((item) => (item.confidence ?? nextPreview.confidence) >= 0.8 && !item.needsReview);

        if (shouldAutoSave) {
          const saved = nextPreview.items.map(createEntryFromParsed);
          addEntries(saved);
          setQuickText("");
          setVoiceMessage(`Готово — сохранено ${saved.length} ${pluralRecords(saved.length)}.`);
          showSaveToast(saved);
          return;
        }

        setPreview(nextPreview);
        setVoiceMessage(`Готово — найдено ${nextPreview.items.length} ${pluralRecords(nextPreview.items.length)}.`);
        window.setTimeout(() => previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    } catch {
      saveInboxFallback(text, "Не удалось разобрать запись. Я сохранил исходный текст в Inbox.");
    } finally {
      setIsParsing(false);
    }
  }

  async function parseQuickText() {
    const text = quickText.trim();
    if (!text) return;
    const savingsCommand = parseSavingsCommand(text);
    if (savingsCommand?.action === "create" && savingsCommand.amount) {
      addSavingsGoal(savingsCommand.title, savingsCommand.amount);
      setQuickText("");
      setToast({ title: "Накопление создано", detail: `${savingsCommand.title}: ${savingsCommand.amount.toLocaleString("ru-RU")} ${settings.defaultCurrency}` });
      return;
    }
    if (savingsCommand?.action === "deposit" && savingsCommand.amount) {
      const goal = savingsGoals.find((item) => textMatches(item.title, savingsCommand.title));
      if (goal) {
        depositSavings(goal.id, savingsCommand.amount);
        setQuickText("");
        setToast({ title: "Накопление обновлено", detail: `${goal.title}: +${savingsCommand.amount.toLocaleString("ru-RU")} ${goal.currency}` });
        return;
      }
    }
    await parseText(text, { source: "button" });
  }

  function saveInboxFallback(text: string, message: string) {
    const now = new Date().toISOString();
    const entry: DiaryEntry = {
      id: crypto.randomUUID(),
      kind: "note",
      title: text.slice(0, 86) || "Неразобранная запись",
      description: text,
      area: "Личное",
      projectPath: [],
      assignedTo: "me",
      visibility: "private",
      createdBy: "me",
      updatedBy: "me",
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
    };
    addEntries([entry]);
    setQuickText("");
    setPreview(null);
    setVoiceMessage(message);
    setToast({ title: "Сохранено в Разобрать", detail: message });
  }

  function toggleVoiceInput() {
    if (isListening) {
      keepListeningRef.current = false;
      parseAfterStopRef.current = true;
      recognitionRef.current?.stop();
      setIsListening(false);
      setVoiceMessage("Запись остановлена. Фиксирую текст...");
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
      if (parseAfterStopRef.current) {
        parseAfterStopRef.current = false;
        const finalText = latestQuickTextRef.current.trim();
        if (finalText) {
          void parseText(finalText, { autoSaveEligible: true, source: "voice" });
        } else {
          setVoiceMessage("Запись остановлена, но текст не распознан.");
        }
      }
    };
    recognition.onerror = (event) => {
      keepListeningRef.current = false;
      parseAfterStopRef.current = false;
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
    const area = kind === "purchase" ? "Дом" : "Личное";
    const assignedTo = kind === "purchase" ? settings.defaultHomePurchaseAssignee : settings.defaultPersonalAssignee;
    addEntries([
      {
        id: crypto.randomUUID(),
        kind,
        title: text || "Новая запись",
        description: text,
        area,
        projectPath: [],
        assignedTo,
        visibility: assignedTo === "shared" ? "shared" : "private",
        createdBy: "me",
        updatedBy: "me",
        status: kind === "purchase" ? "want_to_buy" : "active",
        priority: "normal",
        schedule: "none",
        repeat: "none",
        checklist: [],
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
    const saved = preview.items.map(createConfirmedEntry);
    addEntries(saved);
    setPreview(null);
    setQuickText("");
    saveDraft(null);
    savePreviewState(null);
    setVoiceMessage("Готово. Можно продолжать следующую диктовку.");
    showSaveToast(saved);
  }

  function savePreviewItem(index: number) {
    if (!preview?.items[index]) return;
    const saved = createConfirmedEntry(preview.items[index]);
    addEntries([saved]);
    setPreview((current) => {
      if (!current) return null;
      const nextItems = current.items.filter((_, itemIndex) => itemIndex !== index);
      return nextItems.length ? { ...current, items: nextItems } : null;
    });
    if (preview.items.length === 1) {
      setQuickText("");
      saveDraft(null);
      savePreviewState(null);
    }
    setHighlightEntryId(saved.id);
    setVoiceMessage("Готово. Можно продолжать следующую диктовку.");
    setToastForSaved([saved]);
  }

  function removePreviewItem(index: number) {
    setPreview((current) => {
      if (!current) return null;
      const nextItems = current.items.filter((_, itemIndex) => itemIndex !== index);
      return nextItems.length ? { ...current, items: nextItems } : null;
    });
  }

  function saveRawPreviewToInbox() {
    if (!preview?.rawText) return;
    saveInboxFallback(preview.rawText, "Исходный текст сохранён в Inbox.");
  }

  function showSaveToast(saved: DiaryEntry[]) {
    setToastForSaved(saved);
  }

  function createConfirmedEntry(item: PreviewItem): DiaryEntry {
    const saved = createEntryFromParsed({
      ...item,
      kind: item.kind === "inbox" ? "note" : item.kind,
      needsReview: false,
      project: item.project ?? item.projectCandidate,
      area: item.area ?? item.projectPath[0],
      projectPath: item.projectPath.length ? item.projectPath : [item.area, item.project ?? item.projectCandidate].filter(Boolean) as string[]
    });
    if (item.projectCandidate && (item.area || item.projectPath[0])) {
      confirmProjectCandidate(item.projectCandidate, item.area ?? item.projectPath[0] ?? "Личное", item.domain);
    }
    return {
      ...saved,
      needsReview: false,
      revision: saved.revision ?? 1,
      createdBy: saved.createdBy ?? "me",
      updatedBy: "me"
    };
  }

  function confirmProjectCandidate(name: string, area: string, domain?: DiaryEntry["domain"]) {
    setStoredProjects((current) => {
      if (current.some((project) => project.name.toLowerCase() === name.toLowerCase() && project.area === area)) return current;
      const now = new Date().toISOString();
      return [{ id: `${area}-${name}`, name, area, aliases: [name.toLowerCase()], createdAt: now, updatedAt: now, revision: 1 }, ...current];
    });
    setKnowledge((current) => ({
      ...current,
      knownEntities: {
        ...current.knownEntities,
        [name.toLowerCase()]: { area, project: name, domain }
      },
      projectAliases: {
        ...current.projectAliases,
        [name]: [...(current.projectAliases[name] ?? []), name.toLowerCase()]
      }
    }));
  }

  function setToastForSaved(saved: DiaryEntry[]) {
    const firstKind = saved[0]?.kind ?? "inbox";
    const first = saved[0];
    const targetTab = firstKind === "purchase" ? "purchases" : firstKind === "idea" ? "ideas" : firstKind === "inbox" ? "inbox" : "plan";
    const actionLabel = first?.project ? "Открыть проект" : first?.dueDate || first?.schedule === "today" ? "Открыть дату" : "Открыть";
    setToast({
      title: saved.length === 1 ? `✓ Сохранено в ${sectionLabel(firstKind)}` : `✓ Сохранено: ${summarizeKinds(saved)}`,
      detail: saved.length === 1 ? saved[0]?.title : undefined,
      actionLabel,
      onAction: () => {
        if (first?.dueDate) setSelectedDate(first.dueDate);
        if (first?.project) {
          setSelectedArea(first.area ?? null);
          setSelectedProject(first.project);
        }
        selectTab(targetTab);
        setHighlightEntryId(saved[0]?.id ?? null);
      }
    });
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

  function updatePreviewItem(index: number, patch: Partial<PreviewItem>) {
    if (!preview) return;
    setPreview({
      ...preview,
      items: preview.items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item))
    });
  }

  async function askDiary() {
    const value = query.trim();
    if (!value) return;
    setAnswer(answerDiaryLocally(value, entries, savingsGoals));
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
    const deleted = entries.find((entry) => entry.id === id);
    setEntries((current) => current.filter((item) => item.id !== id));
    if (deleted) {
      setToast({
        title: "Удалено",
        detail: deleted.title,
        actionLabel: "Отменить",
        onAction: () => setEntries((current) => [deleted, ...current])
      });
    }
  }

  function updateSettings(next: AppSettings) {
    setSettings(next);
    saveSettings(next);
  }

  function clearAllEntries() {
    if (!window.confirm("Очистить все записи? Это удалит задачи, покупки, идеи и Inbox на этом устройстве.")) return;
    setEntries([]);
    setPreview(null);
    clearEntriesStorage();
    setToast({ title: "Все записи очищены", detail: "Можно начинать с чистой базы." });
  }

  function clearRules() {
    if (!window.confirm("Очистить learned rules? Парсер забудет сохранённые правила классификации.")) return;
    setLearnedRules([]);
    clearLearnedRules();
    setToast({ title: "Правила очищены" });
  }

  function clearEverything() {
    if (!window.confirm("Очистить все данные ежедневника на этом устройстве?")) return;
    setEntries([]);
    setLearnedRules([]);
    setPreview(null);
    setAnswer(null);
    setQuickText("");
    clearAllDnevnikStorage({ learnedRules: true });
    setToast({ title: "Все данные очищены", detail: "Старая тестовая база больше не подмешивается." });
  }

  function exportLocalData() {
    const data = exportDnevnikData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dnevnik-export-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function importLocalData(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const ok = importDnevnikData(JSON.parse(String(reader.result)));
        if (!ok) throw new Error("Invalid export");
        setEntries(loadEntries());
        setStoredProjects(loadProjects());
        setAreas(loadAreas());
        setMembers(loadMembers());
        setKnowledge(loadKnowledge());
        setFinanceTransactions(loadFinanceTransactions());
        setSavingsGoals(loadSavingsGoals());
        setSettings(loadSettings());
        setToast({ title: "Импорт выполнен", detail: "Данные восстановлены из JSON." });
      } catch {
        setToast({ title: "Импорт не выполнен", detail: "Файл не похож на экспорт Ежедневника." });
      }
    };
    reader.readAsText(file);
  }

  function addSavingsGoal(title: string, amount: number) {
    if (!title.trim() || amount <= 0) return;
    setSavingsGoals((current) => [createSavingsGoal(title.trim(), amount, settings.defaultCurrency), ...current]);
  }

  function depositSavings(goalId: string, amount: number) {
    if (amount <= 0) return;
    setSavingsGoals((current) =>
      current.map((goal) => {
        if (goal.id !== goalId) return goal;
        const result = addToSavingsGoal(goal, amount);
        setFinanceTransactions((transactions) => [result.transaction, ...transactions]);
        return result.goal;
      })
    );
  }

  function selectTab(tab: TabId) {
    setActiveTab(tab);
    if (tab !== "projects") setSelectedProject(null);
    window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 0);
  }

  function openQuickSheet() {
    setQuickSheetOpen(true);
  }

  function focusTextInput() {
    setQuickSheetOpen(false);
    setCaptureOpen(true);
    window.setTimeout(() => textareaRef.current?.focus(), 120);
  }

  function startVoiceFromSheet() {
    setQuickSheetOpen(false);
    setCaptureOpen(true);
    window.setTimeout(() => {
      if (!isListening) toggleVoiceInput();
    }, 120);
  }

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-7xl gap-5 px-4 pb-28 pt-4 md:grid-cols-[220px_minmax(0,1fr)] md:px-6 md:pb-8 lg:px-8">
      <DesktopSidebar activeTab={activeTab} onChange={selectTab} />

      <div className="min-w-0 space-y-5">
        <Header todayCount={todayEntries.length} importantCount={importantEntries.length} />

        {draftRecovered ? (
          <GlassPanel className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <div className="font-black">У вас осталась незавершённая запись</div>
              <p className="text-sm text-[var(--muted)]">Текст восстановлен из локального черновика.</p>
            </div>
            <div className="flex gap-2">
              <GlassButton className="px-4 font-bold" onClick={() => setDraftRecovered(false)}>
                Продолжить
              </GlassButton>
              <GlassButton
                className="px-4 font-bold"
                onClick={() => {
                  setQuickText("");
                  setDraftRecovered(false);
                  saveDraft(null);
                }}
              >
                Удалить
              </GlassButton>
            </div>
          </GlassPanel>
        ) : null}

        {activeTab === "plan" ? (
          <GlassSegmentedControl
            onChange={(value) => setOwnerFilter(value as "me" | "shared" | "all")}
            options={[
              { label: "Моё", value: "me" },
              { label: "Общее", value: "shared" },
              { label: "Всё", value: "all" }
            ]}
            value={ownerFilter}
          />
        ) : null}

        {captureOpen || quickText || isListening ? (
        <GlassPanel className="overflow-hidden p-4 sm:p-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <GlassBadge>Быстрый ввод</GlassBadge>
                <GlassBadge>{isListening ? "запись идет" : "готово"}</GlassBadge>
              </div>
              <GlassTextarea
                ref={textareaRef}
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
                <GlassButton className="px-4 font-semibold" onClick={() => setCaptureOpen(false)}>
                  Свернуть
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
        ) : null}

        {preview ? (
          <SmartPreview
            advanced={settings.advancedMode}
            onEdit={(index) => setEditingPreviewIndex(index)}
            onKindChange={updatePreviewKind}
            onRawSave={saveRawPreviewToInbox}
            onRemember={rememberRule}
            onRemove={removePreviewItem}
            onSave={savePreview}
            onSaveItem={savePreviewItem}
            preview={preview}
            refNode={previewRef}
          />
        ) : null}

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

          {activeTab === "plan" ? (
            <PlanScreen
              highlightedId={highlightEntryId}
              mode={planMode}
              onComplete={completeEntry}
              onDateChange={setSelectedDate}
              onDelete={deleteEntry}
              onModeChange={setPlanMode}
              onOpen={(entry) => setDetailEntryId(entry.id)}
              onUpdate={updateEntry}
              planData={planData}
              selectedDate={selectedDate}
            />
          ) : activeTab === "settings" ? (
            <SettingsPanel
              answer={answer}
              onClearAll={clearEverything}
              onClearEntries={clearAllEntries}
              onClearRules={clearRules}
              onExport={exportLocalData}
              onImport={importLocalData}
              onNavigate={selectTab}
              onAsk={askDiary}
              members={members}
              query={query}
              setQuery={setQuery}
              settings={settings}
              onChange={updateSettings}
              rulesCount={learnedRules.length}
              storageVersionLabel={isHydrated ? storageVersion() : "2"}
            />
          ) : activeTab === "budget" ? (
            <BudgetPanel
              budget={budgetSummary}
              goals={savingsGoals}
              onAddGoal={(title, amount) => addSavingsGoal(title, amount)}
              onDeposit={(goalId, amount) => depositSavings(goalId, amount)}
            />
          ) : activeTab === "projects" ? (
            <ProjectBoard
              areas={areas}
              entries={entries}
              highlightedId={highlightEntryId}
              onBack={() => setSelectedProject(null)}
              onBackArea={() => setSelectedArea(null)}
              onComplete={completeEntry}
              onDelete={deleteEntry}
              onSelect={setSelectedProject}
              onSelectArea={setSelectedArea}
              onUpdate={updateEntry}
              projects={projects}
              selectedArea={selectedArea}
              selectedProject={selectedProject}
              onOpen={(entry) => setDetailEntryId(entry.id)}
            />
          ) : activeTab === "purchases" ? (
            <PurchasesScreen
              entries={entries.filter((entry) => entry.kind === "purchase" && entry.status !== "cancelled" && matchesOwner(entry, ownerFilter))}
              highlightedId={highlightEntryId}
              onDelete={deleteEntry}
              onOpen={(entry) => setDetailEntryId(entry.id)}
              onStatusChange={(entry, status) => updateEntry(entry.id, { purchase: { ...entry.purchase, status }, status: purchaseStatusToEntryStatus(status) })}
              onUpdate={updateEntry}
              status={purchaseView}
              onStatusViewChange={setPurchaseView}
            />
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
                    highlighted={entry.id === highlightEntryId}
                    key={entry.id}
                    onComplete={() => completeEntry(entry)}
                    onDelete={() => deleteEntry(entry.id)}
                    onOpen={() => setDetailEntryId(entry.id)}
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

      <MobileDock activeTab={activeTab} onAdd={openQuickSheet} onChange={selectTab} />
      {quickSheetOpen ? (
        <QuickInputSheet
          onClose={() => setQuickSheetOpen(false)}
          onText={focusTextInput}
          onVoice={startVoiceFromSheet}
        />
      ) : null}
      {editingPreviewIndex !== null && preview?.items[editingPreviewIndex] ? (
        <PreviewEditSheet
          item={preview.items[editingPreviewIndex]}
          onChange={(patch) => updatePreviewItem(editingPreviewIndex, patch)}
          onClose={() => setEditingPreviewIndex(null)}
        />
      ) : null}
      {selectedDetailEntry ? (
        <EntryDetailSheet
          entry={selectedDetailEntry}
          onChange={(patch) => updateEntry(selectedDetailEntry.id, patch)}
          onClose={() => setDetailEntryId(null)}
          onDelete={() => {
            deleteEntry(selectedDetailEntry.id);
            setDetailEntryId(null);
          }}
        />
      ) : null}
      {toast ? <Toast actionLabel={toast.actionLabel} detail={toast.detail} onAction={toast.onAction} title={toast.title} /> : null}
    </main>
  );
}

function answerDiaryLocally(query: string, entries: DiaryEntry[], savingsGoals: SavingsGoal[]): AIQueryResult {
  const normalized = query.toLowerCase();
  const active = entries.filter((entry) => entry.status !== "done" && entry.status !== "cancelled");
  const purchases = active.filter((entry) => entry.kind === "purchase");
  const repair = active.filter((entry) => entry.projectPath.join(" ").toLowerCase().includes("ремонт"));
  const today = active.filter((entry) => entry.dueDate === todayIso() || entry.schedule === "today");
  const planned = calculateBudget(entries).planned;

  const projectQuestion = normalized.match(/что\s+по\s+(.+?)[?.!]?$/i);
  if (projectQuestion) {
    const needle = projectQuestion[1].trim().toLowerCase();
    const related = active.filter((entry) => textMatches(`${entry.title} ${entry.project ?? ""} ${entry.area ?? ""}`, needle));
    return {
      answer: related.length ? `По ${projectQuestion[1]}: ${related.map((item) => item.title).join(", ")}.` : "По этому проекту активных записей не нашлось.",
      relatedIds: related.map((item) => item.id)
    };
  }

  const savingsQuery = parseSavingsCommand(normalized);
  if (savingsQuery?.action === "query") {
    const goal = savingsGoals.find((item) => textMatches(item.title, savingsQuery.title));
    return {
      answer: goal ? `На ${goal.title} осталось накопить ${(goal.targetAmount - goal.currentAmount).toLocaleString("ru-RU")} ${goal.currency}.` : "Такого накопления пока нет.",
      relatedIds: []
    };
  }

  if (normalized.includes("куп")) {
    const total = purchases.reduce((sum, item) => sum + (item.totalPrice ?? item.unitPrice ?? 0), 0);
    return {
      answer: purchases.length ? `Купить: ${purchases.map((item) => item.title).join(", ")}. Примерная сумма: ${total.toLocaleString("ru-RU")} ₽.` : "Открытых покупок пока нет.",
      relatedIds: purchases.map((item) => item.id)
    };
  }

  if (normalized.includes("ремонт")) {
    return {
      answer: repair.length ? `По ремонту осталось: ${repair.map((item) => item.title).join(", ")}.` : "По ремонту активных записей не нашлось.",
      relatedIds: repair.map((item) => item.id)
    };
  }

  if (normalized.includes("сегодня")) {
    return {
      answer: today.length ? `Сегодня: ${today.map((item) => item.title).join(", ")}.` : "На сегодня ничего не запланировано.",
      relatedIds: today.map((item) => item.id)
    };
  }

  if (normalized.includes("запланировано") || normalized.includes("бюджет")) {
    return {
      answer: `Запланировано покупок на ${planned.toLocaleString("ru-RU")} ₽.`,
      relatedIds: purchases.map((item) => item.id)
    };
  }

  return {
    answer: "Для такого вопроса потребуется AI-провайдер.",
    relatedIds: []
  };
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
  const primaryTabs: TabId[] = ["plan", "projects", "purchases", "settings"];
  return (
    <aside className="sticky top-4 hidden h-[calc(100vh-32px)] md:block">
      <GlassPanel className="flex h-full flex-col gap-2 p-3">
        <div className="px-3 py-4">
          <div className="text-xl font-black">ЕЖЕДНЕВНИК</div>
          <p className="text-xs text-[var(--muted)]">smart local parser</p>
        </div>
        {primaryTabs.map((tabId) => {
          const tab = tabs.find((item) => item.id === tabId)!;
          return (
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
          );
        })}
      </GlassPanel>
    </aside>
  );
}

function MobileDock({ activeTab, onAdd, onChange }: { activeTab: TabId; onAdd: () => void; onChange: (tab: TabId) => void }) {
  const mobileTabs: TabId[] = ["plan", "projects", "purchases", "settings"];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-[70] mx-auto flex w-[min(94vw,430px)] items-center justify-between rounded-full border border-white/50 bg-white/70 px-3 py-2 shadow-2xl backdrop-blur-2xl md:hidden dark:border-white/10 dark:bg-zinc-950/70 mb-[calc(12px+env(safe-area-inset-bottom))]">
      {mobileTabs.slice(0, 2).map((id) => {
        const tab = tabs.find((item) => item.id === id)!;
        return <DockButton active={activeTab === id} icon={<tab.icon size={19} />} key={id} label={tab.label} onClick={() => onChange(id)} />;
      })}
      <button className="grid h-14 w-14 min-w-14 place-items-center rounded-full bg-[var(--foreground)] text-[var(--background)] shadow-xl" onClick={onAdd} type="button" aria-label="Открыть быстрый ввод">
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
    <button className={`grid min-h-12 min-w-12 place-items-center rounded-full px-2 text-[11px] font-bold ${active ? "bg-white/70 shadow-sm dark:bg-white/12" : "text-[var(--muted)]"}`} onClick={onClick} type="button" aria-current={active ? "page" : undefined}>
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
  advanced,
  onEdit,
  onKindChange,
  onRawSave,
  onRemember,
  onRemove,
  onSave,
  onSaveItem,
  preview,
  refNode
}: {
  advanced: boolean;
  onEdit: (index: number) => void;
  onKindChange: (index: number, kind: EntryKind) => void;
  onRawSave: () => void;
  onRemember: (index: number) => void;
  onRemove: (index: number) => void;
  onSave: () => void;
  onSaveItem: (index: number) => void;
  preview: AIParseResult;
  refNode: React.RefObject<HTMLElement | null>;
}) {
  return (
    <GlassPanel className="p-4" ref={refNode}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black">Я понял так:</h2>
          <p className="text-sm text-[var(--muted)]">{preview.items.length} {pluralRecords(preview.items.length)}. Сохрани подходящие карточки или поправь их перед сохранением.</p>
        </div>
        <GlassButton className="hidden px-5 font-bold text-white [background:linear-gradient(135deg,#176bff,#7b61ff)] sm:inline-flex" onClick={onSave}>
          Сохранить всё
        </GlassButton>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {preview.items.map((item, index) => (
          <GlassCard className="p-4" key={`${item.title}-${index}`}>
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <GlassBadge className={kindTone[item.kind]}>{kindLabel[item.kind]}</GlassBadge>
                <h3 className="mt-3 text-lg font-black">{item.title}</h3>
              </div>
              <button className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/60 text-lg font-black text-[var(--muted)] dark:bg-white/10" onClick={() => onRemove(index)} type="button" aria-label="Удалить из результата">
                ×
              </button>
            </div>
            <div className="grid gap-2 text-sm text-[var(--muted)]">
              <span>{item.area ?? item.projectPath?.[0] ?? "без области"}{item.project || item.projectCandidate ? ` -> ${item.project ?? item.projectCandidate}` : ""}</span>
              {item.projectCandidate ? <span className="font-bold text-[var(--accent)]">Новый проект: {item.projectCandidate}</span> : null}
              <span>{ownerLabel(item.assignedTo)}</span>
              <span>{item.dueDate ? formatDateRu(item.dueDate) : scheduleLabel(item.schedule)}</span>
              {item.totalPrice || item.unitPrice ? <span>{item.quantity ? `${item.quantity} × ` : ""}{item.unitPrice ?? item.totalPrice} {item.currency ?? "RUB"}</span> : null}
              {item.url ? <span className="truncate">{item.url}</span> : null}
            </div>
            <div className="mt-4 grid grid-cols-[1fr_1fr] gap-2">
              <GlassButton className="h-11 justify-center px-3 text-sm font-black text-white [background:linear-gradient(135deg,#176bff,#7b61ff)]" onClick={() => onSaveItem(index)}>
                Сохранить
              </GlassButton>
              <GlassButton className="h-11 justify-center px-3 text-sm font-black" onClick={() => onEdit(index)}>
                Изменить
              </GlassButton>
            </div>
            {advanced ? (
              <div className="mt-3 flex flex-wrap gap-2 border-t border-white/30 pt-3 text-xs dark:border-white/10">
                <select className="glass-input h-9 rounded-full px-3 text-xs" value={item.kind} onChange={(event) => onKindChange(index, event.target.value as EntryKind)}>
                  <option value="task">Задача</option>
                  <option value="purchase">Покупка</option>
                  <option value="idea">Идея</option>
                  <option value="note">Заметка</option>
                </select>
                <GlassButton className="px-3 text-xs" onClick={() => onRemember(index)}>
                  Запомнить правило
                </GlassButton>
                <span className="self-center text-[var(--muted)]">{item.parsedBy} · {Math.round((item.confidence ?? preview.confidence) * 100)}%</span>
              </div>
            ) : null}
          </GlassCard>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <GlassButton className="px-5 font-bold text-white [background:linear-gradient(135deg,#176bff,#7b61ff)]" onClick={onSave}>
          Сохранить всё
        </GlassButton>
        <GlassButton className="px-5 font-bold" onClick={onRawSave}>
          Сохранить исходный текст в Inbox
        </GlassButton>
      </div>
    </GlassPanel>
  );
}

function BudgetPanel({
  budget,
  goals,
  onAddGoal,
  onDeposit
}: {
  budget: ReturnType<typeof calculateBudget>;
  goals: SavingsGoal[];
  onAddGoal: (title: string, amount: number) => void;
  onDeposit: (goalId: string, amount: number) => void;
}) {
  const [goalTitle, setGoalTitle] = useState("");
  const [goalAmount, setGoalAmount] = useState("");
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Потрачено" value={`${budget.actual.toLocaleString("ru-RU")} ₽`} detail="куплено" icon={<WalletCards size={18} />} />
        <MetricCard label="Запланировано" value={`${budget.planned.toLocaleString("ru-RU")} ₽`} detail="открытые покупки" icon={<ShoppingCart size={18} />} />
        <MetricCard label="Накопления" value={`${goals.length}`} detail="целей" icon={<Sparkles size={18} />} />
      </div>
      <GlassCard className="grid gap-3 p-4">
        <h3 className="text-lg font-black">По областям</h3>
        {budget.byArea.length ? budget.byArea.map((item) => (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/40 px-3 py-2 dark:bg-white/5" key={item.area}>
            <span className="font-bold">{item.area}</span>
            <span>{item.amount.toLocaleString("ru-RU")} ₽</span>
          </div>
        )) : <p className="text-sm text-[var(--muted)]">Покупок с суммами пока нет.</p>}
      </GlassCard>
      <GlassCard className="grid gap-3 p-4">
        <h3 className="text-lg font-black">Накопления</h3>
        <div className="grid gap-2 sm:grid-cols-[1fr_160px_auto]">
          <input className="glass-input h-11 px-3" placeholder="На что копим" value={goalTitle} onChange={(event) => setGoalTitle(event.target.value)} />
          <input className="glass-input h-11 px-3" inputMode="decimal" placeholder="Цель" value={goalAmount} onChange={(event) => setGoalAmount(event.target.value)} />
          <GlassButton className="px-4 font-bold" onClick={() => { onAddGoal(goalTitle, numberOrUndefined(goalAmount) ?? 0); setGoalTitle(""); setGoalAmount(""); }}>
            Добавить
          </GlassButton>
        </div>
        {goals.map((goal) => {
          const progress = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
          return (
            <div className="rounded-2xl bg-white/40 p-3 dark:bg-white/5" key={goal.id}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-black">{goal.title}</div>
                  <div className="text-sm text-[var(--muted)]">{goal.currentAmount.toLocaleString("ru-RU")} / {goal.targetAmount.toLocaleString("ru-RU")} {goal.currency}</div>
                </div>
                <GlassButton className="px-3 text-sm font-bold" onClick={() => onDeposit(goal.id, 10000)}>
                  +10 000
                </GlassButton>
              </div>
              <div className="mt-3 h-2 rounded-full bg-white/50 dark:bg-white/10">
                <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${progress}%` }} />
              </div>
            </div>
          );
        })}
      </GlassCard>
    </div>
  );
}

function PlanScreen({
  highlightedId,
  mode,
  onComplete,
  onDateChange,
  onDelete,
  onModeChange,
  onOpen,
  onUpdate,
  planData,
  selectedDate
}: {
  highlightedId: string | null;
  mode: "day" | "week" | "month";
  onComplete: (entry: DiaryEntry) => void;
  onDateChange: (date: string) => void;
  onDelete: (id: string) => void;
  onModeChange: (mode: "day" | "week" | "month") => void;
  onOpen: (entry: DiaryEntry) => void;
  onUpdate: (id: string, patch: Partial<DiaryEntry>) => void;
  planData: {
    weekDays: string[];
    overdue: DiaryEntry[];
    selected: DiaryEntry[];
    week: DiaryEntry[];
    month: DiaryEntry[];
    unscheduled: DiaryEntry[];
    someday: DiaryEntry[];
  };
  selectedDate: string;
}) {
  const primaryEntries = mode === "day" ? planData.selected : mode === "week" ? planData.week : planData.month;
  return (
    <div className="grid gap-4">
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-black">{formatPlanDate(selectedDate)}</h3>
            <p className="text-sm text-[var(--muted)]">Календарь, задачи, покупки и идеи в одном плане.</p>
          </div>
          <GlassSegmentedControl
            onChange={(value) => onModeChange(value as "day" | "week" | "month")}
            options={[
              { label: "День", value: "day" },
              { label: "Неделя", value: "week" },
              { label: "Месяц", value: "month" }
            ]}
            value={mode}
          />
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {planData.weekDays.map((date) => (
            <button
              className={`min-h-16 rounded-2xl px-1 text-center text-sm font-black transition ${
                date === selectedDate ? "bg-[var(--foreground)] text-[var(--background)] shadow-lg" : "bg-white/50 text-[var(--foreground)] dark:bg-white/8"
              }`}
              key={date}
              onClick={() => onDateChange(date)}
              type="button"
            >
              <span className="block text-[11px] opacity-70">{shortWeekday(date)}</span>
              <span className="block text-lg">{Number(date.slice(8, 10))}</span>
            </button>
          ))}
        </div>
      </div>

      <PlanSection
        entries={primaryEntries}
        highlightedId={highlightedId}
        onComplete={onComplete}
        onDelete={onDelete}
        onOpen={onOpen}
        onUpdate={onUpdate}
        title={mode === "day" ? "Выбранная дата" : mode === "week" ? "Неделя" : "Месяц"}
      />
      <PlanSection
        entries={planData.overdue}
        highlightedId={highlightedId}
        onComplete={onComplete}
        onDelete={onDelete}
        onOpen={onOpen}
        onUpdate={onUpdate}
        title="Просрочено"
      />
      <PlanSection
        entries={planData.unscheduled}
        highlightedId={highlightedId}
        onComplete={onComplete}
        onDelete={onDelete}
        onOpen={onOpen}
        onUpdate={onUpdate}
        title="Без даты"
      />
      <PlanSection
        entries={planData.someday}
        highlightedId={highlightedId}
        onComplete={onComplete}
        onDelete={onDelete}
        onOpen={onOpen}
        onUpdate={onUpdate}
        title="Когда-нибудь"
      />
    </div>
  );
}

function PlanSection({
  entries,
  highlightedId,
  onComplete,
  onDelete,
  onOpen,
  onUpdate,
  title
}: {
  entries: DiaryEntry[];
  highlightedId: string | null;
  onComplete: (entry: DiaryEntry) => void;
  onDelete: (id: string) => void;
  onOpen: (entry: DiaryEntry) => void;
  onUpdate: (id: string, patch: Partial<DiaryEntry>) => void;
  title: string;
}) {
  if (!entries.length) return null;
  return (
    <section className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-black">{title}</h3>
        <GlassBadge>{entries.length}</GlassBadge>
      </div>
      <div className="grid gap-2">
        {entries.map((entry) => (
          <EntryRow
            entry={entry}
            highlighted={entry.id === highlightedId}
            key={entry.id}
            onComplete={() => onComplete(entry)}
            onDelete={() => onDelete(entry.id)}
            onOpen={() => onOpen(entry)}
            onUpdate={(patch) => onUpdate(entry.id, patch)}
          />
        ))}
      </div>
    </section>
  );
}

function PurchasesScreen({
  entries,
  highlightedId,
  onDelete,
  onOpen,
  onStatusChange,
  onStatusViewChange,
  onUpdate,
  status
}: {
  entries: DiaryEntry[];
  highlightedId: string | null;
  onDelete: (id: string) => void;
  onOpen: (entry: DiaryEntry) => void;
  onStatusChange: (entry: DiaryEntry, status: PurchaseStatus) => void;
  onStatusViewChange: (status: PurchaseStatus) => void;
  onUpdate: (id: string, patch: Partial<DiaryEntry>) => void;
  status: PurchaseStatus;
}) {
  const options: Array<{ label: string; value: PurchaseStatus }> = [
    { label: "Нужно", value: "planned" },
    { label: "Выбрано", value: "selected" },
    { label: "Заказано", value: "ordered" },
    { label: "Куплено", value: "purchased" }
  ];
  const visible = entries.filter((entry) => normalizePurchaseStatus(entry) === status);
  return (
    <div className="grid gap-4">
      <GlassSegmentedControl options={options} value={status} onChange={(value) => onStatusViewChange(value as PurchaseStatus)} />
      <div className="grid gap-3">
        {visible.length ? (
          visible.map((entry) => (
            <EntryRow
              entry={entry}
              highlighted={entry.id === highlightedId}
              key={entry.id}
              onComplete={() => onStatusChange(entry, "purchased")}
              onDelete={() => onDelete(entry.id)}
              onOpen={() => onOpen(entry)}
              onUpdate={(patch) => onUpdate(entry.id, patch)}
            />
          ))
        ) : (
          <div className="py-10 text-center text-sm text-[var(--muted)]">В этом статусе покупок пока нет.</div>
        )}
      </div>
    </div>
  );
}

function ProjectBoard({
  areas,
  entries,
  highlightedId,
  onBack,
  onBackArea,
  onComplete,
  onDelete,
  onSelect,
  onSelectArea,
  onUpdate,
  onOpen,
  projects,
  selectedArea,
  selectedProject
}: {
  areas: Area[];
  entries: DiaryEntry[];
  highlightedId: string | null;
  onBack: () => void;
  onBackArea: () => void;
  onComplete: (entry: DiaryEntry) => void;
  onDelete: (id: string) => void;
  onSelect: (name: string) => void;
  onSelectArea: (name: string) => void;
  onUpdate: (id: string, patch: Partial<DiaryEntry>) => void;
  onOpen: (entry: DiaryEntry) => void;
  projects: ProjectNode[];
  selectedArea: string | null;
  selectedProject: string | null;
}) {
  const selectedEntries = selectedProject ? entries.filter((entry) => entry.project === selectedProject || entry.projectPath.includes(selectedProject)) : [];

  if (!selectedArea && !selectedProject) {
    const areaNames = new Set([...areas.map((area) => area.name), ...entries.map((entry) => entry.area).filter(Boolean) as string[]]);
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {[...areaNames].map((name) => {
          const linked = entries.filter((entry) => entry.area === name);
          return (
            <button className="rounded-2xl text-left focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" key={name} onClick={() => onSelectArea(name)} type="button">
              <GlassCard className="h-full p-4">
                <div className="text-xl font-black">{name}</div>
                <div className="mt-3 flex flex-wrap gap-2"><GlassBadge>{linked.filter((entry) => entry.status !== "done").length} активных</GlassBadge></div>
              </GlassCard>
            </button>
          );
        })}
      </div>
    );
  }

  if (selectedProject) {
    const purchases = selectedEntries.filter((entry) => entry.kind === "purchase");
    const budget = calculateBudget(selectedEntries);
    return (
      <div className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-black">{selectedProject}</h3>
            <p className="text-sm text-[var(--muted)]">{selectedEntries.length} записей · {purchases.length} покупок · {budget.planned.toLocaleString("ru-RU")} ₽ план</p>
          </div>
          <GlassButton className="px-4 font-bold" onClick={onBack}>
            Все проекты
          </GlassButton>
        </div>
        {selectedEntries.length ? (
          selectedEntries.map((entry) => (
            <EntryRow
              entry={entry}
              highlighted={entry.id === highlightedId}
              key={entry.id}
              onComplete={() => onComplete(entry)}
              onDelete={() => onDelete(entry.id)}
              onOpen={() => onOpen(entry)}
              onUpdate={(patch) => onUpdate(entry.id, patch)}
            />
          ))
        ) : (
          <div className="py-10 text-center text-sm text-[var(--muted)]">В этом проекте пока нет записей.</div>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="col-span-full">
        <GlassButton className="px-4 font-bold" onClick={onBackArea}>Все области</GlassButton>
      </div>
      {projects.filter((project) => project.area === selectedArea).length ? (
        projects.filter((project) => project.area === selectedArea).map((project) => {
          const name = project.name;
          const linked = entries.filter((entry) => entry.project === name || entry.projectPath.includes(name));
          const purchases = linked.filter((entry) => entry.kind === "purchase").length;
          const tasks = linked.filter((entry) => entry.kind === "task").length;
          return (
            <button className="rounded-2xl text-left focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" key={name} onClick={() => onSelect(name)} type="button">
              <GlassCard className="h-full p-4">
                <div className="text-xl font-black">{name}</div>
                <div className="text-sm text-[var(--muted)]">{project.area}</div>
                <div className="mt-3 flex flex-wrap gap-2 text-sm text-[var(--muted)]">
                  <GlassBadge>{linked.length} записей</GlassBadge>
                  {tasks ? <GlassBadge>{tasks} задач</GlassBadge> : null}
                  {purchases ? <GlassBadge>{purchases} покупок</GlassBadge> : null}
                </div>
              </GlassCard>
            </button>
          );
        })
      ) : (
        <div className="col-span-full py-10 text-center text-sm text-[var(--muted)]">Проекты появятся, когда запись будет привязана к проекту.</div>
      )}
    </div>
  );
}

function EntryRow({
  entry,
  highlighted,
  onComplete,
  onDelete,
  onOpen,
  onUpdate
}: {
  entry: DiaryEntry;
  highlighted?: boolean;
  onComplete: () => void;
  onDelete: () => void;
  onOpen?: () => void;
  onUpdate: (patch: Partial<DiaryEntry>) => void;
}) {
  const done = entry.status === "done";
  return (
    <GlassCard className={`p-3 transition ${highlighted ? "ring-2 ring-[var(--accent)]" : ""}`}>
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
            <GlassBadge>{ownerLabel(entry.assignedTo)}</GlassBadge>
            {entry.priority === "high" ? <GlassBadge className="text-[var(--rose)]">важно</GlassBadge> : null}
            {entry.needsReview ? <GlassBadge className="text-[var(--amber)]">уточнить</GlassBadge> : null}
          </div>
          <input
            className={`mt-2 w-full rounded-2xl border border-transparent bg-transparent px-1 text-lg font-black outline-none focus:border-white/50 focus:bg-white/30 ${done ? "text-[var(--muted)] line-through" : ""}`}
            value={entry.title}
            onChange={(event) => onUpdate({ title: event.target.value })}
          />
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-[var(--muted)]">
            <span>{entry.area ?? "Личное"}{entry.project ? ` -> ${entry.project}` : entry.projectPath.length ? ` -> ${entry.projectPath.join(" -> ")}` : ""}</span>
            <span>{formatDateRu(entry.dueDate)}</span>
            {entry.purchase?.totalPrice || entry.totalPrice || entry.unitPrice ? <span>{entry.purchase?.totalPrice ?? entry.totalPrice ?? entry.unitPrice} {entry.purchase?.currency ?? entry.currency ?? "RUB"}</span> : null}
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
          {onOpen ? (
            <button className="grid h-10 w-10 place-items-center rounded-full bg-white/50 text-[var(--muted)] dark:bg-white/10" onClick={onOpen} title="Открыть детали" type="button">
              <MoreHorizontal size={16} />
            </button>
          ) : null}
          <button className="grid h-10 w-10 place-items-center rounded-full bg-white/50 text-[var(--muted)] dark:bg-white/10" onClick={onDelete} title="Удалить" type="button">
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </GlassCard>
  );
}

function SettingsPanel({
  answer,
  onClearAll,
  onClearEntries,
  onClearRules,
  onExport,
  onImport,
  onNavigate,
  onAsk,
  members,
  query,
  setQuery,
  settings,
  onChange,
  rulesCount,
  storageVersionLabel
}: {
  answer: AIQueryResult | null;
  onClearAll: () => void;
  onClearEntries: () => void;
  onClearRules: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onNavigate: (tab: TabId) => void;
  onAsk: () => void;
  members: Member[];
  query: string;
  setQuery: (value: string) => void;
  settings: AppSettings;
  onChange: (settings: AppSettings) => void;
  rulesCount: number;
  storageVersionLabel: string;
}) {
  return (
    <div className="grid gap-4">
      <GlassCard className="grid gap-2 p-4">
        <h3 className="text-lg font-black">Разделы</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(["all", "purchases", "budget", "ideas", "inbox", "someday", "projects", "plan"] as TabId[]).map((tabId) => {
            const tab = tabs.find((item) => item.id === tabId)!;
            return (
              <GlassButton className="justify-start px-3 text-sm font-bold" key={tabId} onClick={() => onNavigate(tabId)}>
                <tab.icon size={17} />
                {tab.label}
              </GlassButton>
            );
          })}
        </div>
      </GlassCard>
      <GlassCard className="grid gap-3 p-4">
        <h3 className="text-lg font-black">Поиск</h3>
        <div className="flex gap-2">
          <GlassInput
            className="h-12 min-w-0 flex-1 px-4"
            placeholder="Спросить ежедневник..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void onAsk();
            }}
          />
          <GlassButton className="grid h-12 w-12 place-items-center text-white [background:linear-gradient(135deg,#1b6cff,#22a6f2)]" onClick={onAsk} title="Спросить">
            <Search size={19} />
          </GlassButton>
        </div>
        {answer ? <p className="text-sm leading-6 text-[var(--muted)]">{answer.answer}</p> : null}
      </GlassCard>
      <GlassCard className="grid gap-3 p-4">
        <h3 className="text-lg font-black">Семья</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {members.map((member) => (
            <div className="rounded-2xl bg-white/40 p-3 dark:bg-white/5" key={member.id}>
              <div className="font-black">{member.avatar} {member.name}</div>
              <div className="text-sm text-[var(--muted)]">{member.role === "owner" ? "Основной профиль" : "Партнёр"}</div>
            </div>
          ))}
        </div>
        <label className="grid gap-1">
          <span className="text-sm font-bold">Default owner for personal tasks</span>
          <select className="glass-input h-11 px-3" value={settings.defaultPersonalAssignee} onChange={(event) => onChange({ ...settings, defaultPersonalAssignee: event.target.value as AssignedTo })}>
            <option value="me">Моё</option>
            <option value="partner">Партнёр</option>
            <option value="shared">Общее</option>
          </select>
        </label>
        <label className="grid gap-1">
          <span className="text-sm font-bold">Default owner for home purchases</span>
          <select className="glass-input h-11 px-3" value={settings.defaultHomePurchaseAssignee} onChange={(event) => onChange({ ...settings, defaultHomePurchaseAssignee: event.target.value as AssignedTo })}>
            <option value="shared">Общее</option>
            <option value="me">Моё</option>
            <option value="partner">Партнёр</option>
          </select>
        </label>
      </GlassCard>
      <GlassCard className="grid gap-3 p-4">
        <label className="flex items-center justify-between gap-3">
          <span>
            <span className="block font-bold">AI включен</span>
            <span className="text-sm text-[var(--muted)]">Local smart parser работает всегда; AI используется только как fallback.</span>
          </span>
          <input checked={settings.aiEnabled} type="checkbox" onChange={(event) => onChange({ ...settings, aiEnabled: event.target.checked })} />
        </label>
        <label className="flex items-center justify-between gap-3">
          <span>
            <span className="block font-bold">Ask before creating new project</span>
            <span className="text-sm text-[var(--muted)]">Новые project candidates показываются в preview перед сохранением.</span>
          </span>
          <input checked={settings.askBeforeCreatingProject} type="checkbox" onChange={(event) => onChange({ ...settings, askBeforeCreatingProject: event.target.checked })} />
        </label>
        <label className="flex items-center justify-between gap-3">
          <span>
            <span className="block font-bold">Learn from corrections</span>
            <span className="text-sm text-[var(--muted)]">Обучение происходит только после явного подтверждения.</span>
          </span>
          <input checked={settings.learnFromCorrections} type="checkbox" onChange={(event) => onChange({ ...settings, learnFromCorrections: event.target.checked })} />
        </label>
        <label className="flex items-center justify-between gap-3">
          <span>
            <span className="block font-bold">Автосохранение после разбора</span>
            <span className="text-sm text-[var(--muted)]">После STOP сохранит записи автоматически, только если parser уверен.</span>
          </span>
          <input
            checked={settings.autoSaveAfterParse}
            type="checkbox"
            onChange={(event) => onChange({ ...settings, autoSaveAfterParse: event.target.checked })}
          />
        </label>
        <label className="flex items-center justify-between gap-3">
          <span>
            <span className="block font-bold">Advanced / debug</span>
            <span className="text-sm text-[var(--muted)]">Показывает confidence, parsedBy и кнопку запоминания правила в preview.</span>
          </span>
          <input checked={settings.advancedMode} type="checkbox" onChange={(event) => onChange({ ...settings, advancedMode: event.target.checked })} />
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
        <div>
          <h3 className="text-lg font-black">Данные</h3>
          <p className="text-sm text-[var(--muted)]">Storage version: {storageVersionLabel}. Демо-записи больше не создаются автоматически.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <GlassButton className="justify-center px-3 text-sm font-bold" onClick={onClearEntries}>
            Очистить все записи
          </GlassButton>
          <GlassButton className="justify-center px-3 text-sm font-bold" onClick={onClearRules}>
            Очистить правила
          </GlassButton>
          <GlassButton className="justify-center px-3 text-sm font-bold text-[var(--rose)]" onClick={onClearAll}>
            Очистить все данные
          </GlassButton>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <GlassButton className="justify-center px-3 text-sm font-bold" onClick={onExport}>
            Экспортировать данные
          </GlassButton>
          <label className="glass-button justify-center px-3 text-sm font-bold">
            Импорт JSON
            <input className="hidden" type="file" accept="application/json" onChange={(event) => event.target.files?.[0] ? onImport(event.target.files[0]) : undefined} />
          </label>
        </div>
      </GlassCard>
      <GlassCard className="grid gap-3 p-4">
        <label className="grid gap-1">
          <span className="text-sm font-bold">Валюта по умолчанию</span>
          <input className="glass-input h-11 px-3" value={settings.defaultCurrency} onChange={(event) => onChange({ ...settings, defaultCurrency: event.target.value })} />
        </label>
        <label className="grid gap-1">
          <span className="text-sm font-bold">Monthly budget optional</span>
          <input className="glass-input h-11 px-3" inputMode="decimal" value={settings.monthlyBudget ?? ""} onChange={(event) => onChange({ ...settings, monthlyBudget: numberOrUndefined(event.target.value) })} />
        </label>
        <label className="grid gap-1">
          <span className="text-sm font-bold">Appearance</span>
          <select className="glass-input h-11 px-3" value={settings.appearance} onChange={(event) => onChange({ ...settings, appearance: event.target.value as AppSettings["appearance"] })}>
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
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

function PreviewEditSheet({
  item,
  onChange,
  onClose
}: {
  item: PreviewItem;
  onChange: (patch: Partial<PreviewItem>) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/25 px-4 pb-[calc(14px+env(safe-area-inset-bottom))] backdrop-blur-sm" onClick={onClose}>
      <GlassPanel className="max-h-[88vh] w-full max-w-lg overflow-auto p-4" onClick={(event) => event.stopPropagation()}>
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/70 dark:bg-white/20" />
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-2xl font-black">Изменить запись</h2>
          <button className="grid h-10 w-10 place-items-center rounded-full bg-white/60 text-xl font-black dark:bg-white/10" onClick={onClose} type="button" aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className="grid gap-3">
          <label className="grid gap-1">
            <span className="text-sm font-bold">Название</span>
            <input className="glass-input h-12 px-3" value={item.title} onChange={(event) => onChange({ title: event.target.value })} />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-bold">Тип</span>
            <select className="glass-input h-12 px-3" value={item.kind} onChange={(event) => onChange({ kind: event.target.value as EntryKind, status: event.target.value === "purchase" ? "want_to_buy" : "active" })}>
              <option value="task">Задача</option>
              <option value="purchase">Покупка</option>
              <option value="idea">Идея</option>
              <option value="note">Заметка</option>
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-bold">Проект</span>
            <input className="glass-input h-12 px-3" value={item.projectPath.join(" -> ")} onChange={(event) => onChange({ projectPath: event.target.value.split(">").map((part) => part.replace("-", "").trim()).filter(Boolean) })} placeholder="Дом -> Ремонт -> Гардероб" />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-bold">Срок</span>
            <select className="glass-input h-12 px-3" value={item.schedule} onChange={(event) => onChange({ schedule: event.target.value as SchedulePreset })}>
              <option value="today">Сегодня</option>
              <option value="tomorrow">Завтра</option>
              <option value="this_week">Эта неделя</option>
              <option value="next_week">Следующая неделя</option>
              <option value="this_month">Этот месяц</option>
              <option value="someday">Когда-нибудь</option>
              <option value="none">Без даты</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1">
              <span className="text-sm font-bold">Количество</span>
              <input className="glass-input h-12 px-3" inputMode="decimal" value={item.quantity ?? ""} onChange={(event) => onChange({ quantity: numberOrUndefined(event.target.value) })} />
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-bold">Цена</span>
              <input className="glass-input h-12 px-3" inputMode="decimal" value={item.unitPrice ?? item.totalPrice ?? ""} onChange={(event) => onChange({ unitPrice: numberOrUndefined(event.target.value), totalPrice: numberOrUndefined(event.target.value) })} />
            </label>
          </div>
          <label className="grid gap-1">
            <span className="text-sm font-bold">Ссылка</span>
            <input className="glass-input h-12 px-3" value={item.url ?? ""} onChange={(event) => onChange({ url: event.target.value || undefined })} />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-bold">Комментарий</span>
            <textarea className="glass-input min-h-24 px-3 py-3" value={item.description ?? ""} onChange={(event) => onChange({ description: event.target.value })} />
          </label>
          <GlassButton className="h-12 justify-center px-5 font-black text-white [background:linear-gradient(135deg,#176bff,#7b61ff)]" onClick={onClose}>
            Готово
          </GlassButton>
        </div>
      </GlassPanel>
    </div>
  );
}

function EntryDetailSheet({
  entry,
  onChange,
  onClose,
  onDelete
}: {
  entry: DiaryEntry;
  onChange: (patch: Partial<DiaryEntry>) => void;
  onClose: () => void;
  onDelete: () => void;
}) {
  const [checklistText, setChecklistText] = useState("");
  const purchaseStatus = normalizePurchaseStatus(entry);
  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/25 px-4 pb-[calc(14px+env(safe-area-inset-bottom))] backdrop-blur-sm" onClick={onClose}>
      <GlassPanel className="max-h-[90vh] w-full max-w-2xl overflow-auto p-4" onClick={(event) => event.stopPropagation()}>
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/70 dark:bg-white/20" />
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <GlassBadge className={kindTone[entry.kind]}>{kindLabel[entry.kind]}</GlassBadge>
            <h2 className="mt-2 text-2xl font-black">Детали записи</h2>
          </div>
          <button className="grid h-10 w-10 place-items-center rounded-full bg-white/60 text-xl font-black dark:bg-white/10" onClick={onClose} type="button" aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className="grid gap-3">
          <label className="grid gap-1">
            <span className="text-sm font-bold">Название</span>
            <input className="glass-input h-12 px-3" value={entry.title} onChange={(event) => onChange({ title: event.target.value })} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1">
              <span className="text-sm font-bold">Тип</span>
              <select className="glass-input h-12 px-3" value={entry.kind} onChange={(event) => onChange({ kind: event.target.value as EntryKind })}>
                <option value="task">Задача</option>
                <option value="purchase">Покупка</option>
                <option value="idea">Идея</option>
                <option value="note">Заметка</option>
                <option value="inbox">Разобрать</option>
              </select>
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-bold">Кому</span>
              <select className="glass-input h-12 px-3" value={entry.assignedTo ?? "me"} onChange={(event) => onChange({ assignedTo: event.target.value as AssignedTo, visibility: event.target.value === "shared" ? "shared" : "private" })}>
                <option value="me">Моё</option>
                <option value="partner">Партнёр</option>
                <option value="shared">Общее</option>
              </select>
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1">
              <span className="text-sm font-bold">Область</span>
              <input className="glass-input h-12 px-3" value={entry.area ?? ""} onChange={(event) => onChange({ area: event.target.value || undefined })} />
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-bold">Проект</span>
              <input className="glass-input h-12 px-3" value={entry.project ?? ""} onChange={(event) => onChange({ project: event.target.value || undefined, projectPath: [entry.area, event.target.value].filter(Boolean) as string[] })} />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="grid gap-1">
              <span className="text-sm font-bold">Дата</span>
              <input className="glass-input h-12 px-3" type="date" value={entry.dueDate ?? ""} onChange={(event) => onChange({ dueDate: event.target.value || undefined, schedule: event.target.value ? "today" : "none" })} />
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-bold">Время</span>
              <input className="glass-input h-12 px-3" type="time" value={entry.time ?? ""} onChange={(event) => onChange({ time: event.target.value || undefined })} />
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-bold">Повтор</span>
              <select className="glass-input h-12 px-3" value={entry.repeat ?? "none"} onChange={(event) => onChange({ repeat: event.target.value as RepeatRule })}>
                <option value="none">Нет</option>
                <option value="daily">Каждый день</option>
                <option value="weekly">Каждую неделю</option>
                <option value="weekly_monday">По понедельникам</option>
                <option value="monthly">Каждый месяц</option>
                <option value="monthly_first">Первого числа</option>
              </select>
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-bold">Приоритет</span>
              <select className="glass-input h-12 px-3" value={entry.priority} onChange={(event) => onChange({ priority: event.target.value as DiaryEntry["priority"] })}>
                <option value="low">Низкий</option>
                <option value="normal">Обычный</option>
                <option value="high">Важный</option>
              </select>
            </label>
          </div>
          {entry.kind === "purchase" ? (
            <div className="grid gap-3 rounded-2xl bg-white/35 p-3 dark:bg-white/5">
              <GlassSegmentedControl
                options={[
                  { label: "Нужно", value: "planned" },
                  { label: "Выбрано", value: "selected" },
                  { label: "Заказано", value: "ordered" },
                  { label: "Куплено", value: "purchased" }
                ]}
                value={purchaseStatus}
                onChange={(value) => onChange({ purchase: { ...entry.purchase, status: value as PurchaseStatus }, status: purchaseStatusToEntryStatus(value as PurchaseStatus) })}
              />
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="grid gap-1">
                  <span className="text-sm font-bold">Количество</span>
                  <input className="glass-input h-12 px-3" inputMode="decimal" value={entry.purchase?.quantity ?? entry.quantity ?? ""} onChange={(event) => onChange({ purchase: { status: purchaseStatus, ...entry.purchase, quantity: numberOrUndefined(event.target.value) }, quantity: numberOrUndefined(event.target.value) })} />
                </label>
                <label className="grid gap-1">
                  <span className="text-sm font-bold">Цена</span>
                  <input className="glass-input h-12 px-3" inputMode="decimal" value={entry.purchase?.unitPrice ?? entry.unitPrice ?? ""} onChange={(event) => onChange({ purchase: { status: purchaseStatus, ...entry.purchase, unitPrice: numberOrUndefined(event.target.value), plannedPrice: numberOrUndefined(event.target.value) }, unitPrice: numberOrUndefined(event.target.value) })} />
                </label>
                <label className="grid gap-1">
                  <span className="text-sm font-bold">Ссылка</span>
                  <input className="glass-input h-12 px-3" value={entry.url ?? ""} onChange={(event) => onChange({ url: event.target.value || undefined })} />
                </label>
              </div>
            </div>
          ) : null}
          <label className="grid gap-1">
            <span className="text-sm font-bold">Заметки</span>
            <textarea className="glass-input min-h-24 px-3 py-3" value={entry.description ?? ""} onChange={(event) => onChange({ description: event.target.value })} />
          </label>
          <div className="grid gap-2">
            <span className="text-sm font-bold">Чеклист</span>
            {(entry.checklist ?? []).map((item) => (
              <label className="flex min-h-11 items-center gap-3 rounded-2xl bg-white/35 px-3 dark:bg-white/5" key={item.id}>
                <input
                  checked={item.done}
                  type="checkbox"
                  onChange={(event) => onChange({ checklist: (entry.checklist ?? []).map((check) => check.id === item.id ? { ...check, done: event.target.checked } : check) })}
                />
                <span className={item.done ? "text-[var(--muted)] line-through" : ""}>{item.title}</span>
              </label>
            ))}
            <div className="flex gap-2">
              <input className="glass-input h-11 min-w-0 flex-1 px-3" value={checklistText} onChange={(event) => setChecklistText(event.target.value)} placeholder="Пункт чеклиста" />
              <GlassButton
                className="px-4 font-bold"
                onClick={() => {
                  const title = checklistText.trim();
                  if (!title) return;
                  onChange({ checklist: [...(entry.checklist ?? []), { id: crypto.randomUUID(), title, done: false, createdAt: new Date().toISOString() }] });
                  setChecklistText("");
                }}
              >
                <Plus size={17} />
              </GlassButton>
            </div>
          </div>
          <div className="flex flex-wrap justify-between gap-2 pt-2">
            <GlassBadge>rev {entry.revision ?? 1}</GlassBadge>
            <div className="flex gap-2">
              <GlassButton className="px-4 font-bold text-[var(--rose)]" onClick={onDelete}>
                <Trash2 size={16} />
                Удалить
              </GlassButton>
              <GlassButton className="px-5 font-black text-white [background:linear-gradient(135deg,#176bff,#7b61ff)]" onClick={onClose}>
                Готово
              </GlassButton>
            </div>
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}

function QuickInputSheet({ onClose, onText, onVoice }: { onClose: () => void; onText: () => void; onVoice: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/20 px-4 pb-[calc(16px+env(safe-area-inset-bottom))] backdrop-blur-sm" onClick={onClose}>
      <GlassPanel className="w-full max-w-md p-4" onClick={(event) => event.stopPropagation()}>
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/70 dark:bg-white/20" />
        <h2 className="text-2xl font-black">Быстрый ввод</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">Начни диктовку или просто напиши текст. После остановки запись разберется автоматически.</p>
        <div className="mt-5 grid gap-3">
          <GlassButton className="h-14 justify-start px-5 text-base font-black text-white [background:linear-gradient(135deg,#176bff,#7b61ff)]" onClick={onVoice}>
            <Mic size={22} />
            Начать запись
          </GlassButton>
          <GlassButton className="h-14 justify-start px-5 text-base font-black" onClick={onText}>
            <Plus size={22} />
            Написать
          </GlassButton>
          <GlassButton className="h-12 px-5 font-bold" onClick={onClose}>
            Отмена
          </GlassButton>
        </div>
      </GlassPanel>
    </div>
  );
}

function Toast({ actionLabel, detail, onAction, title }: { actionLabel?: string; detail?: string; onAction?: () => void; title: string }) {
  return (
    <div className="fixed left-1/2 top-4 z-[90] w-[min(92vw,420px)] -translate-x-1/2">
      <GlassCard className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-black">{title}</div>
            {detail ? <div className="mt-1 text-sm text-[var(--muted)]">{detail}</div> : null}
          </div>
          {actionLabel && onAction ? (
            <button className="shrink-0 rounded-full bg-white/65 px-3 py-2 text-sm font-black dark:bg-white/10" onClick={onAction} type="button">
              {actionLabel}
            </button>
          ) : null}
        </div>
      </GlassCard>
    </div>
  );
}

function pluralRecords(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "запись";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "записи";
  return "записей";
}

function summarizeKinds(entries: DiaryEntry[]): string {
  const counts = entries.reduce(
    (acc, entry) => {
      acc[entry.kind] += 1;
      return acc;
    },
    { task: 0, purchase: 0, idea: 0, note: 0, inbox: 0 } satisfies Record<EntryKind, number>
  );
  return [
    counts.purchase ? pluralKind(counts.purchase, "покупка", "покупки", "покупок") : "",
    counts.task ? pluralKind(counts.task, "задача", "задачи", "задач") : "",
    counts.idea ? pluralKind(counts.idea, "идея", "идеи", "идей") : "",
    counts.note ? pluralKind(counts.note, "заметка", "заметки", "заметок") : "",
    counts.inbox ? `${counts.inbox} на разбор` : ""
  ]
    .filter(Boolean)
    .join(", ");
}

function pluralKind(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  const word = mod10 === 1 && mod100 !== 11 ? one : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? few : many;
  return `${count} ${word}`;
}

function sectionLabel(kind: EntryKind): string {
  if (kind === "task") return "Задачи";
  if (kind === "purchase") return "Покупки";
  if (kind === "idea") return "Идеи";
  if (kind === "note") return "Заметки";
  return "Разобрать";
}

function ownerLabel(assignedTo?: AssignedTo): string {
  if (assignedTo === "shared") return "Общее";
  if (assignedTo === "partner") return "Партнёр";
  return "Моё";
}

function matchesOwner(entry: DiaryEntry, filter: "me" | "shared" | "all"): boolean {
  if (filter === "all") return true;
  if (filter === "shared") return entry.assignedTo === "shared" || entry.visibility === "shared";
  return !entry.assignedTo || entry.assignedTo === "me";
}

function normalizePurchaseStatus(entry: DiaryEntry): PurchaseStatus {
  if (entry.purchase?.status) return entry.purchase.status;
  if (entry.status === "selected") return "selected";
  if (entry.status === "ordered") return "ordered";
  if (entry.status === "bought" || entry.status === "done") return "purchased";
  if (entry.status === "researching") return "researching";
  return "planned";
}

function purchaseStatusToEntryStatus(status: PurchaseStatus): EntryStatus {
  if (status === "selected") return "selected";
  if (status === "ordered") return "ordered";
  if (status === "purchased") return "bought";
  if (status === "researching") return "researching";
  if (status === "cancelled") return "cancelled";
  return "want_to_buy";
}

function getWeekDays(dateIso: string): string[] {
  const selected = new Date(`${dateIso}T00:00:00`);
  const day = selected.getDay() || 7;
  selected.setDate(selected.getDate() - day + 1);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(selected);
    date.setDate(selected.getDate() + index);
    return date.toISOString().slice(0, 10);
  });
}

function shortWeekday(dateIso: string): string {
  return new Date(`${dateIso}T00:00:00`).toLocaleDateString("ru-RU", { weekday: "short" }).replace(".", "");
}

function formatPlanDate(dateIso: string): string {
  return new Date(`${dateIso}T00:00:00`).toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "long" });
}

function textMatches(value: string, needle: string): boolean {
  return value.toLowerCase().includes(needle.toLowerCase());
}

function scheduleLabel(schedule: SchedulePreset): string {
  const labels: Record<SchedulePreset, string> = {
    today: "Сегодня",
    tomorrow: "Завтра",
    this_week: "Эта неделя",
    next_week: "Следующая неделя",
    this_month: "Этот месяц",
    someday: "Когда-нибудь",
    none: "Без даты"
  };
  return labels[schedule];
}

function numberOrUndefined(value: string): number | undefined {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
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
