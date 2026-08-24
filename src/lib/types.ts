export type EntryKind = "task" | "purchase" | "wish" | "idea" | "note" | "inbox";
export type ParsedBy = "local" | "ai" | "manual";
export type EntryStatus =
  | "active"
  | "done"
  | "waiting"
  | "want_to_buy"
  | "researching"
  | "selected"
  | "ordered"
  | "bought"
  | "cancelled";
export type Priority = "low" | "normal" | "high";
export type SchedulePreset =
  | "today"
  | "tomorrow"
  | "this_week"
  | "next_week"
  | "this_month"
  | "someday"
  | "none";
export type AssignedTo = "me" | "partner" | "shared";
export type Visibility = "private" | "shared";
export type PurchaseStatus = "planned" | "researching" | "selected" | "ordered" | "purchased" | "cancelled";
export type WishStatus = "saved" | "considering" | "planned" | "purchased" | "dismissed";
export type DomainId = "music" | "home" | "work" | "studio_equipment" | "general";
export type RepeatRule = "none" | "daily" | "weekly" | "monthly" | "weekly_monday" | "monthly_first";

export interface Space {
  id: string;
  name: string;
  icon?: string;
  accent?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  revision?: number;
}

export interface Member {
  id: "me" | "partner";
  name: string;
  role: "owner" | "partner";
  avatar: string;
  createdAt: string;
}

export interface Area {
  id: string;
  name: string;
  icon?: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
}

export interface Project {
  id: string;
  name: string;
  spaceId?: string;
  status: "active" | "completed" | "archived";
  icon?: string;
  accent?: string;
  targetDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  revision?: number;
}

export interface PurchaseDetails {
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  plannedPrice?: number;
  totalPrice?: number;
  currency?: string;
  store?: string;
  url?: string;
  status: PurchaseStatus;
  actualPrice?: number;
  purchasedAt?: string;
  priceHistory?: Array<{
    amount: number;
    currency: string;
    createdAt: string;
    note?: string;
  }>;
}

export interface WishDetails {
  estimatedPrice?: number;
  currency?: string;
  url?: string;
  imageUrl?: string;
  store?: string;
  priority?: Priority;
  status: WishStatus;
}

export interface Attachment {
  id: string;
  type: "image" | "link";
  localUrl?: string;
  remoteUrl?: string;
  name?: string;
  createdAt?: string;
}

export interface DiaryEntry {
  id: string;
  kind: EntryKind;
  title: string;
  description?: string;
  area?: string;
  spaceId?: string;
  project?: string;
  projectId?: string;
  projectPath: string[];
  assignedTo?: AssignedTo;
  visibility?: Visibility;
  createdBy?: Member["id"];
  updatedBy?: Member["id"];
  domain?: DomainId;
  category?: string;
  status: EntryStatus;
  priority: Priority;
  dueDate?: string;
  time?: string;
  repeat?: RepeatRule;
  schedule: SchedulePreset;
  parentId?: string;
  checklist?: Array<{
    id: string;
    title: string;
    done: boolean;
    createdAt: string;
  }>;
  quantity?: number;
  unitPrice?: number;
  totalPrice?: number;
  currency?: string;
  store?: string;
  url?: string;
  purchase?: PurchaseDetails;
  wish?: WishDetails;
  attachments?: Attachment[];
  notes?: string;
  needsReview?: boolean;
  sourceText?: string;
  originalInput?: string;
  parsedBy?: ParsedBy;
  confidence?: number;
  fieldConfidence?: {
    intent?: number;
    project?: number;
    date?: number;
    price?: number;
    quantity?: number;
  };
  createdAt: string;
  updatedAt: string;
  revision?: number;
  completedAt?: string;
}

export interface ProjectNode {
  id: string;
  name: string;
  area?: string;
  spaceId?: string;
  status?: "active" | "completed" | "archived";
  parentId?: string;
  aliases?: string[];
  createdAt: string;
  updatedAt?: string;
  revision?: number;
  candidate?: boolean;
}

export interface AppSettings {
  aiEnabled: boolean;
  aiProvider: string;
  aiModel?: string;
  defaultCurrency: string;
  timezone: string;
  autoSaveAfterParse: boolean;
  advancedMode: boolean;
  defaultPersonalAssignee: AssignedTo;
  defaultHomePurchaseAssignee: AssignedTo;
  askBeforeCreatingProject: boolean;
  learnFromCorrections: boolean;
  recentContextMinutes: number;
  monthlyBudget?: number;
  appearance: "system" | "light" | "dark";
  planMode?: "day" | "week" | "month";
}

export interface KnowledgeStore {
  domains: Record<string, { area: string; keywords: string[] }>;
  aliases: Record<string, string>;
  knownEntities: Record<string, { area?: string; project?: string; domain?: DomainId }>;
  projectAliases: Record<string, string[]>;
  phraseMappings: Record<string, { area?: string; project?: string; intent?: EntryKind }>;
  corrections: Array<{ id: string; phrase: string; patch: Partial<DiaryEntry>; createdAt: string }>;
  phraseRules?: Array<{ id: string; phrase: string; patch: Partial<DiaryEntry>; createdAt: string }>;
  entityMappings?: Array<{ id: string; text: string; spaceId?: string; projectId?: string; createdAt: string }>;
}

export interface SavingsGoal {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  currency: string;
  deadline?: string;
  createdBy: Member["id"];
  visibility: Visibility;
  createdAt: string;
  updatedAt: string;
  revision: number;
}

export interface FinanceTransaction {
  id: string;
  type: "planned_purchase" | "purchase_actual" | "savings_deposit" | "savings_withdrawal";
  amount: number;
  currency: string;
  relatedEntryId?: string;
  relatedGoalId?: string;
  createdAt: string;
}

export interface RecentContext {
  area?: string;
  project?: string;
  domain?: DomainId;
  updatedAt: string;
}

export interface DraftState {
  quickText: string;
  voiceTranscription?: string;
  timestamp: string;
  source: "typing" | "voice";
}

export interface PreviewState {
  preview: AIParseResult;
  timestamp: string;
}

export interface AIParseInput {
  text: string;
  timezone: string;
  learnedRules?: Array<{
    id: string;
    phrase: string;
    intent?: EntryKind;
    projectPath?: string[];
    createdAt: string;
  }>;
  projects?: ProjectNode[];
  areas?: Area[];
  members?: Member[];
  knowledge?: KnowledgeStore;
  recentContext?: RecentContext;
  settings?: AppSettings;
}

export interface AIParseResult {
  confidence: number;
  items: Array<
    Omit<DiaryEntry, "id" | "createdAt" | "updatedAt"> & {
      title: string;
      projectCandidate?: string;
    }
  >;
  rawText: string;
  needsReview?: boolean;
}

export interface AIQueryInput {
  query: string;
  entries: DiaryEntry[];
}

export interface AIQueryResult {
  answer: string;
  relatedIds: string[];
}

export interface AIProvider {
  parseInbox(input: AIParseInput): Promise<AIParseResult>;
  answerQuery(input: AIQueryInput): Promise<AIQueryResult>;
}
