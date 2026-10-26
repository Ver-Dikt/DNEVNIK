"use client";
import { useMemo, useState } from "react";
import { Button, Field, Input, Select, Surface } from "@/components/ui/native";
import { EntryCard } from "./EntryCard";
import { kindLabels } from "@/features/shared/entry-utils";
import { projectPathFor } from "@/lib/organization";
import type { DiaryEntry, Member, ProjectNode, Space } from "@/lib/types";

export function RecordsView({ entries, projects, spaces, members, onOpen, onComplete, onAdd, onCreateProject, onOrganize }: { entries: DiaryEntry[]; projects: ProjectNode[]; spaces: Space[]; members: Member[]; onOpen: (entry: DiaryEntry) => void; onComplete: (entry: DiaryEntry) => void; onAdd: () => void; onCreateProject: (path: string[]) => void; onOrganize: () => Promise<void> }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [path, setPath] = useState("");
  const [sort, setSort] = useState("updated");
  const [newPath, setNewPath] = useState("");
  const [message, setMessage] = useState("");
  const paths = useMemo(() => [...new Set([...entries.map(entry => (entry.projectPath?.length ? entry.projectPath : [entry.area ?? "Личное"]).join(" / ")), ...projects.map(project => { try { return projectPathFor(project, projects).join(" / "); } catch { return `${project.area ?? "Личное"} / ${project.name}`; } })])].filter(Boolean).sort((a,b) => a.localeCompare(b, "ru")), [entries, projects]);
  const filtered = entries.filter(entry => {
    const ownPath = (entry.projectPath?.length ? entry.projectPath : [entry.area ?? "Личное"]).join(" / ");
    return (filter === "all" || (filter === "review" ? entry.needsReview || entry.kind === "inbox" : entry.kind === filter)) && (!path || ownPath === path || ownPath.startsWith(path + " / ")) && `${entry.title} ${entry.description ?? ""} ${ownPath}`.toLocaleLowerCase("ru").includes(query.toLocaleLowerCase("ru"));
  }).sort((a,b) => sort === "title" ? a.title.localeCompare(b.title, "ru") : sort === "date" ? (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") : sort === "priority" ? Number(b.priority === "high") - Number(a.priority === "high") : b.updatedAt.localeCompare(a.updatedAt));
  return <div className="grid gap-4">
    <div className="screen-header"><div><p className="screen-eyebrow">Ничего не теряется</p><h1 className="screen-title">Записи и проекты</h1></div><Button variant="primary" onClick={onAdd}>Добавить</Button></div>
    <Surface className="p-4 grid gap-3">
      <Field label="Поиск по записям"><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Название, описание или проект" /></Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Показывать"><Select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">Все записи ({entries.length})</option><option value="review">На проверку</option>{Object.entries(kindLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
        <Field label="Раздел или проект"><Select value={path} onChange={event => setPath(event.target.value)}><option value="">Все проекты</option>{[...new Set([...entries.map(entry => entry.area ?? "Личное"), ...paths])].sort((a,b) => a.localeCompare(b,"ru")).map(item => <option key={item}>{item}</option>)}</Select></Field>
        <Field label="Сортировка"><Select value={sort} onChange={event => setSort(event.target.value)}><option value="updated">Сначала изменённые</option><option value="date">По дате</option><option value="title">По названию</option><option value="priority">Сначала срочные</option></Select></Field>
      </div>
      <details><summary className="cursor-pointer py-3 font-bold">Управление проектами</summary><div className="grid gap-3 pt-3"><p className="text-sm text-[var(--muted)]">Вложенность задаётся через /: Дом / Ремонт / Кухня. Выбор проекта выше включает его подпроекты.</p><Field label="Путь нового проекта"><Input value={newPath} onChange={event => setNewPath(event.target.value)} placeholder="Дом / Ремонт / Кухня" /></Field><Button onClick={() => { try { const parts = newPath.split("/").map(part => part.trim()).filter(Boolean); if(parts.length < 2) throw new Error("Укажите раздел и название проекта"); onCreateProject(parts); setNewPath(""); setMessage("Проект создан"); } catch(error) { setMessage(error instanceof Error ? error.message : "Не удалось создать проект"); } }}>Создать проект</Button><Button onClick={async () => { try { await onOrganize(); setMessage("Иерархия проектов проверена и восстановлена"); } catch(error) { setMessage(error instanceof Error ? error.message : "Не удалось упорядочить проекты"); } }}>Упорядочить существующие проекты</Button></div></details>
      <p role="status" className="text-sm text-[var(--muted)]">{message || `Найдено: ${filtered.length}`}</p>
    </Surface>
    {filtered.map(entry => <EntryCard key={entry.id} entry={entry} members={members} spaces={spaces} onOpen={() => onOpen(entry)} onComplete={() => onComplete(entry)} />)}
    {!filtered.length ? <Surface className="p-5 text-[var(--muted)]">Нет записей по выбранным условиям.</Surface> : null}
  </div>;
}
