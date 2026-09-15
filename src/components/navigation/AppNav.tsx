"use client";

import { BriefcaseBusiness, CalendarDays, FileText, Gift, GraduationCap, HeartHandshake, Lightbulb, ListTodo, Settings, ShoppingCart, WalletCards, LayoutGrid, X, type LucideProps } from "lucide-react";
import { useRef, useState } from "react";
import type { ScreenId } from "@/features/app/types";
import { useModalLayer } from "@/hooks/use-modal-layer";

const navItems: Array<{ id: ScreenId; label: string; detail: string; icon: React.ComponentType<LucideProps> }> = [
  { id: "us", label: "Мы", detail: "Общие дела и события", icon: HeartHandshake },
  { id: "plan", label: "Календарь", detail: "День, неделя и месяц", icon: CalendarDays },
  { id: "tasks", label: "Задачи", detail: "Что нужно сделать", icon: ListTodo },
  { id: "purchases", label: "Покупки", detail: "Список и заказы", icon: ShoppingCart },
  { id: "school", label: "Школа", detail: "Уроки Богдана и что взять", icon: GraduationCap },
  { id: "work", label: "Работа", detail: "Рабочие записи", icon: BriefcaseBusiness },
  { id: "wishlist", label: "Хотелки", detail: "Желания и планы", icon: Gift },
  { id: "money", label: "Деньги", detail: "Покупки и бюджет", icon: WalletCards },
  { id: "documents", label: "Документы", detail: "Файлы и карты", icon: FileText },
  { id: "ideas", label: "Идеи", detail: "Мысли и наброски", icon: Lightbulb },
  { id: "settings", label: "Настройки", detail: "Профили и резервные копии", icon: Settings }
];

export function MobileNav({ active, onChange }: { active: ScreenId; onChange: (screen: ScreenId) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const primary = navItems.slice(0, 4);
  const extra = !primary.some(item => item.id === active);
  return <>
    <nav className="app-mobile-nav md:hidden" aria-label="Основные разделы">
      {primary.map(item => <NavButton active={active === item.id} item={item} key={item.id} onClick={() => onChange(item.id)} />)}
      <button className={`app-mobile-item ${extra || menuOpen ? "is-active" : ""}`} aria-label="Все разделы" aria-expanded={menuOpen} aria-haspopup="dialog" onClick={() => setMenuOpen(true)} type="button"><LayoutGrid size={21} /><span>Ещё</span></button>
    </nav>
    {menuOpen ? <SectionMenu active={active} onClose={() => setMenuOpen(false)} onChange={screen => { setMenuOpen(false); onChange(screen); }} /> : null}
  </>;
}

function SectionMenu({ active, onClose, onChange }: { active: ScreenId; onClose: () => void; onChange: (screen: ScreenId) => void }) {
  const root = useRef<HTMLDivElement>(null);
  useModalLayer(root, onClose);
  return <div ref={root} className="app-overlay z-[80]" onClick={onClose}>
    <section className="surface app-dialog section-menu" role="dialog" aria-modal="true" aria-label="Все разделы" onClick={event => event.stopPropagation()}>
      <div className="dialog-heading"><div><p className="screen-eyebrow">Ежедневник</p><h2>Все разделы</h2></div><button className="icon-control" type="button" aria-label="Закрыть меню" onClick={onClose}><X size={20} /></button></div>
      <div className="section-grid">{navItems.map(item => {
        const Icon = item.icon;
        return <button key={item.id} type="button" className={`section-shortcut ${active === item.id ? "is-active" : ""}`} aria-current={active === item.id ? "page" : undefined} onClick={() => onChange(item.id)}><Icon size={23} /><b>{item.label}</b><span>{item.detail}</span></button>;
      })}</div>
    </section>
  </div>;
}

export function DesktopNav({ active, onChange }: { active: ScreenId; onChange: (screen: ScreenId) => void }) {
  return <aside className="sticky top-5 hidden h-[calc(100dvh-40px)] md:block">
    <nav className="surface app-sidebar" aria-label="Разделы ежедневника">
      <div className="sidebar-brand"><span className="brand-icon"><CalendarDays size={24} /></span><div><strong>Ежедневник</strong><p>Всё важное рядом</p></div></div>
      {navItems.map(item => {
        const Icon = item.icon;
        return <button key={item.id} type="button" aria-current={active === item.id ? "page" : undefined} className={`sidebar-item ${active === item.id ? "is-active" : ""}`} onClick={() => onChange(item.id)}><Icon size={19} /><span>{item.label}</span></button>;
      })}
      <div className="sidebar-note">Ваши записи — в этом браузере.<button onClick={() => onChange("settings")} type="button">Сохранить резервную копию →</button></div>
    </nav>
  </aside>;
}

function NavButton({ active, item, onClick }: { active: boolean; item: typeof navItems[number]; onClick: () => void }) {
  const Icon = item.icon;
  return <button aria-current={active ? "page" : undefined} className={`app-mobile-item ${active ? "is-active" : ""}`} onClick={onClick} type="button"><Icon size={21} strokeWidth={active ? 2.5 : 1.8} /><span>{item.label}</span></button>;
}
