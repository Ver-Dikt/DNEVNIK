import type { CalendarEvent, DiaryEntry, ProjectNode, Space } from "./types";
import { ensureProjectPath, normalizeKindPatch, organizeEntries } from "./organization";
import { validateLocalProposal } from "./local-assistant";

export type AssistantAction = { type: "update"; id: string; revision: number; title: string; patch: Partial<DiaryEntry> } | { type: "delete"; id: string; revision: number; title: string } | { type: "create"; entry: DiaryEntry; sourceId?: string; sourceRevision?: number } | { type: "project"; path: string[] } | { type: "space"; name: string } | { type: "event_create"; event: CalendarEvent } | { type: "event_update"; id: string; revision: number; title: string; patch: Partial<CalendarEvent> };
export type AssistantPlan = { answer: string; actions: AssistantAction[]; sync: boolean };
export function validateAssistantPlan(value: unknown, entries: DiaryEntry[], original: string, events: CalendarEvent[] = []): AssistantPlan {
  if (!value || typeof value !== "object") throw new Error("Модель не вернула план действий");
  const row = value as Record<string, unknown>;
  if (!Array.isArray(row.actions) || row.actions.length > 50) throw new Error("В одной команде допускается до 50 изменений");
  const seen = new Set<string>();
  const actions: AssistantAction[] = row.actions.map(item => {
    if (!item || typeof item !== "object") throw new Error("Некорректное действие");
    const action = item as Record<string, unknown>;
    if (action.type === "event_create" || action.type === "event_update") {
      const existing = action.type === "event_update" ? events.find(event => event.id === action.id) : undefined;
      if (action.type === "event_update" && (!existing || seen.has(`event:${existing.id}`))) throw new Error("Событие не найдено или повторяется в плане");
      if (existing) seen.add(`event:${existing.id}`);
      if (!action.patch || typeof action.patch !== "object") throw new Error("Нет данных события");
      const source = action.patch as Record<string, unknown>;
      const patch: Partial<CalendarEvent> = {};
      for (const field of ["title", "notes"] as const) if (source[field] !== undefined) {
        if (typeof source[field] !== "string" || (field === "title" && !source[field].trim())) throw new Error("Некорректное название или заметка события");
        patch[field] = source[field].slice(0, field === "title" ? 200 : 12000);
      }
      for (const field of ["startDate", "endDate"] as const) if (source[field] !== undefined) {
        const date = source[field];
        if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date) throw new Error("Некорректная дата события");
        patch[field] = date;
      }
      for (const field of ["startTime", "endTime"] as const) if (source[field] !== undefined) {
        if (typeof source[field] !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(source[field])) throw new Error("Некорректное время события");
        patch[field] = source[field];
      }
      if (source.allDay !== undefined) { if (typeof source.allDay !== "boolean") throw new Error("Некорректный признак события на весь день"); patch.allDay = source.allDay; }
      else if (patch.startTime || patch.endTime) patch.allDay = false;
      if (source.visibility !== undefined) { if (source.visibility !== "private" && source.visibility !== "shared") throw new Error("Некорректная видимость события"); patch.visibility = source.visibility; }
      const start = patch.startDate ?? existing?.startDate; const end = patch.endDate ?? existing?.endDate;
      if (end && start && end < start) throw new Error("Конец события раньше начала");
      if (patch.allDay === true && (patch.startTime || patch.endTime)) throw new Error("Событие на весь день не должно содержать время");
      const startTime = patch.startTime ?? existing?.startTime; const endTime = patch.endTime ?? existing?.endTime;
      if (startTime && endTime && (!end || end === start) && endTime < startTime) throw new Error("Время окончания раньше начала события");
      if (!Object.keys(patch).length) throw new Error("Нет изменений события");
      if (existing) return { type: "event_update", id: existing.id, revision: existing.revision ?? 1, title: existing.title, patch };
      if (!patch.title || !patch.startDate) throw new Error("Укажите название и дату события");
      const now = new Date().toISOString();
      return { type: "event_create", event: { ...patch, id:crypto.randomUUID(), title:patch.title, startDate:patch.startDate, allDay:patch.allDay ?? !patch.startTime, createdBy:"me", updatedBy:"me", visibility:patch.visibility ?? "private", createdAt:now, updatedAt:now, revision:1 } };
    }
    if (action.type === "space") {
      if (typeof action.name !== "string" || !action.name.trim() || action.name.length > 100) throw new Error("Укажите название раздела");
      return { type: "space", name: action.name.trim() };
    }
    if (action.type === "project") {
      if (!Array.isArray(action.path) || action.path.length < 2 || action.path.length > 9 || action.path.some(part => typeof part !== "string" || !part.trim() || part.length > 100)) throw new Error("Укажите раздел и путь нового проекта");
      return { type: "project", path: action.path.map(part => part.trim()) };
    }
    if (action.type === "create") {
      let source = action.sourceEntryId == null ? undefined : entries.find(entry => entry.id === action.sourceEntryId);
      if (action.sourceEntryId != null && !source) throw new Error("Исходная запись не найдена");
      if (!source && action.sourceEntryId == null && /разбер|раздел|извлек/iu.test(original) && /запис|голос/iu.test(original)) {
        const patch = action.patch && typeof action.patch === "object" ? action.patch as Record<string, unknown> : {};
        const candidate = typeof patch.sourceText === "string" && patch.sourceText.trim() ? patch.sourceText.trim() : typeof patch.title === "string" ? patch.title.trim() : "";
        const matching = candidate.length >= 4 ? entries.filter(entry => (entry.originalInput ?? entry.sourceText ?? entry.description ?? "").toLocaleLowerCase("ru-RU").includes(candidate.toLocaleLowerCase("ru-RU"))) : [];
        if (matching.length !== 1) throw new Error("Не удалось однозначно определить исходную запись для разбора");
        source = matching[0];
      }
      const sourceText = source ? source.originalInput ?? source.sourceText ?? source.description ?? "" : original;
      const item = action.patch && typeof action.patch === "object" ? {...action.patch as Record<string, unknown>} : {};
      if (source && item.sourceText === undefined && typeof item.title === "string" && item.title.trim().length >= 4) {
        const index = sourceText.toLocaleLowerCase("ru-RU").indexOf(item.title.trim().toLocaleLowerCase("ru-RU"));
        if (index >= 0) item.sourceText = sourceText.slice(index, index + item.title.trim().length);
      }
      const excerpt = item.sourceText;
      if (source && (typeof excerpt !== "string" || !excerpt.trim() || !sourceText.includes(excerpt))) throw new Error("Фрагмент не найден в исходной записи");
      const parsed = validateLocalProposal({ items: [item] }, sourceText).items[0];
      const now = new Date().toISOString();
      return { type: "create", entry: { ...parsed, ...(source ? {dueDate:undefined,schedule:"none" as const,needsReview:true} : {}), id: crypto.randomUUID(), createdAt: now, updatedAt: now, revision: 1 }, ...(source ? {sourceId:source.id,sourceRevision:source.revision ?? 1} : {}) };
    }
    if ((action.type !== "update" && action.type !== "delete") || typeof action.id !== "string") throw new Error("Команда не поддерживается");
    const entry = entries.find(entry => entry.id === action.id);
    if (!entry || seen.has(entry.id)) throw new Error("Запись не найдена или повторяется в плане");
    seen.add(entry.id);
    if (action.type === "delete") {
      if (!/(удал|убери|стереть|сотри)/iu.test(original)) throw new Error("Для удаления нужна прямая просьба пользователя");
      return { type: "delete", id: entry.id, revision: entry.revision ?? 1, title: entry.title };
    }
    if (!action.patch || typeof action.patch !== "object") throw new Error("Нет изменений записи");
    const source = action.patch as Record<string, unknown>;
    const patch: Partial<DiaryEntry> = {};
    for (const field of ["title", "description", "notes", "area"] as const) {
      if (source[field] !== undefined) {
        if (typeof source[field] !== "string" || (field !== "notes" && !source[field].trim())) throw new Error("Пустое или некорректное поле записи");
        patch[field] = source[field].slice(0, field === "title" || field === "area" ? 200 : 12000);
      }
    }
    for (const [field, choices] of Object.entries({ kind: ["task", "purchase", "wish", "idea", "note", "inbox"], status: ["active", "done", "waiting", "want_to_buy", "researching", "selected", "ordered", "bought", "cancelled"], priority: ["low", "normal", "high"], assignedTo: ["me", "partner", "shared"] })) {
      if (source[field] !== undefined) {
        if (typeof source[field] !== "string" || !choices.includes(source[field])) throw new Error(`Некорректное поле ${field}`);
        Object.assign(patch, { [field]: source[field] });
      }
    }
    if (source.dueDate !== undefined) {
      const date = source.dueDate;
      if (date !== null && (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) throw new Error("Некорректная дата");
      patch.dueDate = date === null ? undefined : date as string; patch.schedule = "none";
    }
    if (source.projectPath !== undefined) {
      if (!Array.isArray(source.projectPath) || !source.projectPath.length || source.projectPath.length > 9 || source.projectPath.some(part => typeof part !== "string" || !part.trim() || part.length > 100)) throw new Error("Некорректный путь проекта");
      patch.projectPath = source.projectPath.map(part => part.trim()); patch.area = patch.projectPath[0];
    } else if (patch.area && patch.area !== entry.area) patch.projectPath = [patch.area];
    if (patch.assignedTo) patch.visibility = patch.assignedTo === "shared" ? "shared" : "private";
    const numberFields = ["quantity", "unitPrice", "totalPrice"] as const;
    for (const field of numberFields) {
      if (source[field] !== undefined) {
        if (typeof source[field] !== "number" || !Number.isFinite(source[field]) || source[field] < 0 || source[field] > 1000000000) throw new Error("Некорректное количество или цена");
        patch[field] = source[field];
      }
    }
    if (source.currency !== undefined) {
      if (typeof source.currency !== "string" || !/^[A-Z]{3}$/.test(source.currency)) throw new Error("Некорректная валюта");
      patch.currency = source.currency;
    }
    const normalized = normalizeKindPatch(entry, patch);
    if ((normalized.kind ?? entry.kind) === "purchase" && numberFields.some(field => source[field] !== undefined) || (normalized.kind ?? entry.kind) === "purchase" && source.currency !== undefined) {
      const quantity = patch.quantity ?? entry.purchase?.quantity ?? entry.quantity;
      const unitPrice = patch.unitPrice ?? entry.purchase?.unitPrice ?? entry.unitPrice;
      if (source.totalPrice === undefined && (source.quantity !== undefined || source.unitPrice !== undefined) && quantity !== undefined && unitPrice !== undefined) normalized.totalPrice = quantity * unitPrice;
      normalized.purchase = { ...entry.purchase, ...normalized.purchase, status: normalized.purchase?.status ?? entry.purchase?.status ?? "planned", ...(patch.quantity !== undefined ? {quantity:patch.quantity} : {}), ...(patch.unitPrice !== undefined ? {unitPrice:patch.unitPrice} : {}), ...(normalized.totalPrice !== undefined ? {totalPrice:normalized.totalPrice} : {}), ...(patch.currency ? {currency:patch.currency} : {}) };
    }
    if (source.status !== undefined) normalized.status = patch.status;
    if (normalized.status) {
      const kind = normalized.kind ?? entry.kind;
      const done = normalized.status === "done" || normalized.status === "bought";
      normalized.completedAt = done ? new Date().toISOString() : undefined;
      if (kind === "purchase") normalized.purchase = { ...entry.purchase, ...normalized.purchase, status: done ? "purchased" : normalized.status === "ordered" ? "ordered" : "planned" };
      if (kind === "wish") normalized.wish = { ...entry.wish, ...normalized.wish, status: done ? "purchased" : "saved" };
    }
    if (!Object.keys(normalized).length) throw new Error("Нет поддерживаемых изменений");
    return { type: "update", id: entry.id, revision: entry.revision ?? 1, title: entry.title, patch: normalized };
  });
  return { answer: typeof row.answer === "string" ? row.answer.slice(0, 4000) : "Проверьте изменения перед применением", actions, sync: row.sync === true };
}

