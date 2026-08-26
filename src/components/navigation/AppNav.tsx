import { BriefcaseBusiness, CalendarDays, HeartHandshake, Lightbulb, ListTodo, Plus, Search, Settings, ShoppingCart, Sparkles, Target, WalletCards } from "lucide-react";
import type { ScreenId } from "@/features/app/types";

const navItems: Array<{ id: ScreenId; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { id: "us", label: "Мы", icon: HeartHandshake },
  { id: "plan", label: "План", icon: CalendarDays },
  { id: "tasks", label: "Задачи", icon: ListTodo },
  { id: "work", label: "Работа", icon: BriefcaseBusiness },
  { id: "purchases", label: "Покупки", icon: ShoppingCart },
  { id: "wishlist", label: "Хотелки", icon: Sparkles },
  { id: "sharedPlans", label: "Общие планы", icon: Target },
  { id: "money", label: "Деньги", icon: WalletCards },
  { id: "loyaltyCards", label: "Карты", icon: WalletCards },
  { id: "ideas", label: "Идеи", icon: Lightbulb },
  { id: "search", label: "Поиск", icon: Search },
  { id: "settings", label: "Настройки", icon: Settings }
];

export function MobileNav({ active, onAdd, onChange }: { active: ScreenId; onAdd: () => void; onChange: (screen: ScreenId) => void }) {
  return (
    <>
      <button aria-label="Добавить" className="fixed bottom-[calc(84px+env(safe-area-inset-bottom))] right-4 z-[55] grid h-14 w-14 place-items-center rounded-full bg-[#16191f] text-white shadow-xl md:hidden" onClick={onAdd} type="button">
        <Plus size={25} />
      </button>
      <nav className="mobile-nav fixed inset-x-0 bottom-0 z-50 mx-auto mb-[calc(10px+env(safe-area-inset-bottom))] flex w-[min(96vw,520px)] items-center gap-1 overflow-x-auto rounded-[24px] border border-black/5 bg-white/[.9] px-2 py-2 shadow-[0_20px_60px_rgba(24,35,52,.16)] backdrop-blur-xl md:hidden">
        {navItems.map((item) => <NavButton active={active === item.id} item={item} key={item.id} onClick={() => onChange(item.id)} />)}
      </nav>
    </>
  );
}

export function DesktopNav({ active, onChange }: { active: ScreenId; onChange: (screen: ScreenId) => void }) {
  return (
    <aside className="sticky top-4 hidden h-[calc(100vh-32px)] md:block">
      <div className="surface flex h-full flex-col gap-1 overflow-auto p-3">
        <div className="px-3 py-4">
          <div className="text-xl font-black">Ежедневник</div>
          <p className="text-xs text-[var(--muted)]">shared life organizer</p>
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button className={`flex min-h-11 items-center gap-3 rounded-2xl px-3 text-sm font-bold transition ${active === item.id ? "bg-[#16191f] text-white" : "text-[var(--muted)] hover:bg-black/5"}`} key={item.id} onClick={() => onChange(item.id)} type="button">
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
    <button aria-current={active ? "page" : undefined} className={`grid min-h-12 min-w-[68px] place-items-center rounded-2xl px-2 text-[11px] font-bold ${active ? "bg-black/[.06] text-[#111318]" : "text-[var(--muted)]"}`} onClick={onClick} type="button">
      <Icon size={19} />
      <span>{item.label}</span>
    </button>
  );
}
