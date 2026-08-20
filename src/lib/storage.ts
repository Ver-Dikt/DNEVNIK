"use client";

import type { AppSettings, DiaryEntry, ProjectNode } from "@/lib/types";

const entriesKey = "dnevnik.entries";
const projectsKey = "dnevnik.projects";
const settingsKey = "dnevnik.settings";

export const defaultSettings: AppSettings = {
  aiEnabled: false,
  aiProvider: "mock",
  defaultCurrency: "RUB",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  autoSaveAfterParse: false
};

export function loadEntries(): DiaryEntry[] {
  return readJson<DiaryEntry[]>(entriesKey, seedEntries());
}

export function saveEntries(entries: DiaryEntry[]): void {
  localStorage.setItem(entriesKey, JSON.stringify(entries));
}

export function loadProjects(): ProjectNode[] {
  return readJson<ProjectNode[]>(projectsKey, []);
}

export function saveProjects(projects: ProjectNode[]): void {
  localStorage.setItem(projectsKey, JSON.stringify(projects));
}

export function loadSettings(): AppSettings {
  return { ...defaultSettings, ...readJson<Partial<AppSettings>>(settingsKey, defaultSettings) };
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(settingsKey, JSON.stringify(settings));
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

function seedEntries(): DiaryEntry[] {
  const now = new Date().toISOString();
  return [
    {
      id: "seed-task",
      kind: "task",
      title: "Проверить петли для гардероба",
      projectPath: ["Дом", "Ремонт", "Гардероб"],
      status: "active",
      priority: "normal",
      schedule: "today",
      dueDate: now.slice(0, 10),
      createdAt: now,
      updatedAt: now
    },
    {
      id: "seed-purchase",
      kind: "purchase",
      title: "Ручки для шкафа",
      projectPath: ["Дом", "Ремонт", "Гардероб"],
      status: "want_to_buy",
      priority: "normal",
      schedule: "this_week",
      quantity: 12,
      unitPrice: 490,
      totalPrice: 5880,
      currency: "RUB",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "seed-idea",
      kind: "idea",
      title: "Сделать подсветку внутри шкафа",
      projectPath: ["Дом", "Ремонт", "Гардероб"],
      status: "active",
      priority: "low",
      schedule: "none",
      createdAt: now,
      updatedAt: now
    }
  ];
}
