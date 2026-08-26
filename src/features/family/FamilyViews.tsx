"use client";

import { Archive, CalendarDays, Camera, Check, CreditCard, FileText, Gift, Maximize2, Plus, Upload, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge, Button, Input, Segmented, Select, Surface } from "@/components/ui/native";
import { calculateSharedPlan, money } from "@/features/family/shared-plan-utils";
import type { CalendarEvent, DocumentItem, ImportantDate, LoyaltyCard, Owner, PlanTransaction, SharedPlan } from "@/lib/types";

type Setter<T> = (next: T[] | ((current: T[]) => T[])) => void;

export function SharedPlansView({ plans, transactions, defaultCurrency, onChangePlans, onChangeTransactions }: { plans: SharedPlan[]; transactions: PlanTransaction[]; defaultCurrency: string; onChangePlans: Setter<SharedPlan>; onChangeTransactions: Setter<PlanTransaction> }) {
  const [title, setTitle] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const active = plans.filter((plan) => plan.status === "active");
  const archived = plans.filter((plan) => plan.status !== "active");

  function createPlan() {
    const name = title.trim();
    if (!name) return;
    const now = new Date().toISOString();
    onChangePlans((current) => [{
      id: crypto.randomUUID(),
      title: name,
      type: "goal",
      status: "active",
      targetAmount: numberOrUndefined(targetAmount),
      currency: defaultCurrency,
      createdBy: "me",
      updatedBy: "me",
      createdAt: now,
      updatedAt: now,
      revision: 1,
      visibility: "shared"
    }, ...current]);
    setTitle("");
    setTargetAmount("");
  }

  return (
    <div className="grid gap-4">
      <Header eyebrow="Вместе" title="Общие планы" />
      <Surface className="grid gap-3 p-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_160px_auto]">
          <Input placeholder="Отпуск, ремонт, большая покупка" value={title} onChange={(event) => setTitle(event.target.value)} />
          <Input inputMode="decimal" placeholder="Цель" value={targetAmount} onChange={(event) => setTargetAmount(event.target.value)} />
          <Button className="px-4" onClick={createPlan}><Plus size={18} />Создать</Button>
        </div>
      </Surface>
      <div className="grid gap-3 lg:grid-cols-2">
        {active.map((plan) => <SharedPlanCard key={plan.id} plan={plan} plans={plans} transactions={transactions} onChangePlans={onChangePlans} onChangeTransactions={onChangeTransactions} />)}
      </div>
      {!active.length ? <Empty text="Активных общих планов пока нет." /> : null}
      {archived.length ? <section className="grid gap-2"><h2 className="px-1 text-base font-black">Архив</h2>{archived.map((plan) => <SharedPlanCard key={plan.id} plan={plan} plans={plans} transactions={transactions} compact onChangePlans={onChangePlans} onChangeTransactions={onChangeTransactions} />)}</section> : null}
    </div>
  );
}

