import type { AppSettings, CalendarEvent, DiaryEntry, DocumentItem, DraftState, FinanceTransaction, ImportantDate, KnowledgeStore, LoyaltyCard, Member, PlanTransaction, PreviewState, ProjectNode, SavingsGoal, SharedPlan, Space } from "@/lib/types";

export const dbName = "dnevnik-db";
export const dbVersion = 2;
export const migrationMarkerKey = "dnevnik.indexeddb.migration.v1";
export const migrationBackupKey = "dnevnik.backup.indexeddb-v1-pre-migration";

export const stores = [
  "entries",
  "spaces",
  "projects",
  "members",
  "knowledge",
  "drafts",
  "settings",
  "financeTransactions",
  "savingsGoals",
  "sharedPlans",
  "planTransactions",
  "importantDates",
  "calendarEvents",
  "documents",
  "loyaltyCards",
  "attachments"
] as const;

export type StoreName = (typeof stores)[number];

export interface DnevnikData {
  entries: DiaryEntry[];
  spaces: Space[];
  projects: ProjectNode[];
  members: Member[];
  knowledge: KnowledgeStore;
  draft: DraftState | null;
  preview: PreviewState | null;
  settings: AppSettings;
  financeTransactions: FinanceTransaction[];
  savingsGoals: SavingsGoal[];
  sharedPlans: SharedPlan[];
  planTransactions: PlanTransaction[];
  importantDates: ImportantDate[];
  calendarEvents: CalendarEvent[];
  documents: DocumentItem[];
  loyaltyCards: LoyaltyCard[];
}

export interface DbStatus {
  ready: boolean;
  usingFallback: boolean;
  warning?: string;
}
