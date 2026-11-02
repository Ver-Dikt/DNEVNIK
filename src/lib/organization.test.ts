import { describe, expect, it } from "vitest";
import { ensureProjectPath, normalizeKindPatch, organizeEntries, projectPathFor } from "./organization";
import { applyAssistantPlan, validateAssistantPlan } from "./assistant-actions";
import { matchProject } from "./smart-parser/project-matcher";
import type { DiaryEntry, Space } from "./types";
import { validateLocalProposal } from "./local-assistant";

const spaces: Space[] = [{ id: "home", name: "Дом", createdAt: "2026-10-27", updatedAt: "2026-10-27" }];
const entry: DiaryEntry = { id: "one", title: "Покрасить стены", kind: "task", area: "Дом", assignedTo: "me", status: "active", priority: "normal", schedule: "none", projectPath: ["Дом", "Ремонт", "Кухня"], revision: 3, createdAt: "2026-10-26", updatedAt: "2026-10-26", originalInput: "Завершить ремонт на кухне", description: "Сохранить подробности" };
describe("project hierarchy", () => {
  it("materializes every path level and reuses it idempotently", () => {
    const first = organizeEntries([entry], [], spaces);
    expect(first.projects).toHaveLength(2);
    expect(first.projects[1].parentId).toBe(first.projects[0].id);
    expect(first.entries[0].projectId).toBe(first.projects[1].id);
    expect(first.entries[0].description).toBe(entry.description);
    const second = organizeEntries(first.entries, first.projects, spaces);
    expect(second.changed).toBe(0); expect(second.addedProjects).toBe(0);
  });
  it("keeps equal names under different parents distinct", () => {
    const a = ensureProjectPath(["Дом","Кухня","Покраска"],[],spaces);
    const b = ensureProjectPath(["Дом","Зал","Покраска"],a.projects,spaces);
    expect(a.patch.projectId).not.toBe(b.patch.projectId);
  });
  it("matches full nested paths rather than only the leaf", () => {
    const result = ensureProjectPath(["Дом","Ремонт","Гардероб"],[],spaces);
    expect(matchProject("купить краску в гардероб", result.projects).projectPath).toEqual(["Дом","Ремонт","Гардероб"]);
  });
  it("rejects cycles", () => expect(() => projectPathFor({ id:"a",name:"A",parentId:"a",createdAt:"" },[{ id:"a",name:"A",parentId:"a",createdAt:"" }])).toThrow());
  it("does not guess between identical project names", () => {
    const a=ensureProjectPath(["Дом","Кухня","Покраска"],[],spaces);
    const b=ensureProjectPath(["Дом","Зал","Покраска"],a.projects,spaces);
    expect(matchProject("покраска",b.projects).projectPath).toEqual([]);
    expect(matchProject("покраска кухни",b.projects).projectPath).toEqual(["Дом","Кухня","Покраска"]);
  });
  it("removes stale work domain when moving to another section", () => expect(normalizeKindPatch({...entry,area:"Работа",domain:"work"},{area:"Школа"}).domain).toBe("general"));
  it("converts purchase state when the record changes type", () => expect(normalizeKindPatch({...entry,kind:"purchase",status:"want_to_buy"},{kind:"note"}).status).toBe("active"));
});
describe("assistant commands", () => {
  it("preserves explicit quantities, prices, ownership and project paths", () => {
    const result=validateLocalProposal({items:[{kind:"purchase",title:"Краска",sourceText:"купить 2 банки краски по 500 рублей",area:"Дом",projectPath:["Дом","Ремонт","Кухня"],assignedTo:"shared"}]},"купить 2 банки краски по 500 рублей").items[0];
    expect(result.purchase?.quantity).toBe(2);expect(result.purchase?.unitPrice).toBe(500);expect(result.purchase?.totalPrice).toBe(1000);
    expect(result.visibility).toBe("shared");expect(result.projectPath).toEqual(["Дом","Ремонт","Кухня"]);
  });
  it("updates only an existing id and preserves its source", () => {
    const plan = validateAssistantPlan({actions:[{type:"update",id:"one",patch:{priority:"high",projectPath:["Дом","Ремонт","Зал"]}}]},[entry],"перенеси в зал");
    const result = applyAssistantPlan(plan,[entry],[],spaces);
    expect(result.entries[0].originalInput).toBe(entry.originalInput);
    expect(result.entries[0].priority).toBe("high");
    expect(result.entries[0].projectPath).toEqual(["Дом","Ремонт","Зал"]);
  });
  it("refuses stale plans instead of overwriting concurrent edits", () => {
    const plan=validateAssistantPlan({actions:[{type:"update",id:"one",patch:{title:"Новое"}}]},[entry],"переименуй");
    expect(()=>applyAssistantPlan(plan,[{...entry,revision:4}],[],spaces)).toThrow(/изменилась/);
  });
  it.each(["delete","sql","shell"])("rejects unsupported or unrequested %s operations",type=>expect(()=>validateAssistantPlan({actions:[{type,id:"one",patch:{}}]},[entry],"команда")).toThrow());
  it("deletes an explicitly requested record only when its revision still matches", () => {
    const plan=validateAssistantPlan({actions:[{type:"delete",id:"one"}]},[entry],"удали запись покрасить стены");
    expect(applyAssistantPlan(plan,[entry],[],spaces).entries).toEqual([]);
    expect(()=>applyAssistantPlan(plan,[{...entry,revision:4}],[],spaces)).toThrow(/изменилась/);
  });
  it("creates a section and nested project in the same plan", () => {
    const plan=validateAssistantPlan({actions:[{type:"space",name:"Хобби"},{type:"project",path:["Хобби","Музыка"]}]},[],"создай раздел Хобби и проект Музыка");
    const result=applyAssistantPlan(plan,[],[],spaces);
    expect(result.spaces.find(item=>item.name==="Хобби")?.id).toBe(result.projects[0].spaceId);
    expect(()=>applyAssistantPlan(plan,[],[],result.spaces)).toThrow(/уже существует/);
  });
  it("updates quantity and price together without losing other purchase details", () => {
    const purchase={...entry,kind:"purchase" as const,status:"want_to_buy" as const,purchase:{status:"planned" as const,quantity:2,unitPrice:10,totalPrice:20,store:"Магазин"}};
    const plan=validateAssistantPlan({actions:[{type:"update",id:"one",patch:{quantity:3,unitPrice:15}}]},[purchase],"измени количество и цену");
    const updated=applyAssistantPlan(plan,[purchase],[],spaces).entries[0];
    expect(updated.purchase).toMatchObject({quantity:3,unitPrice:15,totalPrice:45,store:"Магазин"});
    expect(()=>validateAssistantPlan({actions:[{type:"update",id:"one",patch:{unitPrice:-1}}]},[purchase],"измени цену")).toThrow();
  });
  it("splits a saved voice record using its source without deleting it or guessing dates", () => {
    const voice={...entry,originalInput:"Купить молоко завтра. Позвонить врачу.",sourceText:"Купить молоко завтра. Позвонить врачу."};
    const raw={actions:[{type:"create",sourceEntryId:"one",patch:{kind:"purchase",title:"Молоко",sourceText:"Купить молоко завтра"}},{type:"create",sourceEntryId:"one",patch:{kind:"task",title:"Позвонить врачу",sourceText:"Позвонить врачу"}}]};
    const plan=validateAssistantPlan(raw,[voice],"разбери запись");
    const result=applyAssistantPlan(plan,[voice],[],spaces);
    expect(result.entries).toHaveLength(3);
    expect(result.entries.find(item=>item.id==="one")?.originalInput).toBe(voice.originalInput);
    expect(result.entries.find(item=>item.title==="Молоко")?.dueDate).toBeUndefined();
    expect(()=>applyAssistantPlan(plan,[{...voice,revision:4}],[],spaces)).toThrow(/изменилась/);
    expect(()=>validateAssistantPlan({actions:[{type:"create",sourceEntryId:"one",patch:{kind:"note",title:"Фантазия",sourceText:"не было"}}]},[voice],"разбери")).toThrow(/Фрагмент/);
    const omitted=validateAssistantPlan({actions:[{type:"create",sourceEntryId:"one",patch:{kind:"purchase",title:"Купить молоко"}}]},[voice],"разбери");
    expect(omitted.actions[0]).toMatchObject({entry:{sourceText:"Купить молоко"}});
    const inferred=validateAssistantPlan({actions:[{type:"create",sourceEntryId:null,patch:{kind:"purchase",title:"Купить молоко"}}]},[voice],"разбери запись Голос");
    expect(inferred.actions[0]).toMatchObject({sourceId:"one"});
    expect(()=>validateAssistantPlan({actions:[{type:"create",sourceEntryId:null,patch:{kind:"purchase",title:"Купить молоко"}}]},[voice,{...voice,id:"two"}],"разбери запись")).toThrow(/однозначно/);
  });
  it("rejects unknown ids and invalid dates", () => {
    expect(()=>validateAssistantPlan({actions:[{type:"update",id:"other",patch:{title:"X"}}]},[entry],"команда")).toThrow();
    expect(()=>validateAssistantPlan({actions:[{type:"update",id:"one",patch:{dueDate:"2026-02-31"}}]},[entry],"команда")).toThrow();
  });
  it("creates standalone nested projects", () => {
    const plan=validateAssistantPlan({actions:[{type:"project",path:["Дом","Ремонт","Кухня"]}]},[],"создай проект");
    expect(applyAssistantPlan(plan,[],[],spaces).projects).toHaveLength(2);
  });
  it("keeps purchase completion state consistent", () => {
    const purchase={...entry,kind:"purchase" as const,status:"want_to_buy" as const,purchase:{status:"planned" as const}};
    const plan=validateAssistantPlan({actions:[{type:"update",id:"one",patch:{status:"bought"}}]},[purchase],"куплено");
    expect(applyAssistantPlan(plan,[purchase],[],spaces).entries[0].purchase?.status).toBe("purchased");
  });
  it("rejects a repeated new-record plan", () => {
    const plan=validateAssistantPlan({actions:[{type:"create",patch:{kind:"note",title:"Мысль",sourceText:"Мысль"}}]},[],"Мысль");
    const once=applyAssistantPlan(plan,[],[],spaces);
    expect(()=>applyAssistantPlan(plan,once.entries,once.projects,spaces)).toThrow(/применён/);
  });
});
