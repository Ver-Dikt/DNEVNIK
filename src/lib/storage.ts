"use client";

import type { AppSettings, DiaryEntry, ProjectNode } from "@/lib/types";

const entriesKey = "dnevnik.entries";
const projectsKey = "dnevnik.projects";
const settingsKey = "dnevnik.settings";
const storageVersionKey = "dnevnik.storageVersion";
const currentStorageVersion = "2";
const seedIds = new Set(["seed-task", "seed-purchase", "seed-idea"]);

export const defaultSettings: AppSettings = {
  aiEnabled: false,
  aiProvider: "mock",
  defaultCurrency: "RUB",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  autoSaveAfterParse: false,
  advancedMode: false
};

export function loadEntries(): DiaryEntry[] {
  migrateStorage();
  return readJson<DiaryEntry[]>(entriesKey, []);
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

export function clearEntriesStorage(): void {
  localStorage.setItem(entriesKey, JSON.stringify([]));
  localStorage.setItem(storageVersionKey, currentStorageVersion);
}

export function clearAllDnevnikStorage(options: { learnedRules?: boolean } = {}): void {
  localStorage.setItem(entriesKey, JSON.stringify([]));
  localStorage.setItem(projectsKey, JSON.stringify([]));
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

  const entries = readJson<DiaryEntry[]>(entriesKey, []);
  const migrated = entries.filter((entry) => !seedIds.has(entry.id));
  localStorage.setItem(entriesKey, JSON.stringify(migrated));
  localStorage.setItem(storageVersionKey, currentStorageVersion);
}
