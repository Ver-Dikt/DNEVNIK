export function ollamaError(value: unknown): string {
  const detail = value && typeof value === "object" && "error" in value && typeof value.error === "string" ? value.error : "";
  if (/out.of.memory|insufficient memory|failed to allocate|not enough memory/i.test(detail)) return "Локальной модели не хватает памяти компьютера. Закройте тяжёлые программы и повторите запрос.";
  if (/model.*not found|not found.*model/i.test(detail)) return "Локальная модель не найдена. Проверьте её установку и откройте ежедневник заново.";
  return "Локальная модель не смогла ответить. Повторите запрос или перезапустите ежедневник.";
}
