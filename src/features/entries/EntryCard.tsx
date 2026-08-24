import { Check, Circle, ExternalLink, MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/native";
import { formatDateRu } from "@/lib/dates";
import type { DiaryEntry, Space } from "@/lib/types";
import { entrySpaceName, kindLabels, money, ownerLabel } from "@/features/shared/entry-utils";

export function EntryCard({
  entry,
  spaces,
  onComplete,
  onOpen
}: {
  entry: DiaryEntry;
  spaces: Space[];
  onComplete: () => void;
  onOpen: () => void;
}) {
  const done = entry.status === "done" || entry.status === "bought";
  const amount = money(entry);
  return (
    <div className="entry-card">
      <button className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-black/[.045] text-[#1c6f5b]" onClick={onComplete} type="button" aria-label={done ? "Выполнено" : "Отметить выполненным"}>
        {done ? <Check size={18} /> : <Circle size={18} />}
      </button>
      <button className="min-w-0 flex-1 text-left" onClick={onOpen} type="button">
        <div className="flex flex-wrap gap-1.5">
          <Badge>{kindLabels[entry.kind]}</Badge>
          <Badge>{ownerLabel(entry.assignedTo)}</Badge>
          {entry.priority === "high" ? <Badge className="text-[#b4233a]">важно</Badge> : null}
          {entry.needsReview ? <Badge className="text-[#a15c00]">разобрать</Badge> : null}
        </div>
        <div className={`mt-2 text-[17px] font-black leading-snug ${done ? "text-[var(--muted)] line-through" : ""}`}>{entry.title}</div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-[var(--muted)]">
          <span>{entrySpaceName(entry, spaces)}{entry.project ? ` · ${entry.project}` : ""}</span>
          {entry.time ? <span>{entry.time}</span> : null}
          {entry.dueDate ? <span>{formatDateRu(entry.dueDate)}</span> : null}
          {amount ? <span>{amount.toLocaleString("ru-RU")} ₽</span> : null}
          {entry.url ? <span className="inline-flex items-center gap-1"><ExternalLink size={13} /> ссылка</span> : null}
        </div>
      </button>
      <button className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[var(--muted)]" onClick={onOpen} type="button" aria-label="Открыть запись">
        <MoreHorizontal size={18} />
      </button>
    </div>
  );
}
