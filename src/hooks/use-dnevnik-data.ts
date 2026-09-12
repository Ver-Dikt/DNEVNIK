"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { loadDnevnikData, saveCalendarEventsDb, saveDocumentsDb, saveDraftDb, saveEntriesDb, saveFinanceDb, saveImportantDatesDb, saveKnowledgeDb, saveLoyaltyCardsDb, saveMembersDb, savePlanTransactionsDb, savePreviewDb, saveProjectsDb, saveSavingsDb, saveSettingsDb, saveSharedPlansDb, saveSpacesDb } from "@/db";
import type { DbStatus } from "@/db/schema";
import { clearAllDnevnikStorage, clearEntriesStorage, defaultKnowledge, defaultMembers, defaultSettings, defaultSpaces, importDnevnikData, saveCalendarEvents, saveDocuments, saveDraft, saveEntries, saveFinanceTransactions, saveImportantDates, saveKnowledge, saveLoyaltyCards, saveMembers, savePlanTransactions, savePreviewState, saveProjects, saveSavingsGoals, saveSettings, saveSharedPlans, saveSpaces } from "@/lib/storage";
import type { AppSettings, CalendarEvent, DiaryEntry, DocumentItem, DraftState, FinanceTransaction, ImportantDate, KnowledgeStore, LoyaltyCard, Member, PlanTransaction, PreviewState, ProjectNode, SavingsGoal, SharedPlan, Space } from "@/lib/types";

