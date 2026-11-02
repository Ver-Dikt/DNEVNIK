import { describe, expect, it } from "vitest";
import type { DnevnikData } from "@/db/schema";
import { purchaseTotals, selectAssistantContext } from "./assistant-context";

describe("assistant context", () => {
  it("calculates all purchases by currency and reports missing prices", () => {
    const base: Omit<DnevnikData["entries"][number], "id" | "title"> = {kind:"purchase",status:"want_to_buy",priority:"normal",schedule:"none",projectPath:[],createdAt:"",updatedAt:""};
    const entries = [...Array.from({length:40}, (_,id) => ({...base,id:String(id),title:"Покупка",totalPrice:10,currency:"RUB"})), {...base,id:"none",title:"Без цены"}, {...base,id:"usd",title:"Доллары",totalPrice:7,currency:"USD"}, {...base,id:"done",title:"Куплено",status:"bought" as const,totalPrice:25,currency:"RUB"}];
    expect(purchaseTotals(entries)).toEqual({RUB:{planned:400,actual:25,missingPlanned:1,missingActual:0},USD:{planned:7,actual:0,missingPlanned:0,missingActual:0}});
  });
  it("finds a matching record beyond the old 150-record limit and labels partial data", () => {
    const entries = Array.from({length: 200}, (_, index) => ({id:String(index), title:index === 199 ? "Купить микрофон" : `Запись ${index}`, kind:"task",status:"active",priority:"normal",schedule:"none",projectPath:[],createdAt:"",updatedAt:""}));
    const data = {entries, projects:[], spaces:[], calendarEvents:[], importantDates:[], documents:[], loyaltyCards:[], sharedPlans:[], savingsGoals:[], financeTransactions:[], planTransactions:[]} as unknown as DnevnikData;
    const selected = selectAssistantContext(data, "Найди микрофон");
    expect(selected.entries.total).toBe(200);
    expect(selected.entries.shown).toBe(35);
    expect(selected.entries.items[0].id).toBe("199");
  });
  it("provides document and calendar metadata without card codes or attachments", () => {
    const data = {entries:[], projects:[], spaces:[], calendarEvents:[{id:"event",title:"Встреча",startDate:"2026-11-01",allDay:true}], importantDates:[], documents:[{id:"d",title:"Паспорт",owner:"me",attachments:[{name:"secret"}]}], loyaltyCards:[{id:"c",title:"Магазин",owner:"me",barcodeValue:"secret-code"}], sharedPlans:[], savingsGoals:[], financeTransactions:[], planTransactions:[]} as unknown as DnevnikData;
    const result = selectAssistantContext(data,"встреча");
    expect(result.calendarEvents.items[0].title).toBe("Встреча");
    expect(JSON.stringify(result)).not.toContain("secret");
  });
  it("prioritizes purchases even when purchase names do not contain the word купить", () => {
    const tasks = Array.from({length: 40}, (_, id) => ({id:String(id),title:`Задача ${id}`,kind:"task",status:"active",priority:"normal",schedule:"none",projectPath:[],createdAt:"",updatedAt:""}));
    const data = {entries:[...tasks,{...tasks[0],id:"milk",kind:"purchase",title:"Молоко"}], projects:[], spaces:[], calendarEvents:[], importantDates:[], documents:[], loyaltyCards:[], sharedPlans:[], savingsGoals:[], financeTransactions:[], planTransactions:[]} as unknown as DnevnikData;
    expect(selectAssistantContext(data,"Что надо купить?").entries.items.some(item => item.id === "milk")).toBe(true);
  });
});
