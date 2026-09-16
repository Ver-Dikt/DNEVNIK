"use client";

import { useModalLayer } from "@/hooks/use-modal-layer";
import { Plus, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import { Button, Field, Input, Segmented, Select, Surface, Textarea } from "@/components/ui/native";
import type { AssignedTo, DiaryEntry, EntryKind, Member, ProjectNode, RepeatRule, Space, WishStatus } from "@/lib/types";
import { purchaseStatusGroup, purchaseStatusToEntryStatus, wishStatus } from "@/features/shared/entry-utils";
import { addDays } from "@/features/shared/date-utils";
import { todayIso } from "@/lib/dates";

export function EntryDetailSheet({
  entry,
  members,
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
  members: Member[];
  projects: ProjectNode[];
  spaces: Space[];
  onChange: (patch: Partial<DiaryEntry>) => void;
  onCreateProject: (name: string, spaceId?: string) => ProjectNode;
  onCreateSpace: (name: string) => Space;
  onClose: () => void;
  onDelete: () => void;
  onRemember: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useModalLayer(panelRef, onClose);
  const [newSpace, setNewSpace] = useState("");
  const [newProject, setNewProject] = useState("");
  const [checkText, setCheckText] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const currentWishStatus = wishStatus(entry);
  const isWish = entry.kind === "wish";
  const isPurchase = entry.kind === "purchase";
  const isWork = entry.area === "Работа" || entry.domain === "work";
  const showStructure = !isWish && !isPurchase && !isWork && entry.kind !== "task" && entry.kind !== "idea";
  const showCalendar = !isWish && !isPurchase && entry.kind !== "idea";
  const visibleProjects = projects.filter((project) => !entry.spaceId || project.spaceId === entry.spaceId || project.area === entry.area);

  return (
    <div ref={panelRef} className="app-overlay z-[85]" onClick={onClose}>
      <Surface role="dialog" aria-modal="true" aria-label="Редактировать запись" className="app-dialog max-w-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-black/15" />
        <div className="dialog-heading">
          <h2 className="text-2xl font-black">Запись</h2>
          <button className="grid h-10 w-10 place-items-center rounded-full bg-black/[.05]" onClick={onClose} type="button" aria-label="Закрыть"><X size={19} /></button>
        </div>

        <div className="grid gap-3">
          <Field label="Название">
            <Input value={entry.title} onChange={(event) => onChange({ title: event.target.value })} />
          </Field>
          <Field label="Описание">
            <Textarea value={entry.description ?? ""} onChange={(event) => onChange({ description: event.target.value })} placeholder="Подробности записи" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            {showStructure ? (
              <Field label="Тип">
                <Select value={entry.kind} onChange={(event) => onChange({ kind: event.target.value as EntryKind })}>
                  <option value="task">Дело</option>
                  <option value="purchase">Покупка</option>
                  <option value="wish">Хотелка</option>
                  <option value="idea">Идея</option>
                  <option value="note">Заметка</option>
                </Select>
              </Field>
            ) : null}
            <Field label="Кому">
              <Select value={entry.assignedTo ?? "me"} onChange={(event) => onChange({ assignedTo: event.target.value as AssignedTo, visibility: event.target.value === "shared" ? "shared" : "private" })}>
                <option value="me">{memberName(members, "me")}</option>
                <option value="partner">Партнёра</option>
                <option value="shared">Общее</option>
              </Select>
            </Field>
          </div>

          {showCalendar ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Дата"><Input type="date" value={entry.dueDate ?? ""} onChange={(event) => onChange({ dueDate: event.target.value || undefined, schedule: event.target.value ? "today" : "none" })} /></Field>
              <Field label="Время"><Input type="time" value={entry.time ?? ""} onChange={(event) => onChange({ time: event.target.value || undefined })} /></Field>
            </div>
          ) : null}

          {entry.kind === "purchase" ? (
            <div className="grid gap-3 rounded-3xl border border-[var(--line)] bg-[var(--surface-soft)] p-3">
              <Segmented
                className="status-segmented"
                value={purchaseStatusGroup(entry)}
                onChange={(status: "planned" | "ordered" | "purchased") => onChange({ purchase: { ...entry.purchase, status }, status: purchaseStatusToEntryStatus(status) })}
                options={[
                  { label: "Нужно", value: "planned" },
                  { label: "Заказано", value: "ordered" },
                  { label: "Куплено", value: "purchased" }
                ]}
              />
              <Segmented
                className="status-segmented"
                value={entry.priority === "high" ? "high" : "normal"}
                onChange={(priority: "high" | "normal") => onChange({ priority })}
                options={[
                  { label: "Обычное", value: "normal" },
                  { label: "Срочно", value: "high" }
                ]}
              />
              <MoneyFields entry={entry} onChange={onChange} mode="purchase" />
            </div>
          ) : null}

          {entry.kind === "wish" ? (
            <div className="grid gap-3 rounded-3xl border border-[var(--line)] bg-[var(--surface-soft)] p-3">
              <Segmented
                className="status-segmented"
                value={currentWishStatus}
                onChange={(status: WishStatus) => onChange({ status: status === "purchased" ? "done" : "active", completedAt: status === "purchased" ? new Date().toISOString() : undefined, wish: { ...entry.wish, status } })}
                options={[
                  { label: "Сохранено", value: "saved" },
                  { label: "Думаем", value: "considering" },
                  { label: "План", value: "planned" },
                  { label: "Куплено", value: "purchased" }
                ]}
              />
              <MoneyFields entry={entry} onChange={onChange} mode="wish" />
            </div>
          ) : null}

          <Button className="w-full justify-between px-4" onClick={() => setAdvancedOpen((value) => !value)}>
            Ещё
            <span>{advancedOpen ? "−" : "+"}</span>
          </Button>

          {advancedOpen && showStructure ? (
            <>
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
            </>
          ) : null}

          {advancedOpen ? <div className={`grid gap-3 ${isWish ? "sm:grid-cols-1" : "sm:grid-cols-2"}`}>
            {showCalendar ? (
              <>
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
              </>
            ) : null}
            <Field label="Срок">
              <Select value={entry.schedule} onChange={(event) => {
                const schedule = event.target.value as DiaryEntry["schedule"];
                onChange(isWish ? { schedule, dueDate: undefined, time: undefined, repeat: "none" } : { schedule, dueDate: dueDateForSchedule(schedule, entry.dueDate) });
              }}>
                {isWish ? (
                  <>
                    <option value="none">Просто мысль</option>
                    <option value="this_month">Скоро</option>
                    <option value="someday">Когда-нибудь</option>
                  </>
                ) : (
                  <>
                    <option value="none">Без даты</option>
                    <option value="today">Сегодня</option>
                    <option value="tomorrow">Завтра</option>
                    <option value="this_week">Эта неделя</option>
                    <option value="next_week">Следующая</option>
                    <option value="this_month">Этот месяц</option>
                    <option value="someday">Когда-нибудь</option>
                  </>
                )}
              </Select>
            </Field>
          </div> : null}

          {(isWish || advancedOpen) && !isPurchase ? <Field label="Ссылка"><Input autoCapitalize="none" autoCorrect="off" inputMode="url" value={entry.url ?? entry.wish?.url ?? ""} onChange={(event) => { const url = event.target.value || undefined; onChange({ url, wish: isWish ? { ...entry.wish, status: entry.wish?.status ?? "saved", url } : entry.wish }); }} /></Field> : null}

          {advancedOpen ? <div className="grid gap-2">
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
          </div> : null}

          {entry.needsReview ? <Button className="font-bold" onClick={onRemember}>Запомнить исправление для похожих записей</Button> : null}

          <div className="dialog-footer flex items-center justify-between gap-2">
            <Button className="px-4 font-bold" onClick={onDelete} variant="danger"><Trash2 size={16} />Удалить</Button>
            <Button className="px-6 font-black" onClick={onClose} variant="primary">Готово</Button>
          </div>
        </div>
      </Surface>
    </div>
  );
}

function memberName(members: Member[], id: Member["id"]) {
  return id === "me" ? "Моё" : "Партнёра";
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

function dueDateForSchedule(schedule: DiaryEntry["schedule"], current?: string): string | undefined {
  if (schedule === "today") return todayIso();
  if (schedule === "tomorrow") return addDays(todayIso(), 1);
  if (schedule === "next_week") return addDays(todayIso(), 7);
  if (schedule === "this_week" || schedule === "this_month") return current ?? todayIso();
  return undefined;
}
