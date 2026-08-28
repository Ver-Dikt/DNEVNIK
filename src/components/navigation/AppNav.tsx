import { BriefcaseBusiness, CalendarDays, FileText, Gift, HeartHandshake, Lightbulb, ListTodo, Settings, ShoppingCart, WalletCards, type LucideProps } from "lucide-react";
import type { ScreenId } from "@/features/app/types";

const navItems: Array<{ id: ScreenId; label: string; icon: React.ComponentType<LucideProps> }> = [
  { id: "us", label: "Мы", icon: HeartHandshake },
  { id: "plan", label: "Календарь", icon: CalendarDays },
  { id: "tasks", label: "Задачи", icon: ListTodo },
  { id: "work", label: "Работа", icon: BriefcaseBusiness },
  { id: "purchases", label: "Покупки", icon: ShoppingCart },
  { id: "wishlist", label: "Хотелки", icon: Gift },
  { id: "money", label: "Деньги", icon: WalletCards },
  { id: "documents", label: "Документы", icon: FileText },
  { id: "ideas", label: "Идеи", icon: Lightbulb },
  { id: "settings", label: "Настройки", icon: Settings }
];

export function MobileNav({ active, onChange }: { active: ScreenId; onChange: (screen: ScreenId) => void }) {
  return (
    <nav className="mobile-nav fixed inset-x-0 bottom-0 z-50 flex items-center gap-1 overflow-x-auto border-t border-[var(--line)] bg-[rgba(17,19,24,.92)] px-2 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl md:hidden">
      {navItems.map((item) => <NavButton active={active === item.id} item={item} key={item.id} onClick={() => onChange(item.id)} />)}
    </nav>
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
    <button aria-current={active ? "page" : undefined} className={`grid min-h-14 place-items-center rounded-2xl px-1 text-[11px] font-bold transition ${active ? "text-[var(--foreground)]" : "text-[var(--muted)]"}`} onClick={onClick} type="button">
      <Icon size={22} strokeWidth={active ? 2.8 : 2.1} />
      <span>{item.label}</span>
    </button>
  );
}
