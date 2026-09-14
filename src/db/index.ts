"use client";

import { validateDnevnikBackup, normalizeEntry, defaultKnowledge, defaultMembers, defaultSettings, defaultSpaces, loadCalendarEvents, loadDocuments, loadDraft, loadEntries, loadFinanceTransactions, loadImportantDates, loadKnowledge, loadLoyaltyCards, loadMembers, loadPlanTransactions, loadPreviewState, loadProjects, loadSavingsGoals, loadSettings, loadSharedPlans, loadSpaces } from "@/lib/storage";
import type { AppSettings, CalendarEvent, DiaryEntry, DocumentItem, DraftState, FinanceTransaction, ImportantDate, KnowledgeStore, LoyaltyCard, Member, PlanTransaction, PreviewState, ProjectNode, SavingsGoal, SharedPlan, Space } from "@/lib/types";
import { dbName, dbVersion, migrationBackupKey, migrationMarkerKey, stores, type DnevnikData, type StoreName } from "@/db/schema";

const singletonKeys: Partial<Record<StoreName, string>> = {
  knowledge: "knowledge",
  drafts: "draft",
  settings: "settings"
};

let dbPromise: Promise<IDBDatabase> | null = null;

export async function loadDnevnikData(): Promise<{ data: DnevnikData; usingFallback: boolean; warning?: string }> {
  if (typeof window === "undefined") return { data: emptyData(), usingFallback: true };
  try {
    const db = await openDb();
    await migrateLocalStorageToIndexedDb(db);
    return { data: await readAllData(db), usingFallback: false };
  } catch {
    return {
      data: safeFallbackData(),
      usingFallback: true,
      warning: "Основное хранилище недоступно. Долговременное сохранение не гарантировано: скачайте экспорт JSON в настройках перед закрытием."
    };
  }
}

export async function saveEntriesDb(entries: DiaryEntry[]): Promise<void> {
  await replaceAll("entries", entries);
}

export async function saveSpacesDb(spaces: Space[]): Promise<void> {
  await replaceAll("spaces", spaces);
}

export async function saveProjectsDb(projects: ProjectNode[]): Promise<void> {
  await replaceAll("projects", projects);
}

export async function saveMembersDb(members: Member[]): Promise<void> {
  await replaceAll("members", members);
}

export async function saveFinanceDb(transactions: FinanceTransaction[]): Promise<void> {
  await replaceAll("financeTransactions", transactions);
}

export async function saveSavingsDb(goals: SavingsGoal[]): Promise<void> {
  await replaceAll("savingsGoals", goals);
}

export async function saveSharedPlansDb(plans: SharedPlan[]): Promise<void> {
  await replaceAll("sharedPlans", plans);
}

export async function savePlanTransactionsDb(transactions: PlanTransaction[]): Promise<void> {
  await replaceAll("planTransactions", transactions);
}

export async function saveImportantDatesDb(dates: ImportantDate[]): Promise<void> {
  await replaceAll("importantDates", dates);
}

export async function saveCalendarEventsDb(events: CalendarEvent[]): Promise<void> {
  await replaceAll("calendarEvents", events);
}

export async function saveDocumentsDb(documents: DocumentItem[]): Promise<void> {
  await replaceAll("documents", documents);
}

export async function saveLoyaltyCardsDb(cards: LoyaltyCard[]): Promise<void> {
  await replaceAll("loyaltyCards", cards);
}

export async function saveKnowledgeDb(knowledge: KnowledgeStore): Promise<void> {
  await putSingleton("knowledge", knowledge);
}

export async function saveSettingsDb(settings: AppSettings): Promise<void> {
  await putSingleton("settings", settings);
}

export async function saveDraftDb(draft: DraftState | null): Promise<void> {
  await putSingleton("drafts", draft);
}

export async function savePreviewDb(preview: PreviewState | null): Promise<void> {
  try {
    const db = await openDb();
    await transactionDone(db, ["drafts"], "readwrite", (tx) => tx.objectStore("drafts").put(preview, "preview"));
  } catch {
    window.dispatchEvent(new Event("dnevnik:save-error"));
  }
}

export async function exportIndexedDbData(): Promise<DnevnikData> {
  const db = await openDb();
  return readAllData(db);
}

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, dbVersion);
    request.onerror = () => { dbPromise = null; reject(request.error); };
    request.onblocked = () => { dbPromise = null; reject(new Error("Закройте другие вкладки ежедневника и повторите запуск.")); };
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const store of stores) {
        if (db.objectStoreNames.contains(store)) continue;
        if (store === "knowledge" || store === "drafts" || store === "settings") {
          db.createObjectStore(store);
        } else {
          db.createObjectStore(store, { keyPath: "id" });
        }
      }
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => { request.result.close(); dbPromise = null; };
      resolve(request.result);
    };
  });
  return dbPromise;
}

