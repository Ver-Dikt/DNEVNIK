import { Surface } from "@/components/ui/native";
import { EntryCard } from "@/features/entries/EntryCard";
import { money, wishStatus } from "@/features/shared/entry-utils";
import type { DiaryEntry, Space } from "@/lib/types";

export function WishlistView({ entries, spaces, onComplete, onOpen }: { entries: DiaryEntry[]; spaces: Space[]; onComplete: (entry: DiaryEntry) => void; onOpen: (entry: DiaryEntry) => void }) {
  const wishes = entries.filter((entry) => entry.kind === "wish" && wishStatus(entry) !== "dismissed");
  return (
    <div className="grid gap-4">
      <div>
        <p className="text-sm font-bold text-[var(--muted)]">На будущее</p>
        <h1 className="text-3xl font-black">Хотелки</h1>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {wishes.map((entry) => (
          <Surface className="overflow-hidden p-0" key={entry.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {entry.wish?.imageUrl ? <img alt="" className="h-32 w-full object-cover" src={entry.wish.imageUrl} /> : <div className="h-24 bg-gradient-to-br from-[#f4f1ff] to-[#eef7f4]" />}
            <div className="p-3">
              <EntryCard entry={entry} spaces={spaces} onComplete={() => onComplete(entry)} onOpen={() => onOpen(entry)} />
              {money(entry) ? <div className="mt-2 text-sm font-black">{money(entry).toLocaleString("ru-RU")} ₽</div> : null}
            </div>
          </Surface>
        ))}
      </div>
      {!wishes.length ? <Surface className="p-6 text-center text-sm text-[var(--muted)]">Сохраняй сюда вещи, которые хочется купить когда-нибудь.</Surface> : null}
    </div>
  );
}
