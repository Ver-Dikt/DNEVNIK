import type { ScreenId } from "@/features/app/types";

export const screenNames: Record<ScreenId, string> = { us: "Мы", plan: "Календарь", tasks: "Задачи", school: "Школа", work: "Работа", purchases: "Покупки", wishlist: "Хотелки", money: "Деньги", documents: "Документы", ideas: "Идеи", records: "Записи и проекты", settings: "Настройки" };

// Navigation is allowed only for an explicit request. A model response alone
// cannot move the interface while answering a question or discussing a plan.
export function navigationTarget(text: string, value: unknown): ScreenId | null {
  if (/(?:как|можно ли|не надо|не нужно|не открывай|не переходи)/iu.test(text)) return null;
  if (!/(?:открой|перейди|переключи|покажи\s+(?:мне\s+)?раздел|зайди|открыть|перейти)/iu.test(text)) return null;
  if (Array.isArray(value) && value.length === 1) value = value[0];
  return typeof value === "string" && Object.hasOwn(screenNames, value) ? value as ScreenId : null;
}