async function migrateLocalStorageToIndexedDb(db: IDBDatabase): Promise<void> {
  const marker = await getSingleton<string | null>(db, "settings", null, migrationMarkerKey);
  if (marker === "complete") return;
  // A database already containing settings was migrated by an older release.
  // Never replace it with a stale or cleared localStorage mirror.
  const existingSettings = await getSingleton<AppSettings | null>(db, "settings", null);
  if (existingSettings) {
    await transactionDone(db, ["settings"], "readwrite", tx => tx.objectStore("settings").put("complete", migrationMarkerKey));
    return;
  }
  try { localStorage.getItem(migrationMarkerKey); } catch {
    await transactionDone(db, ["settings"], "readwrite", tx => tx.objectStore("settings").put("complete", migrationMarkerKey));
    return;
  }
  const snapshot = loadFallbackData();
  try { localStorage.setItem(migrationBackupKey, JSON.stringify({ ...snapshot, backedUpAt: new Date().toISOString() })); } catch { /* Migration into IndexedDB can succeed even if the mirror is full. */ }
  await writeInitialData(db, snapshot);
  const verification = await readAllData(db);
  if (verification.entries.length !== snapshot.entries.length || verification.projects.length !== snapshot.projects.length) {
    throw new Error("IndexedDB migration verification failed");
  }
  await transactionDone(db, ["settings"], "readwrite", tx => tx.objectStore("settings").put("complete", migrationMarkerKey));
  try { localStorage.setItem(migrationMarkerKey, "complete"); } catch {}
}

async function writeInitialData(db: IDBDatabase, data: DnevnikData): Promise<void> {
  await transactionDone(
    db,
    stores,
    "readwrite",
    (tx) => {
      clearAndPutMany(tx.objectStore("entries"), data.entries);
      clearAndPutMany(tx.objectStore("spaces"), data.spaces);
      clearAndPutMany(tx.objectStore("projects"), data.projects);
      clearAndPutMany(tx.objectStore("members"), data.members);
      clearAndPutMany(tx.objectStore("financeTransactions"), data.financeTransactions);
      clearAndPutMany(tx.objectStore("savingsGoals"), data.savingsGoals);
      clearAndPutMany(tx.objectStore("sharedPlans"), data.sharedPlans);
      clearAndPutMany(tx.objectStore("planTransactions"), data.planTransactions);
      clearAndPutMany(tx.objectStore("importantDates"), data.importantDates);
      clearAndPutMany(tx.objectStore("calendarEvents"), data.calendarEvents);
      clearAndPutMany(tx.objectStore("documents"), data.documents);
      clearAndPutMany(tx.objectStore("loyaltyCards"), data.loyaltyCards);
      tx.objectStore("knowledge").put(data.knowledge, "knowledge");
      tx.objectStore("settings").put(data.settings, "settings");
      tx.objectStore("settings").put("complete", migrationMarkerKey);
      tx.objectStore("drafts").put(data.draft, "draft");
      tx.objectStore("drafts").put(data.preview, "preview");
    }
  );
}

async function readAllData(db: IDBDatabase): Promise<DnevnikData> {
  const [entries, spaces, projects, members, financeTransactions, savingsGoals, sharedPlans, planTransactions, importantDates, calendarEvents, documents, loyaltyCards, knowledge, settings, draft, preview] = await Promise.all([
    getAll<DiaryEntry>(db, "entries"),
    getAll<Space>(db, "spaces"),
    getAll<ProjectNode>(db, "projects"),
    getAll<Member>(db, "members"),
    getAll<FinanceTransaction>(db, "financeTransactions"),
    getAll<SavingsGoal>(db, "savingsGoals"),
    getAll<SharedPlan>(db, "sharedPlans"),
    getAll<PlanTransaction>(db, "planTransactions"),
    getAll<ImportantDate>(db, "importantDates"),
    getAll<CalendarEvent>(db, "calendarEvents"),
    getAll<DocumentItem>(db, "documents"),
    getAll<LoyaltyCard>(db, "loyaltyCards"),
    getSingleton<KnowledgeStore>(db, "knowledge", defaultKnowledge),
    getSingleton<AppSettings>(db, "settings", defaultSettings),
    getSingleton<DraftState | null>(db, "drafts", null, "draft"),
    getSingleton<PreviewState | null>(db, "drafts", null, "preview")
  ]);
  return {
    entries,
    spaces: spaces.length ? spaces : defaultSpaces,
    projects,
    members: members.length ? members : defaultMembers,
    knowledge,
    draft,
    preview,
    settings,
    financeTransactions,
    savingsGoals,
    sharedPlans,
    planTransactions,
    importantDates,
    calendarEvents,
    documents,
    loyaltyCards
  };
}

