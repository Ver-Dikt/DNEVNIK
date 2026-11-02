import type { DiaryEntry } from "./types";

export function categoryPath(entry: DiaryEntry): string[] {
  return entry.projectPath?.length ? entry.projectPath : entry.area ? [entry.area] : [];
}

export function categoryChoices(entries: DiaryEntry[]) {
  const paths = new Map<string, string[]>();
  for (const entry of entries) {
    const path = categoryPath(entry);
    for (let n = 1; n <= path.length; n++) {
      const prefix = path.slice(0, n);
      paths.set(JSON.stringify(prefix), prefix);
    }
  }
  return [...paths.entries()].map(([value,path]) => ({value,label:path.join(" / ")})).sort((a,b)=>a.label.localeCompare(b.label,"ru"));
}

export function inCategory(entry: DiaryEntry, selected: string): boolean {
  if (!selected) return true;
  try {
    const wanted: unknown = JSON.parse(selected);
    if (!Array.isArray(wanted) || !wanted.every(part => typeof part === "string")) return false;
    const path = categoryPath(entry);
    return wanted.every((part,index) => path[index] === part);
  } catch { return false; }
}
