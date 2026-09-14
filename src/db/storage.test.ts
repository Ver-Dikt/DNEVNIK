import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("localStorage", new MemoryStorage());
  vi.stubGlobal("indexedDB", new IDBFactory());
});
afterEach(() => vi.unstubAllGlobals());

describe("persistent data recovery", () => {
  it("loads and saves when localStorage is prohibited", async () => {
    vi.stubGlobal("localStorage", { getItem() { throw new Error("SecurityError"); } });
    const db = await import("./index");
    expect((await db.loadDnevnikData()).usingFallback).toBe(false);
    await db.saveDraftDb({ quickText: "Не потерять диктовку", source: "voice", timestamp: "2026-09-12" });
    expect((await db.loadDnevnikData()).data.draft?.quickText).toBe("Не потерять диктовку");
  });
  it("finishes startup when both browser stores are prohibited", async () => {
    vi.stubGlobal("localStorage", { getItem() { throw new Error("SecurityError"); } });
    vi.stubGlobal("indexedDB", { open() { throw new Error("SecurityError"); } });
    const result = await (await import("./index")).loadDnevnikData();
    expect(result.usingFallback).toBe(true);
    expect(result.warning).toBeTruthy();
    expect(result.data.entries).toEqual([]);
  });
  it("does not erase IndexedDB if the local migration marker is cleared", async () => {
    const db = await import("./index");
    await db.loadDnevnikData();
    await db.saveDraftDb({ quickText: "Важная мысль", source: "typing", timestamp: "2026-09-12" });
    localStorage.removeItem("dnevnik.indexeddb.migration.v1");
    expect((await db.loadDnevnikData()).data.draft?.quickText).toBe("Важная мысль");
  });
  it("imports modern finance fields into the fallback mirror", async () => {
    const storage = await import("../lib/storage");
    const transaction = { id: "t", type: "savings_deposit", amount: 1200, currency: "RUB", createdAt: "2026-09-12" };
    expect(storage.importDnevnikData({ entries: [], financeTransactions: [transaction], savingsGoals: [], draft: { quickText: "Черновик", source: "typing", timestamp: "2026-09-12" } })).toBe(true);
    expect(storage.loadFinanceTransactions()).toEqual([transaction]);
    expect(storage.loadDraft()?.quickText).toBe("Черновик");
  });
  it("still imports legacy finance names", async () => {
    const storage = await import("../lib/storage");
    const transaction = { id: "t", amount: 42 };
    expect(storage.importDnevnikData({ entries: [], finance: [transaction], savings: [] })).toBe(true);
    expect(storage.loadFinanceTransactions()).toEqual([transaction]);
  });
  it("rejects invalid entries before changing the current data", async () => {
    const storage = await import("../lib/storage");
    localStorage.setItem("dnevnik.entries", '[{"id":"keep"}]');
    expect(storage.importDnevnikData({ entries: [null] })).toBe(false);
    expect(localStorage.getItem("dnevnik.entries")).toBe('[{"id":"keep"}]');
  });
  it("reports transaction failures instead of silently losing the save", async () => {
    const db = await import("./index");
    await db.loadDnevnikData();
    const onError = vi.fn();
    window.addEventListener("dnevnik:save-error", onError);
    await db.saveEntriesDb([{ title: "No ID" }] as never);
    expect(onError).toHaveBeenCalledOnce();
  });
});

it("aborts a failed replacement without deleting previously saved entries", async () => {
  const db = await import("./index");
  await db.loadDnevnikData();
  const saved = { id: "keep", title: "Keep this entry" };
  await db.saveEntriesDb([saved] as never);
  await db.saveEntriesDb([{ title: "Missing key" }] as never);
  expect((await db.loadDnevnikData()).data.entries).toEqual([saved]);
});

it("restores attachments and draft in one committed snapshot", async () => {
  const db = await import("./index");
  await db.loadDnevnikData();
  await db.restoreDnevnikData({entries:[],draft:{quickText:"Новый черновик",source:"typing",timestamp:"2026-09-14"},documents:[{id:"doc",title:"Билет",attachments:[{blob:new Blob(["PDF"],{type:"application/pdf"})}]}]});
  const restored = (await db.loadDnevnikData()).data;
  expect(restored.draft?.quickText).toBe("Новый черновик");
  expect(await restored.documents[0].attachments[0].blob?.text()).toBe("PDF");
});
it("rolls back every collection when a later store cannot be cloned", async () => {
  const db=await import("./index"); await db.loadDnevnikData();
  await db.saveDraftDb({quickText:"Сохранить",source:"typing",timestamp:"2026-09-14"});
  await db.saveEntriesDb([{id:"keep",title:"Старое",kind:"note"}] as never);
  await expect(db.restoreDnevnikData({entries:[],draft:null,documents:[{id:"bad",attachments:[],uncloneable:()=>{}}]})).rejects.toThrow();
  const restored=(await db.loadDnevnikData()).data;
  expect(restored.entries[0].id).toBe("keep");expect(restored.draft?.quickText).toBe("Сохранить");
});
it("restores without access to localStorage", async () => {
  vi.stubGlobal("localStorage",{getItem(){throw new Error("blocked");},setItem(){throw new Error("blocked");}});
  const db=await import("./index");
  await db.restoreDnevnikData({entries:[],draft:{quickText:"Без зеркала",source:"typing",timestamp:"2026-09-14"}});
  expect((await db.loadDnevnikData()).data.draft?.quickText).toBe("Без зеркала");
});
it("rejects duplicate IDs before import can lose a record", async () => {
  const db=await import("./index");
  await expect(db.restoreDnevnikData({entries:[{id:"same",title:"A",kind:"note"},{id:"same",title:"B",kind:"note"}]})).rejects.toThrow();
});
