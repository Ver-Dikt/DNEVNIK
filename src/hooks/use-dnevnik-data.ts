"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { exportIndexedDbData, loadDnevnikData, saveDraftDb, saveEntriesDb, saveFinanceDb, saveKnowledgeDb, saveMembersDb, savePreviewDb, saveProjectsDb, saveSavingsDb, saveSettingsDb, saveSpacesDb } from "@/db";
import type { DbStatus } from "@/db/schema";
import { clearAllDnevnikStorage, clearEntriesStorage, defaultKnowledge, defaultMembers, defaultSettings, defaultSpaces, importDnevnikData, saveDraft, saveEntries, saveFinanceTransactions, saveKnowledge, saveMembers, savePreviewState, saveProjects, saveSavingsGoals, saveSettings, saveSpaces } from "@/lib/storage";
import type { AppSettings, DiaryEntry, DraftState, FinanceTransaction, KnowledgeStore, Member, PreviewState, ProjectNode, SavingsGoal, Space } from "@/lib/types";

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
      setStatus({ ready: true, usingFallback: result.usingFallback, warning: result.warning });
    });
    return () => {
      cancelled = true;
    };
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

  const exportData = useCallback(async () => {
    try {
      return await exportIndexedDbData();
    } catch {
      return { entries, spaces, projects, members, knowledge, draft, preview: previewState, settings, financeTransactions, savingsGoals };
    }
  }, [draft, entries, financeTransactions, knowledge, members, previewState, projects, savingsGoals, settings, spaces]);

  const importData = useCallback((data: unknown) => {
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
    setDraft(null);
    setPreviewState(null);
    clearAllDnevnikStorage({ learnedRules: true });
  }, [setDraft, setEntries, setFinanceTransactions, setKnowledge, setMembers, setPreviewState, setProjects, setSavingsGoals, setSpaces]);

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
      status,
      exportData,
      importData,
      clearEntries,
      clearEverything
    }),
    [clearEntries, clearEverything, draft, entries, exportData, financeTransactions, importData, knowledge, members, previewState, projects, savingsGoals, setDraft, setEntries, setFinanceTransactions, setKnowledge, setMembers, setPreviewState, setProjects, setSavingsGoals, setSettings, setSpaces, settings, spaces, status]
  );
}
