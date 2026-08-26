"use client";

import { ExternalLink, Plus } from "lucide-react";
import { useState } from "react";
import { Badge, Button, Field, Input, Segmented, Select, Surface } from "@/components/ui/native";
import { money, ownerLabel, wishStatus } from "@/features/shared/entry-utils";
import { productMetadataProvider } from "@/lib/product-metadata";
import type { AssignedTo, DiaryEntry, Member, ProductMetadata, Space, WishStatus } from "@/lib/types";

type EntriesSetter = (next: DiaryEntry[] | ((current: DiaryEntry[]) => DiaryEntry[])) => void;

export function WishlistView({ entries, members, onChangeEntries, onComplete, onCreateManual, onOpen }: { entries: DiaryEntry[]; members: Member[]; spaces: Space[]; onChangeEntries: EntriesSetter; onComplete: (entry: DiaryEntry) => void; onCreateManual: () => void; onOpen: (entry: DiaryEntry) => void }) {
  const [owner, setOwner] = useState<AssignedTo | "all">("all");
  const [draftUrl, setDraftUrl] = useState("");
  const [draft, setDraft] = useState<ProductMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [metadataFailed, setMetadataFailed] = useState(false);
  const wishes = entries.filter((entry) => entry.kind === "wish" && wishStatus(entry) !== "dismissed" && (owner === "all" || (entry.wish?.owner ?? entry.assignedTo) === owner));

  async function prepareUrl() {
    const url = draftUrl.trim();
    if (!url) return;
    setLoading(true);
    setMetadataFailed(false);
    try {
      const metadata = await productMetadataProvider.fetch(url);
      setDraft({ ...metadata, store: metadata.store ?? domainFromUrl(url) });
      setMetadataFailed(!metadata.title && !metadata.price && !metadata.imageUrl);
    } catch {
      setDraft({ store: domainFromUrl(url) });
      setMetadataFailed(true);
    } finally {
      setLoading(false);
    }
  }

  function saveDraft() {
    const url = draftUrl.trim();
    if (!url) return;
    const now = new Date().toISOString();
    const ownerValue = owner === "all" ? "me" : owner;
    const entry: DiaryEntry = {
      id: crypto.randomUUID(),
      kind: "wish",
      title: draft?.title?.trim() || "Хотелка по ссылке",
      projectPath: ["Семья"],
      assignedTo: ownerValue,
      visibility: ownerValue === "shared" ? "shared" : "private",
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
      currency: draft?.currency ?? "RUB",
      store: draft?.store ?? domainFromUrl(url),
      wish: { status: "saved", owner: ownerValue, url, imageUrl: draft?.imageUrl, estimatedPrice: draft?.price, currency: draft?.currency ?? "RUB", store: draft?.store ?? domainFromUrl(url) },
      attachments: [{ id: crypto.randomUUID(), type: "link", remoteUrl: url, name: domainFromUrl(url), createdAt: now }],
      needsReview: metadataFailed,
      createdAt: now,
      updatedAt: now,
      revision: 1
    };
    onChangeEntries((current) => [entry, ...current]);
    setDraftUrl("");
    setDraft(null);
    setMetadataFailed(false);
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[var(--muted)]">На будущее</p>
          <h1 className="text-3xl font-black">Хотелки</h1>
        </div>
        <Button onClick={onCreateManual}><Plus size={17} />Добавить вручную</Button>
      </div>
      <Surface className="grid gap-3 p-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <Input placeholder="Вставь ссылку на товар" value={draftUrl} onChange={(event) => setDraftUrl(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void prepareUrl(); }} />
          <Button disabled={loading} onClick={prepareUrl}><Plus size={18} />{loading ? "Читаю..." : "Превью"}</Button>
        </div>
        {draft ? (
          <div className="grid gap-3 rounded-2xl bg-black/[.035] p-3 sm:grid-cols-[96px_1fr]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {draft.imageUrl ? <img alt="" className="h-24 w-24 rounded-2xl object-cover" src={draft.imageUrl} /> : <div className="grid h-24 w-24 place-items-center rounded-2xl bg-white text-sm text-[var(--muted)]">URL</div>}
            <div className="grid gap-2">
              {metadataFailed ? <p className="text-sm font-bold text-[#a15c00]">Не удалось получить данные товара. Ссылка сохранится, поля можно заполнить вручную.</p> : null}
              <Field label="Название"><Input value={draft.title ?? ""} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></Field>
              <div className="grid gap-2 sm:grid-cols-3">
                <Field label="Цена"><Input inputMode="decimal" value={draft.price ?? ""} onChange={(event) => setDraft({ ...draft, price: numberOrUndefined(event.target.value) })} /></Field>
                <Field label="Картинка"><Input value={draft.imageUrl ?? ""} onChange={(event) => setDraft({ ...draft, imageUrl: event.target.value })} /></Field>
                <Field label="Магазин"><Input value={draft.store ?? ""} onChange={(event) => setDraft({ ...draft, store: event.target.value })} /></Field>
              </div>
              <Button className="w-fit px-4" onClick={saveDraft}>Сохранить в хотелки</Button>
            </div>
          </div>
        ) : null}
      </Surface>
      <Segmented value={owner} onChange={setOwner} options={[{ label: "Все", value: "all" }, { label: ownerLabel("me", members), value: "me" }, { label: ownerLabel("partner", members), value: "partner" }, { label: "Общее", value: "shared" }]} />
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
                <Badge>{ownerLabel(entry.wish?.owner ?? entry.assignedTo, members)}</Badge>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-black">{money(entry) ? `${money(entry).toLocaleString("ru-RU")} ₽` : "Без цены"}</div>
                <Select className="w-fit" value={wishStatus(entry)} onChange={(event) => updateWishStatus(entry, event.target.value as WishStatus, onChangeEntries)}>
                  <option value="saved">Сохранено</option>
                  <option value="considering">Думаем</option>
                  <option value="planned">В плане</option>
                  <option value="purchased">Куплено</option>
                  <option value="dismissed">Скрыть</option>
                </Select>
              </div>
              <div className="flex flex-wrap gap-2">
                {entry.url ? <a className="button button-plain" href={entry.url} target="_blank"><ExternalLink size={16} />Открыть</a> : null}
                <Button onClick={() => onComplete(entry)}>Куплено</Button>
              </div>
            </div>
          </Surface>
        ))}
      </div>
      {!wishes.length ? <Surface className="p-6 text-center text-sm text-[var(--muted)]">Сохраняй сюда вещи, которые хочется купить когда-нибудь.</Surface> : null}
    </div>
  );
}

function updateWishStatus(entry: DiaryEntry, status: WishStatus, onChangeEntries: EntriesSetter) {
  onChangeEntries((current) => current.map((item) => item.id === entry.id ? { ...item, wish: { ...item.wish, status }, updatedAt: new Date().toISOString(), revision: (item.revision ?? 1) + 1 } : item));
}

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