export function useDnevnikData() {
  const [entries, setEntriesState] = useState<DiaryEntry[]>([]);
  const [spaces, setSpacesState] = useState<Space[]>(defaultSpaces);
  const [projects, setProjectsState] = useState<ProjectNode[]>([]);
  const [members, setMembersState] = useState<Member[]>(defaultMembers);
  const [knowledge, setKnowledgeState] = useState<KnowledgeStore>(defaultKnowledge);
  const [settings, setSettingsState] = useState<AppSettings>(defaultSettings);
  const [draft, setDraftState] = useState<DraftState | null>(null);
  const [previewState, setPreviewStateLocal] = useState<PreviewState | null>(null);
  const [financeTransactions, setFinanceState] = useState<FinanceTransaction[]>([]);
  const [savingsGoals, setSavingsState] = useState<SavingsGoal[]>([]);
  const [sharedPlans, setSharedPlansState] = useState<SharedPlan[]>([]);
  const [planTransactions, setPlanTransactionsState] = useState<PlanTransaction[]>([]);
  const [importantDates, setImportantDatesState] = useState<ImportantDate[]>([]);
  const [calendarEvents, setCalendarEventsState] = useState<CalendarEvent[]>([]);
  const [documents, setDocumentsState] = useState<DocumentItem[]>([]);
  const [loyaltyCards, setLoyaltyCardsState] = useState<LoyaltyCard[]>([]);
  const [status, setStatus] = useState<DbStatus>({ ready: false, usingFallback: false });

  useEffect(() => {
    let cancelled = false;
    loadDnevnikData().then((result) => {
      if (cancelled) return;
      setEntriesState(result.data.entries);
      setSpacesState(result.data.spaces);
      setProjectsState(result.data.projects);
      setMembersState(result.data.members);
      setKnowledgeState(result.data.knowledge);
      setSettingsState(result.data.settings);
      setDraftState(result.data.draft);
      setPreviewStateLocal(result.data.preview);
      setFinanceState(result.data.financeTransactions);
      setSavingsState(result.data.savingsGoals);
      setSharedPlansState(result.data.sharedPlans);
      setPlanTransactionsState(result.data.planTransactions);
      setImportantDatesState(result.data.importantDates);
      setCalendarEventsState(result.data.calendarEvents);
      setDocumentsState(result.data.documents);
      setLoyaltyCardsState(result.data.loyaltyCards);
      setStatus({ ready: true, usingFallback: result.usingFallback, warning: result.warning });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const warn = () => setStatus(current => ({ ...current, warning: "Основное хранилище не подтвердило сохранение. Скачайте резервную копию в настройках перед закрытием приложения." }));
    window.addEventListener("dnevnik:save-error", warn);
    return () => window.removeEventListener("dnevnik:save-error", warn);
  }, []);

  const setEntries = useCallback((next: DiaryEntry[] | ((current: DiaryEntry[]) => DiaryEntry[])) => {
    setEntriesState((current) => {
      const value = typeof next === "function" ? next(current) : next;
      void saveEntriesDb(value);
      try {
        saveEntries(value);
      } catch {
        // localStorage fallback can fail in private mode; IndexedDB remains primary.
      }
      return value;
    });
  }, []);

  const setSpaces = useCallback((next: Space[] | ((current: Space[]) => Space[])) => {
    setSpacesState((current) => {
      const value = typeof next === "function" ? next(current) : next;
      void saveSpacesDb(value);
      try {
        saveSpaces(value);
      } catch {}
      return value;
    });
  }, []);

  const setProjects = useCallback((next: ProjectNode[] | ((current: ProjectNode[]) => ProjectNode[])) => {
    setProjectsState((current) => {
      const value = typeof next === "function" ? next(current) : next;
      void saveProjectsDb(value);
      try {
        saveProjects(value);
      } catch {}
      return value;
    });
  }, []);

  const setMembers = useCallback((next: Member[] | ((current: Member[]) => Member[])) => {
    setMembersState((current) => {
      const value = typeof next === "function" ? next(current) : next;
      void saveMembersDb(value);
      try {
        saveMembers(value);
      } catch {}
      return value;
    });
  }, []);

  const setKnowledge = useCallback((next: KnowledgeStore | ((current: KnowledgeStore) => KnowledgeStore)) => {
    setKnowledgeState((current) => {
      const value = typeof next === "function" ? next(current) : next;
      void saveKnowledgeDb(value);
      try {
        saveKnowledge(value);
      } catch {}
      return value;
    });
  }, []);

  const setSettings = useCallback((next: AppSettings | ((current: AppSettings) => AppSettings)) => {
    setSettingsState((current) => {
      const value = typeof next === "function" ? next(current) : next;
      void saveSettingsDb(value);
      try {
        saveSettings(value);
      } catch {}
      return value;
    });
  }, []);

  const setDraft = useCallback((next: DraftState | null) => {
    setDraftState(next);
    void saveDraftDb(next);
    try {
      saveDraft(next);
    } catch {}
  }, []);

  const setPreviewState = useCallback((next: PreviewState | null) => {
    setPreviewStateLocal(next);
    void savePreviewDb(next);
    try {
      savePreviewState(next);
    } catch {}
  }, []);

  const setFinanceTransactions = useCallback((next: FinanceTransaction[] | ((current: FinanceTransaction[]) => FinanceTransaction[])) => {
    setFinanceState((current) => {
      const value = typeof next === "function" ? next(current) : next;
      void saveFinanceDb(value);
      try {
        saveFinanceTransactions(value);
      } catch {}
      return value;
    });
  }, []);

  const setSavingsGoals = useCallback((next: SavingsGoal[] | ((current: SavingsGoal[]) => SavingsGoal[])) => {
    setSavingsState((current) => {
      const value = typeof next === "function" ? next(current) : next;
      void saveSavingsDb(value);
      try {
        saveSavingsGoals(value);
      } catch {}
      return value;
    });
  }, []);

  const setSharedPlans = useCallback((next: SharedPlan[] | ((current: SharedPlan[]) => SharedPlan[])) => {
    setSharedPlansState((current) => {
      const value = typeof next === "function" ? next(current) : next;
      void saveSharedPlansDb(value);
      try { saveSharedPlans(value); } catch {}
      return value;
    });
  }, []);

  const setPlanTransactions = useCallback((next: PlanTransaction[] | ((current: PlanTransaction[]) => PlanTransaction[])) => {
    setPlanTransactionsState((current) => {
      const value = typeof next === "function" ? next(current) : next;
      void savePlanTransactionsDb(value);
      try { savePlanTransactions(value); } catch {}
      return value;
    });
  }, []);

  const setImportantDates = useCallback((next: ImportantDate[] | ((current: ImportantDate[]) => ImportantDate[])) => {
    setImportantDatesState((current) => {
      const value = typeof next === "function" ? next(current) : next;
      void saveImportantDatesDb(value);
      try { saveImportantDates(value); } catch {}
      return value;
    });
  }, []);

  const setCalendarEvents = useCallback((next: CalendarEvent[] | ((current: CalendarEvent[]) => CalendarEvent[])) => {
    setCalendarEventsState((current) => {
      const value = typeof next === "function" ? next(current) : next;
      void saveCalendarEventsDb(value);
      try { saveCalendarEvents(value); } catch {}
      return value;
    });
  }, []);

  const setDocuments = useCallback((next: DocumentItem[] | ((current: DocumentItem[]) => DocumentItem[])) => {
    setDocumentsState((current) => {
      const value = typeof next === "function" ? next(current) : next;
      void saveDocumentsDb(value);
      try { saveDocuments(value); } catch {}
      return value;
    });
  }, []);

  const setLoyaltyCards = useCallback((next: LoyaltyCard[] | ((current: LoyaltyCard[]) => LoyaltyCard[])) => {
    setLoyaltyCardsState((current) => {
      const value = typeof next === "function" ? next(current) : next;
      void saveLoyaltyCardsDb(value);
      try { saveLoyaltyCards(value); } catch {}
      return value;
    });
  }, []);

  const exportData = useCallback(async () => {
    return { version: "5", exportedAt: new Date().toISOString(), entries, spaces, projects, members, knowledge, draft, preview: previewState, settings, financeTransactions, savingsGoals, sharedPlans, planTransactions, importantDates, calendarEvents, documents, loyaltyCards };
  }, [calendarEvents, documents, draft, entries, financeTransactions, importantDates, knowledge, loyaltyCards, members, planTransactions, previewState, projects, savingsGoals, settings, sharedPlans, spaces]);

  const importData = useCallback((data: unknown) => {
    if (data && typeof data === "object") {
      const raw = data as Record<string, unknown>;
      data = { ...raw, financeTransactions: raw.financeTransactions ?? raw.finance, savingsGoals: raw.savingsGoals ?? raw.savings };
    }
    const ok = importDnevnikData(data);
    if (!ok || !data || typeof data !== "object") return false;
    const next = data as Partial<Awaited<ReturnType<typeof exportData>>>;
    setEntriesState(Array.isArray(next.entries) ? next.entries : []);
    setSpacesState(Array.isArray(next.spaces) ? next.spaces : defaultSpaces);
    setProjectsState(Array.isArray(next.projects) ? next.projects : []);
    setMembersState(Array.isArray(next.members) ? next.members : defaultMembers);
    setKnowledgeState(next.knowledge ?? defaultKnowledge);
    setSettingsState(next.settings ?? defaultSettings);
    setDraftState(next.draft ?? null);
    setPreviewStateLocal(next.preview ?? null);
    setFinanceState(Array.isArray(next.financeTransactions) ? next.financeTransactions : []);
    setSavingsState(Array.isArray(next.savingsGoals) ? next.savingsGoals : []);
    setSharedPlansState(Array.isArray(next.sharedPlans) ? next.sharedPlans : []);
    setPlanTransactionsState(Array.isArray(next.planTransactions) ? next.planTransactions : []);
    setImportantDatesState(Array.isArray(next.importantDates) ? next.importantDates : []);
    setCalendarEventsState(Array.isArray(next.calendarEvents) ? next.calendarEvents : []);
    setDocumentsState(Array.isArray(next.documents) ? next.documents : []);
    setLoyaltyCardsState(Array.isArray(next.loyaltyCards) ? next.loyaltyCards : []);
    void saveEntriesDb(Array.isArray(next.entries) ? next.entries : []);
    void saveSpacesDb(Array.isArray(next.spaces) ? next.spaces : defaultSpaces);
    void saveProjectsDb(Array.isArray(next.projects) ? next.projects : []);
    void saveMembersDb(Array.isArray(next.members) ? next.members : defaultMembers);
    void saveKnowledgeDb(next.knowledge ?? defaultKnowledge);
    void saveSettingsDb(next.settings ?? defaultSettings);
    void saveDraftDb(next.draft ?? null);
    void savePreviewDb(next.preview ?? null);
    void saveFinanceDb(Array.isArray(next.financeTransactions) ? next.financeTransactions : []);
    void saveSavingsDb(Array.isArray(next.savingsGoals) ? next.savingsGoals : []);
    void saveSharedPlansDb(Array.isArray(next.sharedPlans) ? next.sharedPlans : []);
    void savePlanTransactionsDb(Array.isArray(next.planTransactions) ? next.planTransactions : []);
    void saveImportantDatesDb(Array.isArray(next.importantDates) ? next.importantDates : []);
    void saveCalendarEventsDb(Array.isArray(next.calendarEvents) ? next.calendarEvents : []);
    void saveDocumentsDb(Array.isArray(next.documents) ? next.documents : []);
    void saveLoyaltyCardsDb(Array.isArray(next.loyaltyCards) ? next.loyaltyCards : []);
    return true;
  }, []);

  const clearEntries = useCallback(() => {
    setEntries([]);
    clearEntriesStorage();
  }, [setEntries]);

  const clearEverything = useCallback(() => {
    setEntries([]);
    setProjects([]);
    setSpaces(defaultSpaces);
    setMembers(defaultMembers);
    setKnowledge(defaultKnowledge);
    setFinanceTransactions([]);
    setSavingsGoals([]);
    setSharedPlans([]);
    setPlanTransactions([]);
    setImportantDates([]);
    setCalendarEvents([]);
    setDocuments([]);
    setLoyaltyCards([]);
    setDraft(null);
    setPreviewState(null);
    clearAllDnevnikStorage({ learnedRules: true });
  }, [setCalendarEvents, setDocuments, setDraft, setEntries, setFinanceTransactions, setImportantDates, setKnowledge, setLoyaltyCards, setMembers, setPlanTransactions, setPreviewState, setProjects, setSavingsGoals, setSharedPlans, setSpaces]);

  return useMemo(
    () => ({
      entries,
      setEntries,
      spaces,
      setSpaces,
      projects,
      setProjects,
      members,
      setMembers,
      knowledge,
      setKnowledge,
      settings,
      setSettings,
      draft,
      setDraft,
      previewState,
      setPreviewState,
      financeTransactions,
      setFinanceTransactions,
      savingsGoals,
      setSavingsGoals,
      sharedPlans,
      setSharedPlans,
      planTransactions,
      setPlanTransactions,
      importantDates,
      setImportantDates,
      calendarEvents,
      setCalendarEvents,
      documents,
      setDocuments,
      loyaltyCards,
      setLoyaltyCards,
      status,
      exportData,
      importData,
      clearEntries,
      clearEverything
    }),
    [calendarEvents, clearEntries, clearEverything, documents, draft, entries, exportData, financeTransactions, importData, importantDates, knowledge, loyaltyCards, members, planTransactions, previewState, projects, savingsGoals, setCalendarEvents, setDocuments, setDraft, setEntries, setFinanceTransactions, setImportantDates, setKnowledge, setLoyaltyCards, setMembers, setPlanTransactions, setPreviewState, setProjects, setSavingsGoals, setSettings, setSharedPlans, setSpaces, settings, sharedPlans, spaces, status]
  );
}