async function replaceAll<T extends { id: string }>(store: StoreName, items: T[]): Promise<void> {
  try {
    const db = await openDb();
    await transactionDone(db, [store], "readwrite", (tx) => clearAndPutMany(tx.objectStore(store), items));
  } catch {
    window.dispatchEvent(new Event("dnevnik:save-error"));
  }
}

async function putSingleton<T>(store: StoreName, value: T): Promise<void> {
  try {
    const db = await openDb();
    const key = singletonKeys[store];
    if (!key && store !== "drafts") return;
    await transactionDone(db, [store], "readwrite", (tx) => tx.objectStore(store).put(value, key ?? "draft"));
  } catch {
    window.dispatchEvent(new Event("dnevnik:save-error"));
  }
}

function clearAndPutMany<T extends { id: string }>(store: IDBObjectStore, items: T[]): void {
  store.clear();
  for (const item of items) store.put(item);
}

function getAll<T>(db: IDBDatabase, store: StoreName): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(store, "readonly").objectStore(store).getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result as T[]);
  });
}

function getSingleton<T>(db: IDBDatabase, store: StoreName, fallback: T, key?: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(store, "readonly").objectStore(store).get(key ?? singletonKeys[store] ?? store);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve((request.result as T | undefined) ?? fallback);
  });
}

function transactionDone(db: IDBDatabase, storeNames: Iterable<string>, mode: IDBTransactionMode, body: (tx: IDBTransaction) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([...storeNames], mode);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Сохранение прервано"));
    tx.oncomplete = () => resolve();
    try { body(tx); } catch (error) {
      tx.abort();
      reject(error);
    }
  });
}

function loadFallbackData(): DnevnikData {
  return {
    entries: loadEntries(),
    spaces: loadSpaces(),
    projects: loadProjects(),
    members: loadMembers(),
    knowledge: loadKnowledge(),
    draft: loadDraft(),
    preview: loadPreviewState(),
    settings: loadSettings(),
    financeTransactions: loadFinanceTransactions(),
    savingsGoals: loadSavingsGoals(),
    sharedPlans: loadSharedPlans(),
    planTransactions: loadPlanTransactions(),
    importantDates: loadImportantDates(),
    calendarEvents: loadCalendarEvents(),
    documents: loadDocuments(),
    loyaltyCards: loadLoyaltyCards()
  };
}

function emptyData(): DnevnikData {
  return {
    entries: [],
    spaces: defaultSpaces,
    projects: [],
    members: defaultMembers,
    knowledge: defaultKnowledge,
    draft: null,
    preview: null,
    settings: defaultSettings,
    financeTransactions: [],
    savingsGoals: [],
    sharedPlans: [],
    planTransactions: [],
    importantDates: [],
    calendarEvents: [],
    documents: [],
    loyaltyCards: []
  };
}

function safeFallbackData(): DnevnikData {
  try { return loadFallbackData(); } catch { return emptyData(); }
}

/** One transaction: failure leaves every existing collection untouched. */
export async function restoreDnevnikData(input: unknown): Promise<DnevnikData> {
  if (!validateDnevnikBackup(input)) throw new Error("Некорректная резервная копия");
  const raw = input as Partial<DnevnikData> & { finance?: FinanceTransaction[]; savings?: SavingsGoal[] };
  const present = Object.fromEntries(Object.entries(raw).filter(([,value]) => value !== undefined));
  const data: DnevnikData = {
    ...emptyData(), ...present,
    entries: raw.entries!.map(normalizeEntry),
    settings: { ...defaultSettings, ...raw.settings },
    knowledge: { ...defaultKnowledge, ...raw.knowledge },
    financeTransactions: raw.financeTransactions ?? raw.finance ?? [],
    savingsGoals: raw.savingsGoals ?? raw.savings ?? []
  };
  const db = await openDb();
  await writeInitialData(db, data);
  return data;
}
