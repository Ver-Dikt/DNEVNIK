"use client";

import { Backpack, CalendarDays, ChevronLeft, ChevronRight, Clock3, GraduationCap, PackageCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Surface } from "@/components/ui/native";

type Lesson = { title: string; time: string; bring?: string[] };
const lessons: Record<number, Lesson[]> = {
  1: [
    { title: "Разговоры о важном", time: "09:00–09:40" }, { title: "Русский язык", time: "09:55–10:35", bring: ["Тетрадь: 18 листов, узкая линейка"] },
    { title: "Английский язык", time: "10:45–11:25", bring: ["Тетрадь по английскому"] }, { title: "Математика", time: "11:40–12:20", bring: ["Тетрадь: 18 листов, клетка"] },
    { title: "Физическая культура", time: "12:35–13:15", bring: ["Спортивная форма"] }
  ],
  2: [
    { title: "Русский язык", time: "09:00–09:40", bring: ["Тетрадь: 18 листов, узкая линейка"] }, { title: "Литературное чтение", time: "09:55–10:35", bring: ["Тетрадь: 18 листов, клетка"] },
    { title: "Математика", time: "10:45–11:25", bring: ["Тетрадь: 18 листов, клетка"] }, { title: "ИЗО", time: "11:40–12:20", bring: ["Папка для ИЗО", "Цветные и простой карандаши", "Ластик, точилка, линейка, клей-карандаш"] },
    { title: "Окружающий мир", time: "12:35–13:15", bring: ["Тетрадь: 18 листов, клетка", "Папка А5 без файлов"] }
  ],
  3: [
    { title: "Классный час", time: "09:00–09:40" }, { title: "Математика", time: "09:55–10:35", bring: ["Тетрадь: 18 листов, клетка"] },
    { title: "Русский язык", time: "10:45–11:25", bring: ["Тетрадь: 18 листов, узкая линейка"] }, { title: "Литературное чтение", time: "11:40–12:20", bring: ["Тетрадь: 18 листов, клетка"] },
    { title: "Занимательная математика", time: "12:35–13:15", bring: ["Тетрадь: 18 листов, клетка, любой цвет"] }
  ],
  4: [
    { title: "Английский язык", time: "09:00–09:40", bring: ["Тетрадь по английскому"] }, { title: "Математика", time: "09:55–10:35", bring: ["Тетрадь: 18 листов, клетка"] },
    { title: "Литературное чтение", time: "10:45–11:25", bring: ["Тетрадь: 18 листов, клетка"] }, { title: "Русский язык", time: "11:40–12:20", bring: ["Тетрадь: 18 листов, узкая линейка"] },
    { title: "Физическая культура", time: "12:35–13:15", bring: ["Спортивная форма"] }
  ],
  5: [
    { title: "Окружающий мир", time: "09:00–09:40", bring: ["Тетрадь: 18 листов, клетка"] }, { title: "Русский язык", time: "09:55–10:35", bring: ["Тетрадь: 18 листов, узкая линейка"] },
    { title: "Литературное чтение", time: "10:45–11:25", bring: ["Тетрадь: 18 листов, клетка"] }, { title: "Труд", time: "11:40–12:20", bring: ["Папка для труда со всеми материалами"] },
    { title: "Музыка", time: "12:35–13:15", bring: ["Тетрадь по музыке"] }
  ]
};
const supplies = ["Синие ручки", "Зелёная ручка", "Красная ручка", "Простой карандаш", "Цветные карандаши", "Ластик", "Точилка", "Линейка 15 см", "Клей-карандаш", "Подставка для книг", "Закладки в учебники", "Папка А4 для портфолио", "Тряпочка для парты"];
const dayFormat = new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long" });
function isoLocal(date: Date) { const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000); return shifted.toISOString().slice(0, 10); }

export function SchoolView() {
  const [date, setDate] = useState(() => isoLocal(new Date()));
  const [checked, setChecked] = useState<string[]>([]);
  useEffect(() => {
    queueMicrotask(() => {
      try { setChecked(JSON.parse(localStorage.getItem("dnevnik-school-supplies") ?? "[]")); } catch { setChecked([]); }
    });
  }, []);
  const selected = useMemo(() => new Date(`${date}T12:00:00`), [date]);
  const dayLessons = lessons[selected.getDay()] ?? [];
  const bring = Array.from(new Set(dayLessons.flatMap(item => item.bring ?? [])));
  function move(days: number) { const next = new Date(selected); next.setDate(next.getDate() + days); setDate(isoLocal(next)); }
  function toggleSupply(item: string) { setChecked(current => { const next = current.includes(item) ? current.filter(value => value !== item) : [...current, item]; localStorage.setItem("dnevnik-school-supplies", JSON.stringify(next)); return next; }); }

  return <section className="school-view" aria-labelledby="school-title">
    <header className="screen-header school-header"><div><p className="screen-eyebrow">Богдан</p><h1 className="screen-title" id="school-title">Школа</h1></div><span className="school-mark" aria-hidden="true"><GraduationCap size={28} /></span></header>
    <div className="school-date-nav" aria-label="Выбор школьного дня"><button type="button" onClick={() => move(-1)} aria-label="Предыдущий день"><ChevronLeft /></button><label><CalendarDays size={18} /><span>{dayFormat.format(selected)}</span><input type="date" value={date} onChange={event => setDate(event.target.value)} aria-label="Выбрать дату" /></label><button type="button" onClick={() => move(1)} aria-label="Следующий день"><ChevronRight /></button></div>
    <div className="school-grid">
      <Surface className="school-card school-lessons"><div className="school-card-title"><div><span>Расписание</span><h2>{dayLessons.length ? `${dayLessons.length} уроков` : "Уроков нет"}</h2></div>{dayLessons.length ? <b><Clock3 size={16} /> до 13:15</b> : null}</div>{dayLessons.length ? <ol>{dayLessons.map((lesson, index) => <li key={lesson.time}><span className="lesson-number">{index + 1}</span><div><strong>{lesson.title}</strong><small>{lesson.time}</small></div></li>)}</ol> : <div className="school-empty">Выходной — можно оставить рюкзак дома.</div>}</Surface>
      <Surface className="school-card"><div className="school-card-title"><div><span>С собой</span><h2>Собрать рюкзак</h2></div><Backpack size={24} /></div>{bring.length ? <ul className="packing-list">{bring.map(item => <li key={item}><PackageCheck size={18} /><span>{item}</span></li>)}</ul> : <p className="school-muted">На выбранный день ничего собирать не нужно.</p>}</Surface>
      <Surface className="school-card school-event"><div className="school-card-title"><div><span>Ближайшее событие</span><h2>Родительское собрание</h2></div><CalendarDays size={24} /></div><p><strong>23 сентября</strong> · время ещё нужно уточнить</p><small>Перенесли, чтобы сначала провести и проверить стартовые контрольные.</small></Surface>
      <Surface className="school-card school-supplies"><div className="school-card-title"><div><span>Общий список</span><h2>Купить и подготовить</h2></div><b>{checked.length}/{supplies.length}</b></div><div className="school-checks">{supplies.map(item => <label key={item}><input type="checkbox" checked={checked.includes(item)} onChange={() => toggleSupply(item)} /><span>{item}</span></label>)}</div><p className="school-note">Тетради: 4 × 18 листов в узкую линейку; 9 × 18 листов, 4 × 48 листов и 2 × 96 листов — в клетку.</p></Surface>
    </div>
  </section>;
}
