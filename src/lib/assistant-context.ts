import type { DnevnikData } from "@/db/schema";

export type AssistantExtras = Pick<DnevnikData, "calendarEvents" | "importantDates" | "documents" | "loyaltyCards" | "sharedPlans" | "savingsGoals" | "financeTransactions" | "planTransactions">;

// Keep requests bounded while favouring records matching the actual question.
// Totals travel with the sample so the model cannot mistake a sample for the whole diary.
export function selectAssistantContext(data: Pick<DnevnikData, "entries" | "projects" | "spaces"> & AssistantExtras, question: string) {
  const terms = (question.toLocaleLowerCase("ru-RU").match(/[\p{L}\p{N}]{4,}/gu) ?? []).map(word => word.slice(0, 5));
  function select<T, R>(items: T[], limit: number, compact: (item: T) => R) {
    const ranked = items.map((item, index) => {
      const value = compact(item);
      const text = JSON.stringify(value).toLocaleLowerCase("ru-RU");
      return { value, index, score: terms.reduce((count, term) => count + (text.includes(term) ? 1 : 0), 0) };
    }).sort((a, b) => b.score - a.score || a.index - b.index);
    return { total: items.length, shown: Math.min(items.length, limit), items: ranked.slice(0, limit).map(item => item.value) };
  }
  const requestedKind = /купить|покуп|заказ/i.test(question) ? "purchase" : /задач|дела|дело/i.test(question) ? "task" : /хотел|желани/i.test(question) ? "wish" : /иде[ияюи]/i.test(question) ? "idea" : null;
  const sortedEntries = [...data.entries].sort((a, b) => Number(b.kind === requestedKind) - Number(a.kind === requestedKind));
  const entries = select(sortedEntries, 35, ({id,title,kind,status,area,dueDate,projectPath,assignedTo,priority,revision,needsReview,description,notes,sourceText,originalInput,purchase,wish}) => ({id,title,kind,status,area,dueDate,projectPath,assignedTo,priority,revision,needsReview,description:description?.slice(0,160),notes:notes?.slice(0,120),sourceText:needsReview ? (originalInput ?? sourceText)?.slice(0,300) : undefined,sourceTextTruncated: needsReview && (originalInput ?? sourceText ?? "").length > 300,purchase:purchase && {quantity:purchase.quantity,totalPrice:purchase.totalPrice,currency:purchase.currency,status:purchase.status},wish:wish && {estimatedPrice:wish.estimatedPrice,currency:wish.currency,status:wish.status}}));
  const result = {
    entries,
    projects: select(data.projects, 35, ({id,name,area,parentId,status}) => ({id,name,area,parentId,status})),
    spaces: select(data.spaces, 20, ({id,name}) => ({id,name})),
    calendarEvents: select(data.calendarEvents, 10, ({id,title,startDate,endDate,startTime,notes}) => ({id,title,startDate,endDate,startTime,notes:notes?.slice(0,120)})),
    importantDates: select(data.importantDates, 10, ({id,title,date,repeat,type,personName}) => ({id,title,date,repeat,type,personName})),
    documents: select(data.documents, 10, ({id,title,category,owner,note}) => ({id,title,category,owner,note:note?.slice(0,120)})),
    loyaltyCards: select(data.loyaltyCards, 10, ({id,title,owner}) => ({id,title,owner})),
    sharedPlans: select(data.sharedPlans, 10, ({id,title,type,status,targetAmount,currency,targetDate}) => ({id,title,type,status,targetAmount,currency,targetDate})),
    savingsGoals: select(data.savingsGoals, 10, ({id,title,targetAmount,currentAmount,currency,deadline}) => ({id,title,targetAmount,currentAmount,currency,deadline})),
    financeTransactions: select(data.financeTransactions, 10, ({id,type,amount,currency,relatedEntryId,createdAt}) => ({id,type,amount,currency,relatedEntryId,createdAt})),
    planTransactions: select(data.planTransactions, 10, ({id,planId,type,amount,currency,note,createdAt}) => ({id,planId,type,amount,currency,note:note?.slice(0,100),createdAt})),
  };
  const collections = Object.values(result);
  while (JSON.stringify(result).length > 20000) {
    const largest = collections.filter(group => group.items.length).sort((a, b) => JSON.stringify(b.items).length - JSON.stringify(a.items).length)[0];
    if (!largest) break;
    largest.items.pop();
    largest.shown = largest.items.length;
  }
  return result;
}
