"use client";

import type {
  AppSettings,
  Area,
  CalendarEvent,
  DiaryEntry,
  DocumentItem,
  DraftState,
  FinanceTransaction,
  ImportantDate,
  KnowledgeStore,
  LoyaltyCard,
  Member,
  PlanTransaction,
  PreviewState,
  ProjectNode,
  SharedPlan,
  Space,
  SavingsGoal
} from "@/lib/types";

export interface StorageProvider {
  load<T>(key: string, fallback: T): T;
  save<T>(key: string, value: T): void;
  remove(key: string): void;
}

export class LocalStorageProvider implements StorageProvider {
  load<T>(key: string, fallback: T): T {
    return readJson(key, fallback);
  }

  save<T>(key: string, value: T): void {
    localStorage.setItem(key, JSON.stringify(value));
  }

  remove(key: string): void {
    localStorage.removeItem(key);
  }
}

export class SupabaseStorageProvider implements StorageProvider {
  load<T>(key: string, fallback: T): T {
    void key;
    return fallback;
  }

  save<T>(key: string, value: T): void {
    void key;
    void value;
    // Placeholder for future sync. GitHub Pages remains fully local.
  }

  remove(key: string): void {
    void key;
    // Placeholder for future sync. GitHub Pages remains fully local.
  }
}

const entriesKey = "dnevnik.entries";
const projectsKey = "dnevnik.projects";
const areasKey = "dnevnik.areas";
const membersKey = "dnevnik.members";
const knowledgeKey = "dnevnik.knowledge";
const settingsKey = "dnevnik.settings";
const draftKey = "dnevnik.draft";
const previewKey = "dnevnik.preview";
const financeKey = "dnevnik.finance";
const savingsKey = "dnevnik.savings";
const sharedPlansKey = "dnevnik.sharedPlans";
const planTransactionsKey = "dnevnik.planTransactions";
const importantDatesKey = "dnevnik.importantDates";
const calendarEventsKey = "dnevnik.calendarEvents";
const documentsKey = "dnevnik.documents";
const loyaltyCardsKey = "dnevnik.loyaltyCards";
const spacesKey = "dnevnik.spaces";
const storageVersionKey = "dnevnik.storageVersion";
const backupV2Key = "dnevnik.backup.v2";
const backupV3Key = "dnevnik.backup.v3-pre-migration";
const currentStorageVersion = "4";
const seedIds = new Set(["seed-task", "seed-purchase", "seed-idea"]);

