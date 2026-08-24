import type { AppSettings, Area, AssignedTo, DomainId, EntryKind, EntryStatus, KnowledgeStore, Priority, ProjectNode, PurchaseDetails, RecentContext, RepeatRule, SchedulePreset, Visibility, WishDetails } from "@/lib/types";

export type SmartIntent = EntryKind | "wish" | "note" | "link" | "reminder" | "waiting" | "project_related" | "unknown";

export interface ParserConfig {
  highConfidence: number;
  lowConfidence: number;
}

export interface LearnedRule {
  id: string;
  phrase: string;
  intent?: EntryKind;
  projectPath?: string[];
  createdAt: string;
}

export interface ParserContext {
  now?: Date;
  timezone: string;
  projects?: ProjectNode[];
  learnedRules?: LearnedRule[];
  areas?: Area[];
  knowledge?: KnowledgeStore;
  recentContext?: RecentContext;
  settings?: AppSettings;
}

export interface NormalizedInput {
  original: string;
  normalized: string;
  tokens: string[];
}

export interface DateParseResult {
  schedule: SchedulePreset;
  dueDate?: string;
  timeHint?: "morning" | "day" | "evening" | "night";
  confidence: number;
  matchedText?: string;
}

export interface PriceParseResult {
  unitPrice?: number;
  totalPrice?: number;
  currency?: string;
  confidence: number;
  matchedText?: string;
}

export interface QuantityParseResult {
  quantity?: number;
  unit?: string;
  confidence: number;
  matchedText?: string;
}

export interface IntentResult {
  intent: SmartIntent;
  confidence: number;
  matchedText?: string;
}

export interface ProjectMatchResult {
  projectPath: string[];
  confidence: number;
  matchedText?: string;
}

export interface SmartParsedItem {
  kind: EntryKind;
  title: string;
  description?: string;
  area?: string;
  project?: string;
  assignedTo?: AssignedTo;
  visibility?: Visibility;
  domain?: DomainId;
  category?: string;
  projectCandidate?: string;
  projectPath: string[];
  status: EntryStatus;
  priority: Priority;
  schedule: SchedulePreset;
  dueDate?: string;
  time?: string;
  repeat?: RepeatRule;
  quantity?: number;
  unitPrice?: number;
  totalPrice?: number;
  currency?: string;
  url?: string;
  purchase?: PurchaseDetails;
  wish?: WishDetails;
  notes?: string;
  needsReview?: boolean;
  sourceText: string;
  originalInput: string;
  parsedBy: "local";
  confidence: number;
  fieldConfidence: {
    intent: number;
    project: number;
    date: number;
    price: number;
    quantity: number;
  };
}

export interface SmartParseResult {
  confidence: number;
  items: SmartParsedItem[];
  originalInput: string;
  parsedBy: "local";
  needsReview?: boolean;
}
