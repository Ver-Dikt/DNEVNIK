import { describe, expect, it } from "vitest";
import { cloudKnownState, mergeCloudSnapshots, prepareLocalSnapshot, sameSnapshotContent } from "./cloud-merge";

const old = "2026-09-20T10:00:00.000Z";
const recent = "2026-09-21T10:00:00.000Z";
const now = "2026-09-22T10:00:00.000Z";

describe("cloud snapshot merge", () => {
  it("never lets an empty computer erase phone records", () => {
    const phone = { version: "5", exportedAt: recent, entries: [{ id: "phone", title: "С телефона", updatedAt: recent }] };
    const computer = { version: "5", exportedAt: now, entries: [] };
    expect(mergeCloudSnapshots(computer, phone, now).entries).toEqual(phone.entries);
  });

  it("combines records created on different devices", () => {
    const phone = { exportedAt: recent, entries: [{ id: "phone", title: "Телефон", updatedAt: recent }] };
    const computer = { exportedAt: now, entries: [{ id: "computer", title: "Компьютер", updatedAt: now }] };
    const ids = (mergeCloudSnapshots(computer, phone, now).entries as Array<{ id: string }>).map(item => item.id);
    expect(ids).toEqual(["computer", "phone"]);
  });

  it("keeps the newer revision of the same record", () => {
    const local = { exportedAt: now, entries: [{ id: "same", title: "Новое", revision: 3, updatedAt: now }] };
    const remote = { exportedAt: recent, entries: [{ id: "same", title: "Старое", revision: 2, updatedAt: recent }] };
    expect((mergeCloudSnapshots(local, remote, now).entries as Array<{ title: string }>)[0].title).toBe("Новое");
  });

  it("propagates a deletion after the device has seen the record", () => {
    const known = cloudKnownState({ entries: [{ id: "done" }] });
    const prepared = prepareLocalSnapshot({ exportedAt: now, entries: [] }, known, now);
    const remote = { exportedAt: old, entries: [{ id: "done", title: "Удалить", updatedAt: old }] };
    expect(mergeCloudSnapshots(prepared, remote, now).entries).toEqual([]);
  });

  it("does not invent deletions on a device that has never synced", () => {
    const prepared = prepareLocalSnapshot({ exportedAt: now, entries: [] }, null, now);
    const remote = { exportedAt: recent, entries: [{ id: "phone", title: "С телефона", updatedAt: recent }] };
    expect((mergeCloudSnapshots(prepared, remote, now).entries as Array<{ id: string }>)[0].id).toBe("phone");
  });

  it("chooses the newest voice draft", () => {
    const local = { exportedAt: now, entries: [], draft: { quickText: "Новый голосовой текст", timestamp: now } };
    const remote = { exportedAt: recent, entries: [], draft: { quickText: "Старый текст", timestamp: recent } };
    expect((mergeCloudSnapshots(local, remote, now).draft as { quickText: string }).quickText).toBe("Новый голосовой текст");
  });

  it("ignores sync bookkeeping when deciding whether app data changed", () => {
    expect(sameSnapshotContent(
      { entries: [], exportedAt: old },
      { entries: [], exportedAt: now, sync: { schema: 1, deleted: {} } }
    )).toBe(true);
  });
});
