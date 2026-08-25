import { Archive, CalendarDays, MoreHorizontal, Plus, ShoppingCart } from "lucide-react";
import type { ScreenId } from "@/features/app/types";

const navItems: Array<{ id: ScreenId; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { id: "plan", label: "План", icon: CalendarDays },
  { id: "spaces", label: "Проекты", icon: Archive },
  { id: "purchases", label: "Покупки", icon: ShoppingCart },
  { id: "more", label: "Ещё", icon: MoreHorizontal }
];

export function MobileNav({ active, onAdd, onChange }: { active: ScreenId; onAdd: () => void; onChange: (screen: ScreenId) => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 mx-auto mb-[calc(12px+env(safe-area-inset-bottom))] flex w-[min(94vw,430px)] items-center justify-between rounded-[28px] border border-black/5 bg-white/[.88] px-3 py-2 shadow-[0_20px_60px_rgba(24,35,52,.18)] backdrop-blur-xl md:hidden">
      {navItems.slice(0, 2).map((item) => <NavButton active={active === item.id} item={item} key={item.id} onClick={() => onChange(item.id)} />)}
      <button aria-label="Добавить" className="grid h-14 w-14 min-w-14 place-items-center rounded-full bg-[#16191f] text-white shadow-xl" onClick={onAdd} type="button">
        <Plus size={25} />
      </button>
      {navItems.slice(2).map((item) => <NavButton active={active === item.id} item={item} key={item.id} onClick={() => onChange(item.id)} />)}
    </nav>
  );
}

export function DesktopNav({ active, onChange }: { active: ScreenId; onChange: (screen: ScreenId) => void }) {
  return (
    <aside className="sticky top-4 hidden h-[calc(100vh-32px)] md:block">
      <div className="surface flex h-full flex-col gap-2 p-3">
        <div className="px-3 py-4">
          <div className="text-xl font-black">Ежедневник</div>
          <p className="text-xs text-[var(--muted)]">shared life organizer</p>
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button className={`flex min-h-12 items-center gap-3 rounded-2xl px-3 text-sm font-bold transition ${active === item.id ? "bg-[#16191f] text-white" : "text-[var(--muted)] hover:bg-black/5"}`} key={item.id} onClick={() => onChange(item.id)} type="button">
              <Icon size={18} />
              {item.label}
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function NavButton({ active, item, onClick }: { active: boolean; item: (typeof navItems)[number]; onClick: () => void }) {
  const Icon = item.icon;
  return (
    <button aria-current={active ? "page" : undefined} className={`grid min-h-12 min-w-12 place-items-center rounded-2xl px-1 text-[11px] font-bold ${active ? "bg-black/[.06] text-[#111318]" : "text-[var(--muted)]"}`} onClick={onClick} type="button">
      <Icon size={19} />
      <span>{item.label}</span>
    </button>
  );
}
