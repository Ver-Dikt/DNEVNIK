export type EntryKind = "task" | "purchase" | "idea" | "inbox";
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

export interface DiaryEntry {
  id: string;
  kind: EntryKind;
  title: string;
  description?: string;
  projectPath: string[];
  status: EntryStatus;
  priority: Priority;
  dueDate?: string;
  schedule: SchedulePreset;
  quantity?: number;
  unitPrice?: number;
  totalPrice?: number;
  currency?: string;
  store?: string;
  url?: string;
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
  completedAt?: string;
}

export interface ProjectNode {
  id: string;
  name: string;
  parentId?: string;
  aliases?: string[];
  createdAt: string;
}

export interface AppSettings {
  aiEnabled: boolean;
  aiProvider: string;
  aiModel?: string;
  defaultCurrency: string;
  timezone: string;
  autoSaveAfterParse: boolean;
  advancedMode: boolean;
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
}

export interface AIParseResult {
  confidence: number;
  items: Array<
    Omit<DiaryEntry, "id" | "createdAt" | "updatedAt"> & {
      title: string;
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
