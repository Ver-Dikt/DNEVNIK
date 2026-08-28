"use client";

import { Segmented, Surface } from "@/components/ui/native";
import { EntryCard } from "@/features/entries/EntryCard";
import { purchaseStatusGroup } from "@/features/shared/entry-utils";
import { Button } from "@/components/ui/native";
import { Plus } from "lucide-react";
import type { DiaryEntry, Member, Space } from "@/lib/types";

export function PurchasesView({ entries, members, spaces, status, onAdd, onStatusChange, onComplete, onOpen }: { entries: DiaryEntry[]; members: Member[]; spaces: Space[]; status: "planned" | "ordered" | "purchased"; onAdd: () => void; onStatusChange: (status: "planned" | "ordered" | "purchased") => void; onComplete: (entry: DiaryEntry) => void; onOpen: (entry: DiaryEntry) => void }) {
  const visible = entries.filter((entry) => entry.kind === "purchase" && entry.status !== "cancelled" && purchaseStatusGroup(entry) === status).sort((a, b) => Number(b.priority === "high") - Number(a.priority === "high"));
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[var(--muted)]">Дом и нужное</p>
          <h1 className="text-3xl font-black">Покупки</h1>
        </div>
        <Button onClick={onAdd}><Plus size={17} />Добавить</Button>
      </div>
      <Segmented
        value={status}
        onChange={onStatusChange}
        options={[
          { label: "Нужно", value: "planned" },
          { label: "Заказано", value: "ordered" },
          { label: "Куплено", value: "purchased" }
        ]}
      />
      {visible.length ? visible.map((entry) => <EntryCard entry={entry} key={entry.id} members={members} spaces={spaces} onComplete={() => onComplete(entry)} onOpen={() => onOpen(entry)} />) : <Surface className="p-6 text-center text-sm text-[var(--muted)]">В этом статусе покупок пока нет.</Surface>}
    </div>
  );
}
