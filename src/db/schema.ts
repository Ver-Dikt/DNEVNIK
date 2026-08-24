import type { AppSettings, DiaryEntry, DraftState, FinanceTransaction, KnowledgeStore, Member, PreviewState, ProjectNode, SavingsGoal, Space } from "@/lib/types";

export const dbName = "dnevnik-db";
export const dbVersion = 1;
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
}

export interface DbStatus {
  ready: boolean;
  usingFallback: boolean;
  warning?: string;
}
