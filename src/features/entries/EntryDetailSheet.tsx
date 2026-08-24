"use client";

import { Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Button, Field, Input, Segmented, Select, Surface, Textarea } from "@/components/ui/native";
import type { AssignedTo, DiaryEntry, EntryKind, ProjectNode, PurchaseStatus, RepeatRule, Space, WishStatus } from "@/lib/types";
import { purchaseStatus, purchaseStatusToEntryStatus, wishStatus } from "@/features/shared/entry-utils";

export function EntryDetailSheet({
  entry,
  projects,
  spaces,
  onChange,
  onCreateProject,
  onCreateSpace,
  onClose,
  onDelete,
  onRemember
}: {
  entry: DiaryEntry;
  projects: ProjectNode[];
  spaces: Space[];
  onChange: (patch: Partial<DiaryEntry>) => void;
  onCreateProject: (name: string, spaceId?: string) => ProjectNode;
  onCreateSpace: (name: string) => Space;
  onClose: () => void;
  onDelete: () => void;
  onRemember: () => void;
}) {
  const [newSpace, setNewSpace] = useState("");
  const [newProject, setNewProject] = useState("");
  const [checkText, setCheckText] = useState("");
  const currentPurchaseStatus = purchaseStatus(entry);
  const currentWishStatus = wishStatus(entry);
  const visibleProjects = projects.filter((project) => !entry.spaceId || project.spaceId === entry.spaceId || project.area === entry.area);

  return (
    <div className="fixed inset-0 z-[75] flex items-end justify-center bg-black/30 px-3 pb-[calc(10px+env(safe-area-inset-bottom))] backdrop-blur-sm" onClick={onClose}>
      <Surface className="max-h-[92vh] w-full max-w-2xl overflow-auto p-4" onClick={(event) => event.stopPropagation()}>
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-black/15" />
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-2xl font-black">Запись</h2>
          <button className="grid h-10 w-10 place-items-center rounded-full bg-black/[.05]" onClick={onClose} type="button" aria-label="Закрыть"><X size={19} /></button>
        </div>

        <div className="grid gap-3">
          <Field label="Название">
            <Input value={entry.title} onChange={(event) => onChange({ title: event.target.value })} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Тип">
              <Select value={entry.kind} onChange={(event) => onChange({ kind: event.target.value as EntryKind })}>
                <option value="task">Дело</option>
                <option value="purchase">Покупка</option>
                <option value="wish">Хотелка</option>
                <option value="idea">Идея</option>
                <option value="note">Заметка</option>
              </Select>
            </Field>
            <Field label="Кому">
              <Select value={entry.assignedTo ?? "me"} onChange={(event) => onChange({ assignedTo: event.target.value as AssignedTo, visibility: event.target.value === "shared" ? "shared" : "private" })}>
                <option value="me">Моё</option>
                <option value="partner">Партнёр</option>
                <option value="shared">Общее</option>
              </Select>
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Пространство">
              <Select value={entry.spaceId ?? ""} onChange={(event) => {
                const space = spaces.find((item) => item.id === event.target.value);
                onChange({ spaceId: space?.id, area: space?.name, projectId: undefined, project: undefined, projectPath: space ? [space.name] : [] });
              }}>
                <option value="">Без пространства</option>
                {spaces.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}
              </Select>
            </Field>
            <Field label="Проект">
              <Select value={entry.projectId ?? ""} onChange={(event) => {
                const project = projects.find((item) => item.id === event.target.value);
                onChange({ projectId: project?.id, project: project?.name, projectPath: [entry.area, project?.name].filter(Boolean) as string[] });
              }}>
                <option value="">Без проекта</option>
                {visibleProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </Select>
            </Field>
          </div>

          <div className="grid gap-2 rounded-3xl bg-black/[.035] p-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <Input placeholder="Новое пространство" value={newSpace} onChange={(event) => setNewSpace(event.target.value)} />
              <Button className="px-4 font-bold" onClick={() => {
                const name = newSpace.trim();
                if (!name) return;
                const space = onCreateSpace(name);
                onChange({ spaceId: space.id, area: space.name, projectPath: [space.name] });
                setNewSpace("");
              }}>Создать</Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <Input placeholder="Новый проект" value={newProject} onChange={(event) => setNewProject(event.target.value)} />
              <Button className="px-4 font-bold" onClick={() => {
                const name = newProject.trim();
                if (!name) return;
                const project = onCreateProject(name, entry.spaceId);
                onChange({ projectId: project.id, project: project.name, projectPath: [entry.area, project.name].filter(Boolean) as string[] });
                setNewProject("");
              }}>Создать</Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Дата"><Input type="date" value={entry.dueDate ?? ""} onChange={(event) => onChange({ dueDate: event.target.value || undefined, schedule: event.target.value ? "today" : "none" })} /></Field>
            <Field label="Время"><Input type="time" value={entry.time ?? ""} onChange={(event) => onChange({ time: event.target.value || undefined })} /></Field>
            <Field label="Повтор">
              <Select value={entry.repeat ?? "none"} onChange={(event) => onChange({ repeat: event.target.value as RepeatRule })}>
                <option value="none">Нет</option>
                <option value="daily">Каждый день</option>
                <option value="weekly">Каждую неделю</option>
                <option value="weekly_monday">По понедельникам</option>
                <option value="monthly">Каждый месяц</option>
                <option value="monthly_first">Первого числа</option>
              </Select>
            </Field>
            <Field label="Срок">
              <Select value={entry.schedule} onChange={(event) => onChange({ schedule: event.target.value as DiaryEntry["schedule"] })}>
                <option value="none">Без даты</option>
                <option value="today">Сегодня</option>
                <option value="tomorrow">Завтра</option>
                <option value="this_week">Эта неделя</option>
                <option value="next_week">Следующая</option>
                <option value="this_month">Этот месяц</option>
                <option value="someday">Когда-нибудь</option>
              </Select>
            </Field>
          </div>

          {entry.kind === "purchase" ? (
            <div className="grid gap-3 rounded-3xl bg-[#f6faf8] p-3">
              <Segmented
                value={currentPurchaseStatus}
                onChange={(status: PurchaseStatus) => onChange({ purchase: { status, ...entry.purchase }, status: purchaseStatusToEntryStatus(status) })}
                options={[
                  { label: "Нужно", value: "planned" },
                  { label: "Выбрано", value: "selected" },
                  { label: "Заказано", value: "ordered" },
                  { label: "Куплено", value: "purchased" }
                ]}
              />
              <MoneyFields entry={entry} onChange={onChange} mode="purchase" />
            </div>
          ) : null}

          {entry.kind === "wish" ? (
            <div className="grid gap-3 rounded-3xl bg-[#faf7ff] p-3">
              <Segmented
                value={currentWishStatus}
                onChange={(status: WishStatus) => onChange({ wish: { status, ...entry.wish } })}
                options={[
                  { label: "Сохранено", value: "saved" },
                  { label: "Думаем", value: "considering" },
                  { label: "В план", value: "planned" },
                  { label: "Куплено", value: "purchased" }
                ]}
              />
              <MoneyFields entry={entry} onChange={onChange} mode="wish" />
            </div>
          ) : null}

          <Field label="Ссылка"><Input value={entry.url ?? ""} onChange={(event) => onChange({ url: event.target.value || undefined })} /></Field>
          <Field label="Заметки"><Textarea value={entry.description ?? ""} onChange={(event) => onChange({ description: event.target.value })} /></Field>

          <div className="grid gap-2">
            <div className="text-sm font-black">Чеклист</div>
            {(entry.checklist ?? []).map((item) => (
              <label className="flex min-h-11 items-center gap-3 rounded-2xl bg-black/[.035] px-3" key={item.id}>
                <input checked={item.done} type="checkbox" onChange={(event) => onChange({ checklist: (entry.checklist ?? []).map((check) => check.id === item.id ? { ...check, done: event.target.checked } : check) })} />
                <span className={item.done ? "text-[var(--muted)] line-through" : ""}>{item.title}</span>
              </label>
            ))}
            <div className="grid grid-cols-[1fr_48px] gap-2">
              <Input placeholder="Пункт чеклиста" value={checkText} onChange={(event) => setCheckText(event.target.value)} />
              <Button className="p-0" onClick={() => {
                const title = checkText.trim();
                if (!title) return;
                onChange({ checklist: [...(entry.checklist ?? []), { id: crypto.randomUUID(), title, done: false, createdAt: new Date().toISOString() }] });
                setCheckText("");
              }}><Plus size={18} /></Button>
            </div>
          </div>

          {entry.needsReview ? <Button className="font-bold" onClick={onRemember}>Запомнить исправление для похожих записей</Button> : null}

          <div className="flex items-center justify-between gap-2 pt-2">
            <Button className="px-4 font-bold" onClick={onDelete} variant="danger"><Trash2 size={16} />Удалить</Button>
            <Button className="px-6 font-black" onClick={onClose} variant="primary">Готово</Button>
          </div>
        </div>
      </Surface>
    </div>
  );
}

function MoneyFields({ entry, mode, onChange }: { entry: DiaryEntry; mode: "purchase" | "wish"; onChange: (patch: Partial<DiaryEntry>) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Field label="Количество">
        <Input inputMode="decimal" value={entry.purchase?.quantity ?? entry.quantity ?? ""} onChange={(event) => onChange({ quantity: numberOrUndefined(event.target.value), purchase: mode === "purchase" ? { status: entry.purchase?.status ?? "planned", ...entry.purchase, quantity: numberOrUndefined(event.target.value) } : entry.purchase })} />
      </Field>
      <Field label="Цена">
        <Input inputMode="decimal" value={entry.purchase?.unitPrice ?? entry.wish?.estimatedPrice ?? entry.unitPrice ?? ""} onChange={(event) => {
          const value = numberOrUndefined(event.target.value);
          onChange(mode === "purchase" ? { unitPrice: value, purchase: { status: entry.purchase?.status ?? "planned", ...entry.purchase, unitPrice: value, plannedPrice: value } } : { unitPrice: value, wish: { status: entry.wish?.status ?? "saved", ...entry.wish, estimatedPrice: value } });
        }} />
      </Field>
      <Field label="Магазин"><Input value={entry.store ?? entry.purchase?.store ?? entry.wish?.store ?? ""} onChange={(event) => onChange({ store: event.target.value || undefined })} /></Field>
    </div>
  );
}

function numberOrUndefined(value: string): number | undefined {
  const parsed = Number(value.replace(",", ".").trim());
  return Number.isFinite(parsed) && value.trim() ? parsed : undefined;
}
