import type { AssistantPlan } from "./assistant-actions";
export const DIARY_MODEL = "qwen3.5:9b";
export type ChatMessage = { id: string; role: "user" | "assistant"; text: string; plan?: AssistantPlan; state?: "pending" | "applied" | "dismissed" };
export function restoreConversation(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-40).flatMap(item => {
    if (!item || typeof item !== "object" || !["user", "assistant"].includes(item.role) || typeof item.text !== "string") return [];
    // Restore the conversation, but never revive an actionable plan after a reload.
    return [{ id: typeof item.id === "string" ? item.id : crypto.randomUUID(), role: item.role as "user" | "assistant", text: item.text.slice(0, 10000), ...(item.state === "applied" ? { state: "applied" as const } : item.state === "dismissed" || item.state === "pending" ? { state: "dismissed" as const } : {}) }];
  });
}
export function confirmationIntent(text: string): "apply" | "dismiss" | null {
  const normalized = text.toLocaleLowerCase("ru").replace(/[.!?,]+/g, " ").replace(/\s+/g," ").trim();
  if (/^(да|давай|ага|угу|хорошо|ок|окей|примени|применяй|применить|сохрани|подтверждаю|да применяй|да давай|да сохрани|да сделай|сделай|всё верно)$/.test(normalized)) return "apply";
  if (/^(нет|отмена|отмени|не надо|не применяй|не сохраняй)$/.test(normalized)) return "dismiss";
  return null;
}
export function conversationHistory(messages: ChatMessage[]) {
  return messages.slice(-6).map(message => ({ role: message.role, content: `${message.text}${message.state === "applied" ? "\n[Изменения применены приложением.]" : message.state === "pending" ? "\n[Это предложение. Изменения ещё НЕ применены.]" : message.state === "dismissed" ? "\n[Предложение отменено.]" : ""}`.slice(0, 2000) }));
}