export function applyAssistantPlan(plan: AssistantPlan, entries: DiaryEntry[], projects: ProjectNode[], spaces: Space[], events: CalendarEvent[] = []) {
  for (const action of plan.actions) if (action.type === "create" && action.sourceId) {
    const source = entries.find(entry => entry.id === action.sourceId);
    if (!source || (source.revision ?? 1) !== action.sourceRevision) throw new Error("Исходная запись изменилась после составления плана. Повторите разбор");
  }
  const now = new Date().toISOString();
  let next = [...entries];
  let nextProjects = [...projects];
  const nextSpaces = [...spaces];
  let nextEvents = [...events];
  for (const action of plan.actions) {
    if (action.type === "event_create") { if (nextEvents.some(event => event.id === action.event.id)) throw new Error("Этот план уже применён"); nextEvents.unshift(action.event); continue; }
    if (action.type === "event_update") { const event = nextEvents.find(item => item.id === action.id); if (!event || (event.revision ?? 1) !== action.revision) throw new Error("Событие изменилось после составления плана"); nextEvents = nextEvents.map(item => item.id === action.id ? {...item,...action.patch,updatedAt:now,revision:(item.revision ?? 1)+1,updatedBy:"me"} : item); continue; }
    if (action.type === "space") { if (nextSpaces.some(space => space.name.trim().toLocaleLowerCase("ru-RU") === action.name.toLocaleLowerCase("ru-RU"))) throw new Error("Такой раздел уже существует"); nextSpaces.push({id:crypto.randomUUID(), name:action.name, createdAt:now, updatedAt:now, revision:1}); continue; }
    if (action.type === "project") { nextProjects = ensureProjectPath(action.path, nextProjects, nextSpaces, now).projects; continue; }
    if (action.type === "create") {
      if (next.some(entry => entry.id === action.entry.id)) throw new Error("Этот план уже применён");
      next.unshift(action.entry);
    } else {
      const entry = next.find(item => item.id === action.id);
      if (!entry || (entry.revision ?? 1) !== action.revision) throw new Error("Запись изменилась после составления плана. Повторите команду");
      if (action.type === "delete") next = next.filter(item => item.id !== action.id);
      else next = next.map(item => item.id === action.id ? { ...item, ...action.patch, updatedAt: now, revision: (item.revision ?? 1) + 1, updatedBy: "me" } : item);
    }
  }
  // Resolve project ids only for the edited records; other records remain untouched.
  next = next.map(entry => {
    if (!plan.actions.some(action => action.type === "update" ? action.id === entry.id : action.type === "create" && action.entry.id === entry.id)) return entry;
    const result = organizeEntries([entry], nextProjects, nextSpaces, now);
    nextProjects = result.projects;
    return result.entries[0];
  });
  return { entries: next, projects: nextProjects, spaces: nextSpaces, calendarEvents: nextEvents };
}

export function moveEntryToPath(entry: DiaryEntry, path: string[], projects: ProjectNode[], spaces: Space[]) {
  return ensureProjectPath(path, projects, spaces);
}
