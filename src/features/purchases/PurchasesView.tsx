"use client";

import { Segmented, Surface } from "@/components/ui/native";
import { EntryCard } from "@/features/entries/EntryCard";
import { purchaseStatus } from "@/features/shared/entry-utils";
import type { DiaryEntry, PurchaseStatus, Space } from "@/lib/types";

export function PurchasesView({ entries, spaces, status, onStatusChange, onComplete, onOpen }: { entries: DiaryEntry[]; spaces: Space[]; status: PurchaseStatus; onStatusChange: (status: PurchaseStatus) => void; onComplete: (entry: DiaryEntry) => void; onOpen: (entry: DiaryEntry) => void }) {
  const visible = entries.filter((entry) => entry.kind === "purchase" && entry.status !== "cancelled" && purchaseStatus(entry) === status);
  return (
    <div className="grid gap-4">
      <div>
        <p className="text-sm font-bold text-[var(--muted)]">Список покупок</p>
        <h1 className="text-3xl font-black">Покупки</h1>
      </div>
      <Segmented
        value={status}
        onChange={onStatusChange}
        options={[
          { label: "Нужно", value: "planned" },
          { label: "Выбрано", value: "selected" },
          { label: "Заказано", value: "ordered" },
          { label: "Куплено", value: "purchased" }
        ]}
      />
      {visible.length ? visible.map((entry) => <EntryCard entry={entry} key={entry.id} spaces={spaces} onComplete={() => onComplete(entry)} onOpen={() => onOpen(entry)} />) : <Surface className="p-6 text-center text-sm text-[var(--muted)]">В этом статусе покупок пока нет.</Surface>}
    </div>
  );
}
