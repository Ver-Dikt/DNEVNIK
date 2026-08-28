"use client";

import { Archive, Plus } from "lucide-react";
import { useState } from "react";
import { Button, Input, Segmented, Surface } from "@/components/ui/native";
import { EntryCard } from "@/features/entries/EntryCard";
import type { DiaryEntry, ProjectNode, Space } from "@/lib/types";

export function SpacesView({
  entries,
  projects,
  spaces,
  selectedProjectId,
  selectedSpaceId,
  onCreateProject,
  onCreateSpace,
  onComplete,
  onOpenEntry,
  onSelectProject,
  onSelectSpace
}: {
  entries: DiaryEntry[];
  projects: ProjectNode[];
  spaces: Space[];
  selectedProjectId?: string;
  selectedSpaceId?: string;
  onCreateProject: (name: string, spaceId?: string) => ProjectNode;
  onCreateSpace: (name: string) => Space;
  onComplete: (entry: DiaryEntry) => void;
  onOpenEntry: (entry: DiaryEntry) => void;
  onSelectProject: (id?: string) => void;
  onSelectSpace: (id?: string) => void;
}) {
  const [newSpace, setNewSpace] = useState("");
  const [newProject, setNewProject] = useState("");
  const [filter, setFilter] = useState<"all" | "task" | "idea" | "purchase" | "note">("all");
  const selectedSpace = spaces.find((space) => space.id === selectedSpaceId);
  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const projectEntries = selectedProject ? entries.filter((entry) => entry.projectId === selectedProject.id || entry.project === selectedProject.name) : [];
  const spaceEntries = selectedSpace ? entries.filter((entry) => entry.spaceId === selectedSpace.id || entry.area === selectedSpace.name) : [];
  const visibleProjects = selectedSpace ? projects.filter((project) => project.spaceId === selectedSpace.id || project.area === selectedSpace.name) : projects;

  if (selectedProject) {
    const tabs = [
      { label: "Записи", value: "all" },
      { label: "Дела", value: "task" },
      { label: "Идеи", value: "idea" },
      { label: "Покупки", value: "purchase" },
      { label: "Заметки", value: "note" }
    ] as const;
    const filtered = filter === "all" ? projectEntries : projectEntries.filter((entry) => entry.kind === filter);
    const done = projectEntries.filter((entry) => entry.status === "done" || entry.status === "bought").length;
    return (
      <div className="grid gap-4">
        <Button className="w-fit px-4" onClick={() => onSelectProject(undefined)}>Назад</Button>
        <Surface className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-black">{selectedProject.name}</h1>
              <p className="mt-1 text-sm text-[var(--muted)]">{projectEntries.length} записей · {done} готово</p>
            </div>
            <Archive size={24} />
          </div>
          <div className="mt-4"><Segmented options={tabs.filter((tab) => tab.value === "all" || projectEntries.some((entry) => entry.kind === tab.value))} value={filter} onChange={setFilter} /></div>
        </Surface>
        {filtered.length ? filtered.map((entry) => <EntryCard entry={entry} key={entry.id} spaces={spaces} onComplete={() => onComplete(entry)} onOpen={() => onOpenEntry(entry)} />) : <Empty text="В этом проекте пока пусто." />}
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div>
        <p className="text-sm font-bold text-[var(--muted)]">Структура</p>
        <h1 className="text-3xl font-black">Проекты</h1>
      </div>
      <Surface className="grid gap-3 p-3">
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Input placeholder="Новое пространство" value={newSpace} onChange={(event) => setNewSpace(event.target.value)} />
          <Button className="px-4 font-bold" onClick={() => { const name = newSpace.trim(); if (!name) return; onCreateSpace(name); setNewSpace(""); }}><Plus size={17} /></Button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Button className={`shrink-0 px-4 ${!selectedSpaceId ? "bg-[#16191f] text-white" : ""}`} onClick={() => onSelectSpace(undefined)}>Записи</Button>
          {spaces.map((space) => (
            <Button className={`shrink-0 px-4 ${selectedSpaceId === space.id ? "bg-[#16191f] text-white" : ""}`} key={space.id} onClick={() => onSelectSpace(space.id)}>{space.name}</Button>
          ))}
        </div>
      </Surface>

      <Surface className="grid gap-3 p-3">
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Input placeholder={selectedSpace ? `Новый проект в ${selectedSpace.name}` : "Новый проект"} value={newProject} onChange={(event) => setNewProject(event.target.value)} />
          <Button className="px-4 font-bold" onClick={() => { const name = newProject.trim(); if (!name) return; onCreateProject(name, selectedSpaceId); setNewProject(""); }}><Plus size={17} /></Button>
        </div>
      </Surface>

      <div className="grid gap-3 sm:grid-cols-2">
        {visibleProjects.map((project) => {
          const linked = entries.filter((entry) => entry.projectId === project.id || entry.project === project.name);
          return (
            <button className="text-left" key={project.id} onClick={() => onSelectProject(project.id)} type="button">
              <Surface className="h-full p-4">
                <div className="text-xl font-black">{project.name}</div>
                <div className="mt-1 text-sm text-[var(--muted)]">{spaces.find((space) => space.id === project.spaceId)?.name ?? project.area ?? "Без пространства"}</div>
                <div className="mt-4 text-sm font-bold text-[var(--muted)]">{linked.length} записей</div>
              </Surface>
            </button>
          );
        })}
      </div>
      {selectedSpace && !visibleProjects.length ? (
        <div className="grid gap-2">
          <h2 className="px-1 text-base font-black">Без проекта</h2>
          {spaceEntries.filter((entry) => !entry.project && !entry.projectId).map((entry) => <EntryCard entry={entry} key={entry.id} spaces={spaces} onComplete={() => onComplete(entry)} onOpen={() => onOpenEntry(entry)} />)}
        </div>
      ) : null}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <Surface className="p-6 text-center text-sm text-[var(--muted)]">{text}</Surface>;
}
