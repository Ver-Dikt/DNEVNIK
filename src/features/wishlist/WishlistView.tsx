"use client";

import { ExternalLink, Gift, Plus } from "lucide-react";
import { normalizeWebLink } from "@/lib/web-link";
import { useRef, useState } from "react";
import { Badge, Button, Field, Input, Segmented, Select, Surface } from "@/components/ui/native";
import { money, ownerLabel, wishStatus } from "@/features/shared/entry-utils";
import { calculateSharedPlan, money as planMoney } from "@/features/family/shared-plan-utils";
import { productMetadataProvider } from "@/lib/product-metadata";
import type { AssignedTo, DiaryEntry, Member, PlanTransaction, ProductMetadata, SharedPlan, Space, WishStatus } from "@/lib/types";

type EntriesSetter = (next: DiaryEntry[] | ((current: DiaryEntry[]) => DiaryEntry[])) => void;

export function WishlistView({
  defaultCurrency = "RUB",
  entries,
  planTransactions = [],
  sharedPlans = [],
  onChangeEntries,
  onChangePlanTransactions = () => undefined,
  onChangeSharedPlans = () => undefined,
  onComplete,
  onCreateManual,
  onOpen
}: {
  defaultCurrency?: string;
  entries: DiaryEntry[];
  members: Member[];
  planTransactions?: PlanTransaction[];
  sharedPlans?: SharedPlan[];
  spaces: Space[];
  onChangeEntries: EntriesSetter;
  onChangePlanTransactions?: (next: PlanTransaction[] | ((current: PlanTransaction[]) => PlanTransaction[])) => void;
  onChangeSharedPlans?: (next: SharedPlan[] | ((current: SharedPlan[]) => SharedPlan[])) => void;
  onComplete: (entry: DiaryEntry) => void;
  onCreateManual: (planned?: boolean, owner?: AssignedTo) => void;
  onOpen: (entry: DiaryEntry) => void;
}) {
  const [mode, setMode] = useState<"wishes" | "plans">("wishes");
  const [owner, setOwner] = useState<AssignedTo>("me");
  const [draftUrl, setDraftUrl] = useState("");
  const [draft, setDraft] = useState<ProductMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [linkMessage, setLinkMessage] = useState("");
  const requestVersion = useRef(0);
  const [metadataFailed, setMetadataFailed] = useState(false);
  const [planTitle, setPlanTitle] = useState("");
  const [planAmount, setPlanAmount] = useState("");
  const wishes = entries.filter((entry) => {
    if (entry.kind !== "wish" || wishStatus(entry) === "dismissed") return false;
    const status = wishStatus(entry);
    const inMode = mode === "plans" ? status === "planned" : status !== "planned";
    return inMode && (entry.wish?.owner ?? entry.assignedTo) === owner;
  });
  const plans = sharedPlans.filter((plan) => plan.status === "active" && planOwner(plan) === owner);

  function createPlan() {
    const title = planTitle.trim();
    if (!title) return;
    const now = new Date().toISOString();
    onChangeSharedPlans((current) => [{
      id: crypto.randomUUID(),
      title,
      type: "goal",
      status: "active",
      targetAmount: numberOrUndefined(planAmount),
      currency: defaultCurrency,
      createdBy: owner === "partner" ? "partner" : "me",
      updatedBy: "me",
      createdAt: now,
      updatedAt: now,
      revision: 1,
      visibility: owner === "shared" ? "shared" : "private"
    }, ...current]);
    setPlanTitle("");
    setPlanAmount("");
  }

  async function prepareUrl() {
    const url = normalizeWebLink(draftUrl);
    if (!url) { setLinkMessage("Вставьте ссылку сайта, например ozon.ru/product/…"); return; }
    setDraftUrl(url);
    setLinkMessage("");
    const version = ++requestVersion.current;
    setLoading(true);
    setMetadataFailed(false);
    try {
      const metadata = await productMetadataProvider.fetch(url);
      if (version !== requestVersion.current) return;
      setDraft({ ...metadata, store: metadata.store ?? domainFromUrl(url) });
      setMetadataFailed(!metadata.title && !metadata.price && !metadata.imageUrl);
    } catch {
      if (version !== requestVersion.current) return;
      setDraft({ store: domainFromUrl(url) });
      setMetadataFailed(true);
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }

  function saveDraft() {
    const url = normalizeWebLink(draftUrl);
    if (!url) { setLinkMessage("Проверьте ссылку перед сохранением."); return; }
    const duplicate = entries.find(item => item.kind === "wish" && (item.wish?.owner ?? item.assignedTo) === owner && normalizeWebLink(item.url ?? item.wish?.url) === url);
    if (duplicate) { setLinkMessage("Эта ссылка уже есть в вашем списке. Открыта существующая запись."); onOpen(duplicate); return; }
    const now = new Date().toISOString();
    const entry: DiaryEntry = {
      id: crypto.randomUUID(),
      kind: "wish",
      title: draft?.title?.trim() || domainFromUrl(url) || "Хотелка по ссылке",
      projectPath: ["Семья"],
      assignedTo: owner,
      visibility: owner === "shared" ? "shared" : "private",
      createdBy: "me",
      updatedBy: "me",
      status: "want_to_buy",
      priority: "normal",
      schedule: "someday",
      repeat: "none",
      checklist: [],
      url,
      unitPrice: draft?.price,
      totalPrice: draft?.price,
      currency: draft?.currency ?? defaultCurrency,
      store: draft?.store ?? domainFromUrl(url),
      wish: { status: mode === "plans" ? "planned" : "saved", owner, url, imageUrl: draft?.imageUrl, estimatedPrice: draft?.price, currency: draft?.currency ?? defaultCurrency, store: draft?.store ?? domainFromUrl(url) },
      attachments: [{ id: crypto.randomUUID(), type: "link", remoteUrl: url, name: domainFromUrl(url), createdAt: now }],
      needsReview: metadataFailed,
      createdAt: now,
      updatedAt: now,
      revision: 1
    };
    onChangeEntries((current) => [entry, ...current]);
    ++requestVersion.current;
    setLoading(false);
    setLinkMessage("Ссылка добавлена в хотелки.");
    setDraftUrl("");
    setDraft(null);
    setMetadataFailed(false);
  }

  return (
    <div className="grid gap-4">
      <div className="screen-header">
        <div>
          <p className="screen-eyebrow">На будущее</p>
          <h1 className="screen-title">Хотелки</h1>
        </div>
        <Button aria-label="Добавить хотелку" className="icon-add-button" onClick={() => onCreateManual(mode === "plans", owner)}><Plus size={30} /></Button>
      </div>
      <Segmented value={mode} onChange={setMode} options={[{ label: "Хотелки", value: "wishes" }, { label: "Планы", value: "plans" }]} />
      <Segmented value={owner} onChange={setOwner} options={ownerOptions} />
      {mode === "wishes" ? <Surface className="grid gap-3 p-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <Input aria-label="Ссылка на товар" autoCapitalize="none" autoCorrect="off" inputMode="url" placeholder="Ссылка или текст из «Поделиться»" value={draftUrl} onChange={(event) => { ++requestVersion.current; setLoading(false); setDraft(null); setMetadataFailed(false); setLinkMessage(""); setDraftUrl(event.target.value); }} onKeyDown={(event) => { if (event.key === "Enter") void prepareUrl(); }} />
          <Button disabled={loading} onClick={prepareUrl}><Plus size={18} />{loading ? "Читаю..." : "Добавить ссылку"}</Button>
        </div>
        <p className="text-sm text-[var(--muted)]">Ссылка сохраняется и без картинки. Название и цену можно указать вручную.</p>
        {linkMessage ? <p role="status" className="text-sm text-[var(--accent)]">{linkMessage}</p> : null}
        {draft ? (
          <div className="grid gap-3 rounded-2xl bg-black/[.035] p-3 sm:grid-cols-[96px_1fr]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {draft.imageUrl ? <img alt="" className="h-24 w-24 rounded-2xl object-cover" src={draft.imageUrl} /> : <div className="grid h-24 w-24 place-items-center rounded-2xl bg-[var(--surface-soft)] text-sm text-[var(--muted)]">URL</div>}
            <div className="grid gap-2">
              {metadataFailed ? <p className="text-sm font-bold text-[var(--muted)]">Автопревью недоступно. Ссылка готова к сохранению.</p> : null}
              <Field label="Название"><Input value={draft.title ?? ""} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></Field>
              <div className="grid gap-2 sm:grid-cols-3">
                <Field label="Цена"><Input inputMode="decimal" value={draft.price ?? ""} onChange={(event) => setDraft({ ...draft, price: numberOrUndefined(event.target.value) })} /></Field>
                <Field label="Картинка"><Input value={draft.imageUrl ?? ""} onChange={(event) => setDraft({ ...draft, imageUrl: event.target.value })} /></Field>
                <Field label="Магазин"><Input value={draft.store ?? ""} onChange={(event) => setDraft({ ...draft, store: event.target.value })} /></Field>
              </div>
              <Button variant="primary" className="w-fit px-4" onClick={saveDraft}>Сохранить в хотелки</Button>
            </div>
          </div>
        ) : null}
      </Surface> : (
        <Surface className="grid gap-3 p-4">
          <div className="grid gap-2 sm:grid-cols-[1fr_150px_auto]">
            <Input placeholder="Отпуск, ремонт, большая покупка" value={planTitle} onChange={(event) => setPlanTitle(event.target.value)} />
            <Input inputMode="decimal" placeholder="Цель" value={planAmount} onChange={(event) => setPlanAmount(event.target.value)} />
            <Button className="px-4" onClick={createPlan}><Plus size={18} />Создать</Button>
          </div>
        </Surface>
      )}
      {mode === "plans" ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {plans.map((plan) => <PlanCard key={plan.id} plan={plan} plans={sharedPlans} transactions={planTransactions} onChangePlans={onChangeSharedPlans} onChangeTransactions={onChangePlanTransactions} />)}
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {wishes.map((entry) => (
          <Surface className="overflow-hidden p-0" key={entry.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {entry.wish?.imageUrl ? <img alt="" className="h-40 w-full object-cover" src={entry.wish.imageUrl} /> : <div className="h-32 bg-[var(--surface-soft)]" />}
            <div className="grid gap-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <button className="min-w-0 text-left" onClick={() => onOpen(entry)} type="button">
                  <h2 className="line-clamp-2 text-lg font-black">{entry.title}</h2>
                  <p className="text-sm text-[var(--muted)]">{entry.wish?.store ?? entry.store ?? domainFromUrl(entry.url)}</p>
                </button>
                <Badge>{ownerLabel(entry.wish?.owner ?? entry.assignedTo)}</Badge>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-black">{money(entry) ? `${money(entry).toLocaleString("ru-RU")} ${entry.wish?.currency ?? entry.currency ?? defaultCurrency}` : "Без цены"}</div>
                <Select className="w-fit" aria-label={`Статус: ${entry.title}`} value={wishStatus(entry)} onChange={(event) => updateWishStatus(entry, event.target.value as WishStatus, onChangeEntries)}>
                  <option value="saved">Сохранено</option>
                  <option value="considering">Думаем</option>
                  <option value="planned">В плане</option>
                  <option value="purchased">Куплено</option>
                  <option value="dismissed">Скрыть</option>
                </Select>
              </div>
              <div className="flex flex-wrap gap-2">
                {normalizeWebLink(entry.url ?? entry.wish?.url) ? <a className="button button-plain" href={normalizeWebLink(entry.url ?? entry.wish?.url)} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} />Открыть</a> : null}
                <Button onClick={() => onComplete(entry)}>{wishStatus(entry) === "purchased" ? "Вернуть в список" : "Куплено"}</Button>
              </div>
            </div>
          </Surface>
        ))}
      </div>
      {mode === "wishes" && !wishes.length ? <Surface className="empty-state p-6 text-center text-sm text-[var(--muted)]"><div className="empty-icon"><Gift size={62} /></div><h2>Список пуст</h2><p>Киньте ссылку на товар или добавьте мечту вручную.</p><Button className="empty-cta" variant="primary" onClick={() => onCreateManual(false, owner)}>Добавить хотелку</Button></Surface> : null}
      {mode === "plans" && !plans.length && !wishes.length ? <Surface className="empty-state p-6 text-center text-sm text-[var(--muted)]"><div className="empty-icon"><Gift size={62} /></div><h2>Планов пока нет</h2><p>Создайте план для себя, партнёра или общий.</p><Button className="empty-cta" variant="primary" onClick={createPlan}>Создать план</Button></Surface> : null}
    </div>
  );
}

function PlanCard({ plan, plans, transactions, onChangePlans, onChangeTransactions }: { plan: SharedPlan; plans: SharedPlan[]; transactions: PlanTransaction[]; onChangePlans: (next: SharedPlan[] | ((current: SharedPlan[]) => SharedPlan[])) => void; onChangeTransactions: (next: PlanTransaction[] | ((current: PlanTransaction[]) => PlanTransaction[])) => void }) {
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
          <p className="text-sm text-[var(--muted)]">{ownerLabel(planOwner(plan))}</p>
        </div>
        <Badge>{plan.status === "active" ? "Активно" : "Архив"}</Badge>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/[.07]"><div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${stats.progress * 100}%` }} /></div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <MiniPlanStat label="Цель" value={planMoney(stats.target, currency)} />
        <MiniPlanStat label="Осталось" value={planMoney(stats.remaining, currency)} />
      </div>
      <div className="grid gap-2 sm:grid-cols-[120px_1fr_auto_auto]">
        <Input inputMode="decimal" placeholder="Сумма" value={amount} onChange={(event) => setAmount(event.target.value)} />
        <Input placeholder="Заметка" value={note} onChange={(event) => setNote(event.target.value)} />
        <Button onClick={() => addTransaction("deposit")}>Пополнить</Button>
        <Button onClick={() => addTransaction("expense")}>Расход</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => onChangePlans((current) => current.map((item) => item.id === plan.id ? { ...item, status: "completed", updatedAt: new Date().toISOString(), revision: item.revision + 1 } : item))}>Завершить</Button>
        <Button onClick={() => onChangePlans((current) => current.map((item) => item.id === plan.id ? { ...item, status: "archived", updatedAt: new Date().toISOString(), revision: item.revision + 1 } : item))}>В архив</Button>
      </div>
    </Surface>
  );
}

function MiniPlanStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-black/[.035] p-3"><div className="text-xs font-bold uppercase text-[var(--muted)]">{label}</div><div className="font-black">{value}</div></div>;
}

function updateWishStatus(entry: DiaryEntry, status: WishStatus, onChangeEntries: EntriesSetter) {
  onChangeEntries((current) => current.map((item) => item.id === entry.id ? { ...item, status: status === "purchased" ? "done" : status === "dismissed" ? "cancelled" : "active", completedAt: status === "purchased" ? new Date().toISOString() : undefined, wish: { ...item.wish, status }, updatedAt: new Date().toISOString(), revision: (item.revision ?? 1) + 1 } : item));
}

function planOwner(plan: SharedPlan): AssignedTo {
  if (plan.visibility === "shared") return "shared";
  return plan.createdBy === "partner" ? "partner" : "me";
}

const ownerOptions: Array<{ label: string; value: AssignedTo }> = [
  { label: "Моё", value: "me" },
  { label: "Партнёра", value: "partner" },
  { label: "Общее", value: "shared" }
];

function domainFromUrl(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function numberOrUndefined(value: string): number | undefined {
  const parsed = Number(value.replace(",", ".").trim());
  return Number.isFinite(parsed) && value.trim() ? parsed : undefined;
}