export const defaultMembers: Member[] = [
  { id: "me", name: "Я", role: "owner", avatar: "Я", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", revision: 1 },
  { id: "partner", name: "Партнёр", role: "partner", avatar: "П", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", revision: 1 }
];

export const defaultAreas: Area[] = ["Дом", "Музыка", "Работа", "Личное", "Семья", "Студия"].map((name) => ({
  id: slug(name),
  name,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  revision: 1
}));

export const defaultSpaces: Space[] = defaultAreas.map((area) => ({
  id: area.id,
  name: area.name,
  icon: area.name === "Дом" ? "home" : area.name === "Музыка" ? "music" : area.name === "Студия" ? "sliders" : undefined,
  accent: area.name === "Дом" ? "#0f8f72" : area.name === "Музыка" ? "#5b5bd6" : area.name === "Студия" ? "#c2762f" : "#607085",
  createdAt: area.createdAt,
  updatedAt: area.updatedAt,
  revision: area.revision
}));

export const defaultKnowledge: KnowledgeStore = {
  domains: {
    music: {
      area: "Музыка",
      keywords: ["трек", "свести", "сведение", "mix", "mixing", "мастер", "мастеринг", "master", "ableton", "аранжировка", "вокал", "stems", "premaster", "релиз", "обложка", "дистрибуция", "label", "demo"]
    },
    home: {
      area: "Дом",
      keywords: ["шкаф", "гардероб", "краска", "петли", "ручки", "ремонт", "стена", "кухня", "ванная", "мебель", "коридор", "порошок", "туалетная бумага"]
    },
    studio_equipment: {
      area: "Студия",
      keywords: ["xlr", "микшер", "контроллер", "фейдер", "потенциометр", "колонка", "акустика", "кабель", "усилитель"]
    },
    work: {
      area: "Работа",
      keywords: ["работа", "клиент", "заказ", "смена", "площадка", "заведение", "мероприятие", "согласовать", "отправить клиенту", "афиша", "бар"]
    }
  },
  aliases: {
    шкаф: "гардероб",
    гардеробу: "гардероб",
    домой: "дом",
    дома: "дом"
  },
  knownEntities: {
    гардероб: { area: "Дом", project: "Гардероб", domain: "home" },
    шкаф: { area: "Дом", project: "Гардероб", domain: "home" },
    микшер: { area: "Студия", domain: "studio_equipment" }
  },
  projectAliases: {
    Гардероб: ["гардероб", "шкаф", "шкафу", "шкафу"],
    Grafton: ["grafton"],
    PAX: ["pax", "пакс"]
  },
  phraseMappings: {
    свести: { area: "Музыка", intent: "task" },
    мастер: { area: "Музыка", intent: "task" },
    работа: { area: "Работа", intent: "task" },
    купить: { intent: "purchase" }
  },
  corrections: []
};

export const defaultSettings: AppSettings = {
  aiEnabled: false,
  aiProvider: "mock",
  defaultCurrency: "RUB",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  autoSaveAfterParse: false,
  advancedMode: false,
  defaultPersonalAssignee: "me",
  defaultHomePurchaseAssignee: "shared",
  askBeforeCreatingProject: true,
  learnFromCorrections: true,
  recentContextMinutes: 20,
  appearance: "dark",
  planMode: "month"
};

export function loadEntries(): DiaryEntry[] {
  migrateStorage();
  return readJson<DiaryEntry[]>(entriesKey, []);
}

export function saveEntries(entries: DiaryEntry[]): void {
  localStorage.setItem(entriesKey, JSON.stringify(entries.map(normalizeEntry)));
}

export function loadProjects(): ProjectNode[] {
  migrateStorage();
  return readJson<ProjectNode[]>(projectsKey, []);
}

export function saveProjects(projects: ProjectNode[]): void {
  localStorage.setItem(projectsKey, JSON.stringify(projects));
}

export function loadAreas(): Area[] {
  migrateStorage();
  return readJson<Area[]>(areasKey, defaultAreas);
}

export function loadSpaces(): Space[] {
  migrateStorage();
  return readJson<Space[]>(spacesKey, defaultSpaces);
}

export function saveSpaces(spaces: Space[]): void {
  localStorage.setItem(spacesKey, JSON.stringify(spaces));
  localStorage.setItem(areasKey, JSON.stringify(spaces.map(spaceToArea)));
}

export function saveAreas(areas: Area[]): void {
  localStorage.setItem(areasKey, JSON.stringify(areas));
}

export function loadMembers(): Member[] {
  migrateStorage();
  return readJson<Member[]>(membersKey, defaultMembers);
}

export function saveMembers(members: Member[]): void {
  localStorage.setItem(membersKey, JSON.stringify(members));
}

export function loadKnowledge(): KnowledgeStore {
  migrateStorage();
  return { ...defaultKnowledge, ...readJson<Partial<KnowledgeStore>>(knowledgeKey, defaultKnowledge) };
}

export function saveKnowledge(knowledge: KnowledgeStore): void {
  localStorage.setItem(knowledgeKey, JSON.stringify(knowledge));
}

export function loadSettings(): AppSettings {
  migrateStorage();
  return { ...defaultSettings, ...readJson<Partial<AppSettings>>(settingsKey, defaultSettings) };
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(settingsKey, JSON.stringify(settings));
}

export function loadDraft(): DraftState | null {
  migrateStorage();
  return readJson<DraftState | null>(draftKey, null);
}

export function saveDraft(draft: DraftState | null): void {
  if (!draft) localStorage.removeItem(draftKey);
  else localStorage.setItem(draftKey, JSON.stringify(draft));
}

export function loadPreviewState(): PreviewState | null {
  migrateStorage();
  return readJson<PreviewState | null>(previewKey, null);
}

export function savePreviewState(preview: PreviewState | null): void {
  if (!preview) localStorage.removeItem(previewKey);
  else localStorage.setItem(previewKey, JSON.stringify(preview));
}

export function loadFinanceTransactions(): FinanceTransaction[] {
  migrateStorage();
  return readJson<FinanceTransaction[]>(financeKey, []);
}

export function saveFinanceTransactions(transactions: FinanceTransaction[]): void {
  localStorage.setItem(financeKey, JSON.stringify(transactions));
}

export function loadSavingsGoals(): SavingsGoal[] {
  migrateStorage();
  return readJson<SavingsGoal[]>(savingsKey, []);
}

export function saveSavingsGoals(goals: SavingsGoal[]): void {
  localStorage.setItem(savingsKey, JSON.stringify(goals));
}

export function loadSharedPlans(): SharedPlan[] {
  migrateStorage();
  return readJson<SharedPlan[]>(sharedPlansKey, []);
}

export function saveSharedPlans(plans: SharedPlan[]): void {
  localStorage.setItem(sharedPlansKey, JSON.stringify(plans));
}

export function loadPlanTransactions(): PlanTransaction[] {
  migrateStorage();
  return readJson<PlanTransaction[]>(planTransactionsKey, []);
}

export function savePlanTransactions(transactions: PlanTransaction[]): void {
  localStorage.setItem(planTransactionsKey, JSON.stringify(transactions));
}

export function loadImportantDates(): ImportantDate[] {
  migrateStorage();
  return readJson<ImportantDate[]>(importantDatesKey, []);
}

export function saveImportantDates(dates: ImportantDate[]): void {
  localStorage.setItem(importantDatesKey, JSON.stringify(dates));
}

export function loadCalendarEvents(): CalendarEvent[] {
  migrateStorage();
  return readJson<CalendarEvent[]>(calendarEventsKey, []);
}

export function saveCalendarEvents(events: CalendarEvent[]): void {
  localStorage.setItem(calendarEventsKey, JSON.stringify(events));
}

export function loadDocuments(): DocumentItem[] {
  migrateStorage();
  return readJson<DocumentItem[]>(documentsKey, []);
}

export function saveDocuments(documents: DocumentItem[]): void {
  localStorage.setItem(documentsKey, JSON.stringify(documents));
}

export function loadLoyaltyCards(): LoyaltyCard[] {
  migrateStorage();
  return readJson<LoyaltyCard[]>(loyaltyCardsKey, []);
}

export function saveLoyaltyCards(cards: LoyaltyCard[]): void {
  localStorage.setItem(loyaltyCardsKey, JSON.stringify(cards));
}

export function exportDnevnikData() {
  migrateStorage();
  return {
    version: currentStorageVersion,
    exportedAt: new Date().toISOString(),
    entries: loadEntries(),
    projects: loadProjects(),
    areas: loadAreas(),
    members: loadMembers(),
    knowledge: loadKnowledge(),
    finance: loadFinanceTransactions(),
    savings: loadSavingsGoals(),
    sharedPlans: loadSharedPlans(),
    planTransactions: loadPlanTransactions(),
    importantDates: loadImportantDates(),
    calendarEvents: loadCalendarEvents(),
    documents: loadDocuments(),
    loyaltyCards: loadLoyaltyCards(),
    spaces: loadSpaces(),
    settings: loadSettings()
  };
}

export function validateDnevnikBackup(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const next = data as Partial<ReturnType<typeof exportDnevnikData>> & { financeTransactions?: FinanceTransaction[]; savingsGoals?: SavingsGoal[]; draft?: DraftState; preview?: PreviewState };
  if (!Array.isArray(next.entries) || !next.entries.every(entry => entry && typeof entry.id === "string" && typeof entry.title === "string" && typeof entry.kind === "string")) return false;
  const collections = [next.projects, next.spaces, next.members, next.financeTransactions, next.finance, next.savingsGoals, next.savings, next.sharedPlans, next.planTransactions, next.importantDates, next.calendarEvents, next.documents, next.loyaltyCards];
  if (collections.some(items => items !== undefined && (!Array.isArray(items) || !items.every(item => item && typeof item.id === "string")))) return false;
  if (next.draft != null && (typeof next.draft !== "object" || typeof next.draft.quickText !== "string")) return false;
  if (next.preview != null && (typeof next.preview !== "object" || !next.preview.preview || !Array.isArray(next.preview.preview.items))) return false;
  if (next.documents?.some(item => typeof item.title !== "string" || !Array.isArray(item.attachments))) return false;
  if (next.settings != null && (typeof next.settings !== "object" || Array.isArray(next.settings))) return false;
  if (next.entries.some(entry => !["task", "purchase", "wish", "idea", "note", "inbox"].includes(entry.kind))) return false;
  for (const items of [next.entries, ...collections]) { if (Array.isArray(items) && new Set(items.map(item => item.id)).size !== items.length) return false; }
  return true;
}

export function importDnevnikData(data: unknown): boolean {
  if (!validateDnevnikBackup(data)) return false;
  if (!data || typeof data !== "object") return false;
  const next = data as Partial<ReturnType<typeof exportDnevnikData>> & { financeTransactions?: FinanceTransaction[]; savingsGoals?: SavingsGoal[]; draft?: DraftState; preview?: PreviewState };
  if (!Array.isArray(next.entries) || !next.entries.every(entry => entry && typeof entry.id === "string" && typeof entry.title === "string" && typeof entry.kind === "string")) return false;
  const collections = [next.projects, next.spaces, next.members, next.financeTransactions, next.finance, next.savingsGoals, next.savings, next.sharedPlans, next.planTransactions, next.importantDates, next.calendarEvents, next.documents, next.loyaltyCards];
  if (collections.some(items => items !== undefined && (!Array.isArray(items) || !items.every(item => item && typeof item.id === "string")))) return false;
  next.finance = next.financeTransactions ?? next.finance;
  next.savings = next.savingsGoals ?? next.savings;
  saveDraft(next.draft ?? null);
  savePreviewState(next.preview ?? null);
  localStorage.setItem(entriesKey, JSON.stringify(next.entries.map(normalizeEntry)));
  localStorage.setItem(projectsKey, JSON.stringify(Array.isArray(next.projects) ? next.projects : []));
  localStorage.setItem(areasKey, JSON.stringify(Array.isArray(next.areas) ? next.areas : defaultAreas));
  localStorage.setItem(spacesKey, JSON.stringify(Array.isArray((next as { spaces?: Space[] }).spaces) ? (next as { spaces?: Space[] }).spaces : defaultSpaces));
  localStorage.setItem(membersKey, JSON.stringify(Array.isArray(next.members) ? next.members : defaultMembers));
  localStorage.setItem(knowledgeKey, JSON.stringify(next.knowledge ?? defaultKnowledge));
  localStorage.setItem(financeKey, JSON.stringify(Array.isArray(next.finance) ? next.finance : []));
  localStorage.setItem(savingsKey, JSON.stringify(Array.isArray(next.savings) ? next.savings : []));
  localStorage.setItem(sharedPlansKey, JSON.stringify(Array.isArray(next.sharedPlans) ? next.sharedPlans : []));
  localStorage.setItem(planTransactionsKey, JSON.stringify(Array.isArray(next.planTransactions) ? next.planTransactions : []));
  localStorage.setItem(importantDatesKey, JSON.stringify(Array.isArray(next.importantDates) ? next.importantDates : []));
  localStorage.setItem(calendarEventsKey, JSON.stringify(Array.isArray(next.calendarEvents) ? next.calendarEvents : []));
  localStorage.setItem(documentsKey, JSON.stringify(Array.isArray(next.documents) ? next.documents : []));
  localStorage.setItem(loyaltyCardsKey, JSON.stringify(Array.isArray(next.loyaltyCards) ? next.loyaltyCards : []));
  localStorage.setItem(settingsKey, JSON.stringify({ ...defaultSettings, ...(next.settings ?? {}) }));
  localStorage.setItem(storageVersionKey, currentStorageVersion);
  return true;
}

export function clearEntriesStorage(): void {
  localStorage.setItem(entriesKey, JSON.stringify([]));
  localStorage.setItem(storageVersionKey, currentStorageVersion);
}

export function clearAllDnevnikStorage(options: { learnedRules?: boolean } = {}): void {
  localStorage.setItem(entriesKey, JSON.stringify([]));
  localStorage.setItem(projectsKey, JSON.stringify([]));
  localStorage.setItem(areasKey, JSON.stringify(defaultAreas));
  localStorage.setItem(spacesKey, JSON.stringify(defaultSpaces));
  localStorage.setItem(membersKey, JSON.stringify(defaultMembers));
  localStorage.setItem(knowledgeKey, JSON.stringify(defaultKnowledge));
  localStorage.setItem(financeKey, JSON.stringify([]));
  localStorage.setItem(savingsKey, JSON.stringify([]));
  localStorage.setItem(sharedPlansKey, JSON.stringify([]));
  localStorage.setItem(planTransactionsKey, JSON.stringify([]));
  localStorage.setItem(importantDatesKey, JSON.stringify([]));
  localStorage.setItem(calendarEventsKey, JSON.stringify([]));
  localStorage.setItem(documentsKey, JSON.stringify([]));
  localStorage.setItem(loyaltyCardsKey, JSON.stringify([]));
  localStorage.removeItem(draftKey);
  localStorage.removeItem(previewKey);
  localStorage.setItem(storageVersionKey, currentStorageVersion);
  if (options.learnedRules) localStorage.setItem("dnevnik.learnedRules", JSON.stringify([]));
}

export function storageVersion(): string {
  if (typeof window === "undefined") return currentStorageVersion;
  return localStorage.getItem(storageVersionKey) ?? "1";
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function migrateStorage(): void {
  if (typeof window === "undefined") return;
  const version = localStorage.getItem(storageVersionKey);
  if (version === currentStorageVersion) return;

  const previous = {
    version: version ?? "1",
    entries: readJson<DiaryEntry[]>(entriesKey, []),
    projects: readJson<ProjectNode[]>(projectsKey, []),
    spaces: readJson<Space[]>(spacesKey, []),
    settings: readJson<Partial<AppSettings>>(settingsKey, {})
  };
  if (!localStorage.getItem(backupV2Key)) localStorage.setItem(backupV2Key, JSON.stringify({ ...previous, backedUpAt: new Date().toISOString() }));
  if (!localStorage.getItem(backupV3Key)) localStorage.setItem(backupV3Key, JSON.stringify({ ...previous, backedUpAt: new Date().toISOString() }));

  const migratedEntries = previous.entries.filter((entry) => !seedIds.has(entry.id)).map(normalizeEntry);
  const projectMap = new Map<string, ProjectNode>();
  for (const entry of migratedEntries) {
    if (!entry.project) continue;
    const area = entry.area ?? entry.projectPath[0] ?? "Личное";
    projectMap.set(`${area}/${entry.project}`, {
      id: slug(`${area}-${entry.project}`),
      name: entry.project,
      area,
      aliases: [],
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      revision: entry.revision ?? 1
    });
  }

  localStorage.setItem(entriesKey, JSON.stringify(migratedEntries));
  localStorage.setItem(projectsKey, JSON.stringify([...projectMap.values(), ...previous.projects]));
  localStorage.setItem(areasKey, JSON.stringify(readJson<Area[]>(areasKey, defaultAreas)));
  localStorage.setItem(spacesKey, JSON.stringify(previous.spaces.length ? previous.spaces : defaultSpaces));
  localStorage.setItem(membersKey, JSON.stringify(readJson<Member[]>(membersKey, defaultMembers)));
  localStorage.setItem(knowledgeKey, JSON.stringify(readJson<KnowledgeStore>(knowledgeKey, defaultKnowledge)));
  localStorage.setItem(financeKey, JSON.stringify(readJson<FinanceTransaction[]>(financeKey, [])));
  localStorage.setItem(savingsKey, JSON.stringify(readJson<SavingsGoal[]>(savingsKey, [])));
  localStorage.setItem(sharedPlansKey, JSON.stringify(readJson<SharedPlan[]>(sharedPlansKey, [])));
  localStorage.setItem(planTransactionsKey, JSON.stringify(readJson<PlanTransaction[]>(planTransactionsKey, [])));
  localStorage.setItem(importantDatesKey, JSON.stringify(readJson<ImportantDate[]>(importantDatesKey, [])));
  localStorage.setItem(calendarEventsKey, JSON.stringify(readJson<CalendarEvent[]>(calendarEventsKey, [])));
  localStorage.setItem(documentsKey, JSON.stringify(readJson<DocumentItem[]>(documentsKey, [])));
  localStorage.setItem(loyaltyCardsKey, JSON.stringify(readJson<LoyaltyCard[]>(loyaltyCardsKey, [])));
  localStorage.setItem(settingsKey, JSON.stringify({ ...defaultSettings, ...previous.settings }));
  localStorage.setItem(storageVersionKey, currentStorageVersion);
}

export function normalizeEntry(entry: DiaryEntry): DiaryEntry {
  const projectPath = entry.projectPath ?? [];
  const area = entry.area ?? projectPath[0] ?? inferArea(entry);
  const project = entry.project ?? projectPath.at(-1);
  const assignedTo = entry.assignedTo ?? (entry.kind === "purchase" && area === "Дом" ? "shared" : "me");
  const visibility = entry.visibility ?? (assignedTo === "shared" ? "shared" : "private");
  const purchase =
    entry.kind === "purchase"
      ? {
          status: entry.purchase?.status ?? (entry.status === "bought" ? "purchased" : "planned"),
          quantity: entry.purchase?.quantity ?? entry.quantity,
          unitPrice: entry.purchase?.unitPrice ?? entry.unitPrice,
          plannedPrice: entry.purchase?.plannedPrice ?? entry.purchase?.totalPrice ?? entry.totalPrice,
          totalPrice: entry.purchase?.totalPrice ?? entry.totalPrice,
          currency: entry.purchase?.currency ?? entry.currency ?? "RUB",
          store: entry.purchase?.store ?? entry.store,
          url: entry.purchase?.url ?? entry.url,
          actualPrice: entry.purchase?.actualPrice,
          purchasedAt: entry.purchase?.purchasedAt,
          priceHistory: entry.purchase?.priceHistory ?? []
        }
      : entry.purchase;
  const wish =
    entry.kind === "wish"
      ? {
          status: entry.wish?.status ?? "saved",
          estimatedPrice: entry.wish?.estimatedPrice ?? entry.totalPrice ?? entry.unitPrice,
          currency: entry.wish?.currency ?? entry.currency ?? "RUB",
          url: entry.wish?.url ?? entry.url,
          imageUrl: entry.wish?.imageUrl,
          store: entry.wish?.store ?? entry.store,
          priority: entry.wish?.priority ?? entry.priority
        }
      : entry.wish;

  return {
    ...entry,
    kind: entry.kind === "inbox" ? "note" : entry.kind,
    area,
    project,
    projectPath: projectPath.length ? projectPath : [area, project].filter(Boolean) as string[],
    assignedTo,
    visibility,
    createdBy: entry.createdBy ?? "me",
    updatedBy: entry.updatedBy ?? "me",
    purchase,
    wish,
    attachments: entry.attachments ?? (entry.url ? [{ id: `link-${entry.id}`, type: "link", remoteUrl: entry.url, name: domainFromUrl(entry.url), createdAt: entry.createdAt }] : []),
    repeat: entry.repeat ?? "none",
    checklist: entry.checklist ?? [],
    needsReview: Boolean(entry.needsReview),
    revision: entry.revision ?? 1
  };
}

function spaceToArea(space: Space): Area {
  return {
    id: space.id,
    name: space.name,
    icon: space.icon,
    createdAt: space.createdAt,
    updatedAt: space.updatedAt,
    revision: space.revision ?? 1
  };
}

function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function inferArea(entry: DiaryEntry): string {
  const text = `${entry.title} ${entry.description ?? ""}`.toLowerCase();
  if (/(трек|свести|мастер|ableton|релиз|grafton|pax)/i.test(text)) return "Музыка";
  if (/(гардероб|шкаф|краск|петл|ручк|ремонт|дом|порошок)/i.test(text)) return "Дом";
  if (/(xlr|микшер|кабель|потенциометр|акустик)/i.test(text)) return "Студия";
  return "Личное";
}

function slug(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-zа-я0-9-]/gi, "");
}
