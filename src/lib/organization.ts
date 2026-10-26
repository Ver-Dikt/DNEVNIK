import type { DiaryEntry, ProjectNode, Space } from "./types";

const key = (value: string) => value.trim().toLocaleLowerCase("ru-RU");
export function projectPathFor(project: ProjectNode, projects: ProjectNode[]): string[] {
  const path: string[] = [];
  const seen = new Set<string>();
  let node: ProjectNode | undefined = project;
  while (node) {
    if (seen.has(node.id)) throw new Error("Обнаружен цикл вложенных проектов");
    seen.add(node.id); path.unshift(node.name);
    node = node.parentId ? projects.find(item => item.id === node!.parentId) : undefined;
  }
  return [project.area, ...path].filter(Boolean) as string[];
}

export function ensureProjectPath(path: string[], projects: ProjectNode[], spaces: Space[], now = new Date().toISOString()) {
  const clean = path.map(part => part.trim()).filter(Boolean);
  if (clean.length > 9 || clean.some(part => part.length > 100)) throw new Error("Проект: максимум 8 уровней, название до 100 символов");
  const area = clean[0] || "Личное";
  const spaceId = spaces.find(space => key(space.name) === key(area))?.id;
  let parentId: string | undefined;
  let leaf: ProjectNode | undefined;
  const next = [...projects];
  for (const name of clean.slice(1)) {
    leaf = next.find(node => key(node.name) === key(name) && key(node.area ?? "") === key(area) && node.parentId === parentId);
    if (!leaf) {
      leaf = { id: crypto.randomUUID(), name, area, spaceId, parentId, status: "active", revision: 1, createdAt: now, updatedAt: now };
      next.push(leaf);
    }
    parentId = leaf.id;
  }
  return { projects: next, patch: { area, spaceId, projectId: leaf?.id, project: leaf?.name, projectPath: clean.length ? clean : [area] } satisfies Partial<DiaryEntry> };
}

/** Materialize only existing paths. Never guess categories, deadlines or ownership. */
export function organizeEntries(entries: DiaryEntry[], projects: ProjectNode[], spaces: Space[], now = new Date().toISOString()) {
  let nextProjects = [...projects];
  let changed = 0;
  const nextEntries = entries.map(entry => {
    const project = nextProjects.find(item => item.id === entry.projectId);
    const path = entry.projectPath?.length ? entry.projectPath : project ? projectPathFor(project, nextProjects) : [entry.area ?? "Личное", entry.project].filter(Boolean) as string[];
    const result = ensureProjectPath(path, nextProjects, spaces, now);
    nextProjects = result.projects;
    const differs = Object.entries(result.patch).some(([field, value]) => JSON.stringify(entry[field as keyof DiaryEntry]) !== JSON.stringify(value));
    if (!differs) return entry;
    changed++;
    return { ...entry, ...result.patch, updatedAt: now, revision: (entry.revision ?? 1) + 1 };
  });
  return { entries: nextEntries, projects: nextProjects, changed, addedProjects: nextProjects.length - projects.length };
}

export function normalizeKindPatch(entry: DiaryEntry, patch: Partial<DiaryEntry>): Partial<DiaryEntry> {
  const next = { ...patch };
  if (patch.area && patch.area !== entry.area) next.domain = patch.area === "Работа" ? "work" : patch.area === "Дом" ? "home" : patch.area === "Музыка" ? "music" : "general";
  if (patch.kind && patch.kind !== entry.kind) {
    const complete = ["done", "bought"].includes(entry.status);
    next.status = patch.kind === "purchase" || patch.kind === "wish" ? (complete ? "bought" : "want_to_buy") : complete ? "done" : "active";
    if (patch.kind === "purchase") next.purchase = { ...entry.purchase, status: complete ? "purchased" : "planned", currency: entry.currency ?? "RUB" };
    if (patch.kind === "wish") next.wish = { ...entry.wish, status: complete ? "purchased" : "saved", currency: entry.currency ?? "RUB" };
  }
  return next;
}
