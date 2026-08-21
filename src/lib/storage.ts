"use client";

import type {
  AppSettings,
  Area,
  DiaryEntry,
  DraftState,
  FinanceTransaction,
  KnowledgeStore,
  Member,
  PreviewState,
  ProjectNode,
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
const storageVersionKey = "dnevnik.storageVersion";
const backupV2Key = "dnevnik.backup.v2";
const backupV3Key = "dnevnik.backup.v3-pre-migration";
const currentStorageVersion = "4";
const seedIds = new Set(["seed-task", "seed-purchase", "seed-idea"]);

export const defaultMembers: Member[] = [
  { id: "me", name: "Я", role: "owner", avatar: "Я", createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "partner", name: "Партнёр", role: "partner", avatar: "П", createdAt: "2026-01-01T00:00:00.000Z" }
];

export const defaultAreas: Area[] = ["Дом", "Музыка", "Работа", "Личное", "Семья", "Студия"].map((name) => ({
  id: slug(name),
  name,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  revision: 1
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
  appearance: "system"
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
    settings: loadSettings()
  };
}

export function importDnevnikData(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const next = data as Partial<ReturnType<typeof exportDnevnikData>>;
  if (!Array.isArray(next.entries)) return false;
  localStorage.setItem(entriesKey, JSON.stringify(next.entries.map(normalizeEntry)));
  localStorage.setItem(projectsKey, JSON.stringify(Array.isArray(next.projects) ? next.projects : []));
  localStorage.setItem(areasKey, JSON.stringify(Array.isArray(next.areas) ? next.areas : defaultAreas));
  localStorage.setItem(membersKey, JSON.stringify(Array.isArray(next.members) ? next.members : defaultMembers));
  localStorage.setItem(knowledgeKey, JSON.stringify(next.knowledge ?? defaultKnowledge));
  localStorage.setItem(financeKey, JSON.stringify(Array.isArray(next.finance) ? next.finance : []));
  localStorage.setItem(savingsKey, JSON.stringify(Array.isArray(next.savings) ? next.savings : []));
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
  localStorage.setItem(membersKey, JSON.stringify(defaultMembers));
  localStorage.setItem(knowledgeKey, JSON.stringify(defaultKnowledge));
  localStorage.setItem(financeKey, JSON.stringify([]));
  localStorage.setItem(savingsKey, JSON.stringify([]));
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
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
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
  localStorage.setItem(areasKey, JSON.stringify(defaultAreas));
  localStorage.setItem(membersKey, JSON.stringify(defaultMembers));
  localStorage.setItem(knowledgeKey, JSON.stringify(defaultKnowledge));
  localStorage.setItem(financeKey, JSON.stringify(readJson<FinanceTransaction[]>(financeKey, [])));
  localStorage.setItem(savingsKey, JSON.stringify(readJson<SavingsGoal[]>(savingsKey, [])));
  localStorage.setItem(settingsKey, JSON.stringify({ ...defaultSettings, ...previous.settings }));
  localStorage.setItem(storageVersionKey, currentStorageVersion);
}

function normalizeEntry(entry: DiaryEntry): DiaryEntry {
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
    repeat: entry.repeat ?? "none",
    checklist: entry.checklist ?? [],
    needsReview: Boolean(entry.needsReview),
    revision: entry.revision ?? 1
  };
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
