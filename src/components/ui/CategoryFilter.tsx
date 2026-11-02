import { Field, Select } from "@/components/ui/native";
import { categoryChoices } from "@/lib/entry-category";
import type { DiaryEntry } from "@/lib/types";

export function CategoryFilter({entries,value,onChange}: {entries: DiaryEntry[]; value: string; onChange: (value: string) => void}) {
  const choices=categoryChoices(entries);
  if (!choices.length) return null;
  return <Field label="Раздел или проект"><Select value={value} onChange={event=>onChange(event.target.value)}><option value="">Все разделы и проекты</option>{choices.map(choice=><option value={choice.value} key={choice.value}>{choice.label}</option>)}</Select></Field>;
}