function SharedPlanCard({ compact, plan, plans, transactions, onChangePlans, onChangeTransactions }: { compact?: boolean; plan: SharedPlan; plans: SharedPlan[]; transactions: PlanTransaction[]; onChangePlans: Setter<SharedPlan>; onChangeTransactions: Setter<PlanTransaction> }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const stats = calculateSharedPlan(plans, transactions, plan.id);
  const currency = plan.currency ?? "RUB";

  function addTransaction(type: PlanTransaction["type"]) {
    const value = numberOrUndefined(amount);
    if (!value) return;
    onChangeTransactions((current) => [{ id: crypto.randomUUID(), planId: plan.id, type, amount: value, currency, note: note.trim() || undefined, createdBy: "me", createdAt: new Date().toISOString() }, ...current]);
    setAmount("");
    setNote("");
  }

  return (
    <Surface className="grid gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black">{plan.title}</h2>
          <p className="text-sm text-[var(--muted)]">{plan.type} · {plan.visibility === "shared" ? "общее" : "личное"}</p>
        </div>
        <Badge>{plan.status === "active" ? "Активно" : plan.status === "completed" ? "Готово" : "Архив"}</Badge>
      </div>
      {!compact ? (
        <>
          <div className="h-2 overflow-hidden rounded-full bg-black/[.07]"><div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${stats.progress * 100}%` }} /></div>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <Stat label="Цель" value={money(stats.target, currency)} />
            <Stat label="Накоплено" value={money(stats.saved, currency)} />
            <Stat label="Потрачено" value={money(stats.spent, currency)} />
            <Stat label="Осталось" value={money(stats.remaining, currency)} />
          </div>
          <div className="grid gap-2 sm:grid-cols-[120px_1fr_auto_auto]">
            <Input inputMode="decimal" placeholder="Сумма" value={amount} onChange={(event) => setAmount(event.target.value)} />
            <Input placeholder="Заметка" value={note} onChange={(event) => setNote(event.target.value)} />
            <Button onClick={() => addTransaction("deposit")}>Пополнить</Button>
            <Button onClick={() => addTransaction("expense")}>Расход</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => updatePlanStatus(plan, "completed", onChangePlans)}><Check size={16} />Завершить</Button>
            <Button onClick={() => updatePlanStatus(plan, "archived", onChangePlans)}><Archive size={16} />В архив</Button>
          </div>
          {stats.transactions.slice(0, 4).map((transaction) => <div className="rounded-2xl bg-black/[.035] p-3 text-sm" key={transaction.id}><b>{transaction.type === "deposit" ? "+" : transaction.type === "expense" ? "-" : ""}{money(transaction.amount, transaction.currency)}</b> {transaction.note ? <span className="text-[var(--muted)]">· {transaction.note}</span> : null}</div>)}
        </>
      ) : null}
    </Surface>
  );
}

export function ImportantDatesView({ dates, events, onChangeDates, onChangeEvents }: { dates: ImportantDate[]; events: CalendarEvent[]; onChangeDates: Setter<ImportantDate>; onChangeEvents: Setter<CalendarEvent> }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [type, setType] = useState<ImportantDate["type"]>("birthday");
  const [eventTitle, setEventTitle] = useState("");
  const [eventStart, setEventStart] = useState("");
  const [eventEnd, setEventEnd] = useState("");

  function createDate() {
    if (!title.trim() || !date) return;
    const now = new Date().toISOString();
    onChangeDates((current) => [{ id: crypto.randomUUID(), title: title.trim(), date, repeat: type === "custom" ? "none" : "yearly", type, visibility: "shared", createdBy: "me", updatedBy: "me", createdAt: now, updatedAt: now, revision: 1 }, ...current]);
    setTitle("");
    setDate("");
  }

  function createEvent() {
    if (!eventTitle.trim() || !eventStart) return;
    const now = new Date().toISOString();
    onChangeEvents((current) => [{ id: crypto.randomUUID(), title: eventTitle.trim(), startDate: eventStart, endDate: eventEnd || undefined, allDay: true, visibility: "shared", createdBy: "me", updatedBy: "me", createdAt: now, updatedAt: now, revision: 1 }, ...current]);
    setEventTitle("");
    setEventStart("");
    setEventEnd("");
  }

  return (
    <div className="grid gap-4">
      <Header eyebrow="Календарь" title="Важные даты" />
      <Surface className="grid gap-3 p-4">
        <h2 className="font-black">Дата</h2>
        <div className="grid gap-2 sm:grid-cols-[1fr_150px_150px_auto]">
          <Input placeholder="У мамы день рождения" value={title} onChange={(event) => setTitle(event.target.value)} />
          <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          <Select value={type} onChange={(event) => setType(event.target.value as ImportantDate["type"])}><option value="birthday">День рождения</option><option value="anniversary">Годовщина</option><option value="custom">Другое</option></Select>
          <Button onClick={createDate}><Plus size={18} />Добавить</Button>
        </div>
      </Surface>
      <Surface className="grid gap-3 p-4">
        <h2 className="font-black">Событие</h2>
        <div className="grid gap-2 sm:grid-cols-[1fr_150px_150px_auto]">
          <Input placeholder="Поездка, отпуск, ремонт" value={eventTitle} onChange={(event) => setEventTitle(event.target.value)} />
          <Input type="date" value={eventStart} onChange={(event) => setEventStart(event.target.value)} />
          <Input type="date" value={eventEnd} onChange={(event) => setEventEnd(event.target.value)} />
          <Button onClick={createEvent}><Plus size={18} />Добавить</Button>
        </div>
      </Surface>
      {[...dates].sort((a, b) => a.date.localeCompare(b.date)).map((item) => <FamilyRow key={item.id} icon={<Gift size={18} />} title={item.title} meta={`${item.date} · ${item.repeat === "yearly" ? "ежегодно" : "один раз"}`} onDelete={() => onChangeDates((current) => current.filter((dateItem) => dateItem.id !== item.id))} />)}
      {events.map((item) => <FamilyRow key={item.id} icon={<CalendarDays size={18} />} title={item.title} meta={`${item.startDate}${item.endDate ? ` - ${item.endDate}` : ""}`} onDelete={() => onChangeEvents((current) => current.filter((eventItem) => eventItem.id !== item.id))} />)}
      {!dates.length && !events.length ? <Empty text="Здесь будут дни рождения, годовщины и общие события." /> : null}
    </div>
  );
}

export function DocumentsHubView({ documents, loyaltyCards, onChangeDocuments, onChangeLoyaltyCards }: { documents: DocumentItem[]; loyaltyCards: LoyaltyCard[]; onChangeDocuments: Setter<DocumentItem>; onChangeLoyaltyCards: Setter<LoyaltyCard> }) {
  const [mode, setMode] = useState<"documents" | "cards">("documents");
  return (
    <div className="grid gap-5">
      <div className="screen-header">
        <div>
          <p className="screen-eyebrow">Офлайн-хранилище</p>
          <h1 className="screen-title">Документы</h1>
        </div>
      </div>
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { label: "Документы", value: "documents" },
          { label: "Карты", value: "cards" }
        ]}
      />
      {mode === "documents" ? <DocumentsView documents={documents} onChangeDocuments={onChangeDocuments} embedded /> : null}
      {mode === "cards" ? <LoyaltyCardsView cards={loyaltyCards} onChangeCards={onChangeLoyaltyCards} embedded /> : null}
    </div>
  );
}

export function DocumentsView({ documents, onChangeDocuments, embedded = false }: { documents: DocumentItem[]; onChangeDocuments: Setter<DocumentItem>; embedded?: boolean }) {
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState<Owner>("shared");
  const [category, setCategory] = useState<DocumentItem["category"]>("other");
  const cameraInputId = "document-camera-input";
  const fileInputId = "document-file-input";

  function addDocument(file?: File) {
    if (!title.trim() && !file) return;
    const now = new Date().toISOString();
    const attachment = file ? { id: crypto.randomUUID(), type: file.type.includes("pdf") ? "pdf" as const : file.type.startsWith("image/") ? "image" as const : "file" as const, name: file.name, mimeType: file.type, size: file.size, blob: file, createdAt: now } : undefined;
    onChangeDocuments((current) => [{ id: crypto.randomUUID(), title: title.trim() || file?.name || "Документ", category, attachments: attachment ? [attachment] : [], owner, note: "", createdAt: now, updatedAt: now, createdBy: "me", updatedBy: "me", revision: 1, visibility: owner === "shared" ? "shared" : "private" }, ...current]);
    setTitle("");
  }

  return (
    <div className="grid gap-4">
      {!embedded ? <Header eyebrow="Хранить" title="Документы" /> : null}
      <Surface className="document-actions grid gap-3 p-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_150px_150px_auto]">
          <Input placeholder="Паспорт, страховка, билет" value={title} onChange={(event) => setTitle(event.target.value)} />
          <Select value={category} onChange={(event) => setCategory(event.target.value as DocumentItem["category"])}><option value="passport">Паспорт</option><option value="insurance">Страховка</option><option value="ticket">Билет</option><option value="certificate">Справка</option><option value="contract">Договор</option><option value="other">Другое</option></Select>
          <OwnerSelect value={owner} onChange={setOwner} />
          <Button onClick={() => addDocument()}><Plus size={18} />Создать</Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="button button-primary document-cta" htmlFor={cameraInputId}><Camera size={19} />Сфотографировать</label>
          <label className="button button-plain document-cta" htmlFor={fileInputId}><Upload size={19} />Выбрать файл</label>
        </div>
        <input className="hidden" id={cameraInputId} type="file" accept="image/*" capture="environment" onChange={(event) => { addDocument(event.target.files?.[0]); event.target.value = ""; }} />
        <input className="hidden" id={fileInputId} type="file" accept="image/*,.pdf" onChange={(event) => { addDocument(event.target.files?.[0]); event.target.value = ""; }} />
        <p className="text-sm text-[var(--muted)]">Файлы лежат локально в приложении и откроются без интернета.</p>
      </Surface>
      {documents.map((item) => <DocumentRow key={item.id} item={item} onDelete={() => onChangeDocuments((current) => current.filter((document) => document.id !== item.id))} />)}
      {!documents.length ? <Empty icon={<FileText size={56} />} title="Здесь будут файлы" text="Билеты, страховки и важные бумаги можно сохранить на устройство." /> : null}
    </div>
  );
}

function DocumentRow({ item, onDelete }: { item: DocumentItem; onDelete: () => void }) {
  const previewUrl = useMemo(() => item.attachments[0]?.blob ? URL.createObjectURL(item.attachments[0].blob) : undefined, [item.attachments]);
  return <FamilyRow icon={<FileText size={18} />} title={item.title} meta={`${item.category ?? "документ"} · ${item.owner} · ${item.attachments.length} файл.`} onDelete={onDelete}>{previewUrl ? <a className="button button-plain mt-2 w-fit" href={previewUrl} target="_blank">Открыть файл</a> : null}</FamilyRow>;
}

export function LoyaltyCardsView({ cards, onChangeCards, embedded = false }: { cards: LoyaltyCard[]; onChangeCards: Setter<LoyaltyCard>; embedded?: boolean }) {
  const [title, setTitle] = useState("");
  const [barcodeValue, setBarcodeValue] = useState("");
  const [owner, setOwner] = useState<Owner>("shared");
  const [selected, setSelected] = useState<LoyaltyCard | null>(null);

  function createCard() {
    if (!title.trim() || !barcodeValue.trim()) return;
    const now = new Date().toISOString();
    onChangeCards((current) => [{ id: crypto.randomUUID(), title: title.trim(), barcodeValue: barcodeValue.trim(), barcodeFormat: "CODE128", owner, createdAt: now, updatedAt: now, createdBy: "me", updatedBy: "me", revision: 1, visibility: owner === "shared" ? "shared" : "private" }, ...current]);
    setTitle("");
    setBarcodeValue("");
  }

  return (
    <div className="grid gap-4">
      {!embedded ? <Header eyebrow="Хранить" title="Карты" /> : null}
      <Surface className="grid gap-3 p-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_150px_auto]">
          <Input placeholder="Магазин" value={title} onChange={(event) => setTitle(event.target.value)} />
          <Input placeholder="Номер / QR данные" value={barcodeValue} onChange={(event) => setBarcodeValue(event.target.value)} />
          <OwnerSelect value={owner} onChange={setOwner} />
          <Button onClick={createCard}><Plus size={18} />Добавить</Button>
        </div>
      </Surface>
      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((card) => <button className="text-left" key={card.id} onClick={() => setSelected(card)} type="button"><Surface className="grid gap-3 p-4"><div className="flex items-center justify-between"><h2 className="text-lg font-black">{card.title}</h2><Maximize2 size={18} /></div><Barcode value={card.barcodeValue} /><p className="text-sm text-[var(--muted)]">{card.owner}</p></Surface></button>)}
      </div>
      {!cards.length ? <Empty icon={<CreditCard size={56} />} title="Карт пока нет" text="Сохрани карты лояльности и штрих-коды, чтобы быстро открыть их офлайн." /> : null}
      {selected ? <div className="fixed inset-0 z-[85] grid place-items-center bg-white p-5 text-black"><button aria-label="Закрыть" className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-black/10" onClick={() => setSelected(null)} type="button"><X size={20} /></button><div className="grid w-full max-w-lg gap-6 text-center"><h1 className="text-3xl font-black">{selected.title}</h1><Barcode large value={selected.barcodeValue} /><div className="break-all font-mono text-lg">{selected.barcodeValue}</div><Button onClick={() => undefined}>Яркость на максимум вручную</Button></div></div> : null}
    </div>
  );
}

function Barcode({ large, value }: { large?: boolean; value: string }) {
  const bars = Array.from(value || "0000", (char, index) => ((char.charCodeAt(0) + index * 7) % 5) + 1);
  return <div className={`flex items-end justify-center gap-1 rounded-2xl bg-white p-4 ${large ? "min-h-64" : "min-h-28"}`}>{bars.map((width, index) => <span className="block bg-black" key={`${value}-${index}`} style={{ width, height: large ? 180 : 72 }} />)}</div>;
}

function Header({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <div><p className="text-sm font-bold text-[var(--muted)]">{eyebrow}</p><h1 className="text-3xl font-black">{title}</h1></div>;
}

function Empty({ icon, text, title }: { icon?: React.ReactNode; text: string; title?: string }) {
  return <Surface className="empty-state p-6 text-center text-sm text-[var(--muted)]">{icon ? <div className="empty-icon">{icon}</div> : null}{title ? <h2>{title}</h2> : null}<p>{text}</p></Surface>;
}

function FamilyRow({ children, icon, meta, onDelete, title }: { children?: React.ReactNode; icon: React.ReactNode; meta: string; onDelete: () => void; title: string }) {
  return <Surface className="p-4"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-black/[.045]">{icon}</span><span className="min-w-0"><span className="block font-black">{title}</span><span className="block text-sm text-[var(--muted)]">{meta}</span>{children}</span></div><Button aria-label="Удалить" className="h-10 w-10 shrink-0 p-0" onClick={onDelete}><X size={17} /></Button></div></Surface>;
}

function OwnerSelect({ value, onChange }: { value: Owner; onChange: (value: Owner) => void }) {
  return <Select value={value} onChange={(event) => onChange(event.target.value as Owner)}><option value="me">Моё</option><option value="partner">Партнёр</option><option value="shared">Общее</option></Select>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-black/[.035] p-3"><div className="text-xs font-bold uppercase text-[var(--muted)]">{label}</div><div className="font-black">{value}</div></div>;
}

function updatePlanStatus(plan: SharedPlan, status: SharedPlan["status"], onChangePlans: Setter<SharedPlan>) {
  onChangePlans((current) => current.map((item) => item.id === plan.id ? { ...item, status, updatedAt: new Date().toISOString(), revision: item.revision + 1 } : item));
}

function numberOrUndefined(value: string): number | undefined {
  const parsed = Number(value.replace(",", ".").trim());
  return Number.isFinite(parsed) && value.trim() ? parsed : undefined;
}
