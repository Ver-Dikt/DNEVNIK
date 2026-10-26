import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { commitCloudSnapshot } from "./cloud-sync";
import { cloudKnownState } from "./cloud-merge";

const first = { id: "phone", title: "Телефон", updatedAt: "2026-10-25T10:00:00.000Z" };
const second = { id: "computer", title: "Компьютер", updatedAt: "2026-10-26T10:00:00.000Z" };

function fakeClient(conflict = false) {
  let row = { data: { entries: [first] }, updated_at: "2026-10-25T10:00:00.000Z" };
  let writes = 0;
  const client = {
    from() {
      let patch: typeof row | undefined;
      const query = {
        select: () => query,
        eq: () => query,
        update: (value: typeof row) => { patch = value; return query; },
        maybeSingle: async () => {
          if (!patch) return { data: row, error: null };
          writes++;
          if (conflict && writes === 1) {
            row = { data: { entries: [first, { ...first, id: "other-device", title: "Другое устройство" }] }, updated_at: "2026-10-26T09:00:00.000Z" };
            return { data: null, error: null };
          }
          row = patch;
          return { data: { user_id: "user" }, error: null };
        }
      };
      return query;
    }
  } as unknown as SupabaseClient;
  return { client, writes: () => writes };
}

describe("cloud compare-and-swap", () => {
  it("does not rewrite an unchanged snapshot on every poll", async () => {
    const mock = fakeClient();
    const first = await commitCloudSnapshot(mock.client,"user",async()=>({entries:[second]}),null,()=>true);
    await commitCloudSnapshot(mock.client,"user",async()=>first.merged,cloudKnownState(first.merged),()=>true);
    expect(mock.writes()).toBe(1);
  });
  it("still commits deletions and their tombstones", async () => {
    const mock = fakeClient();
    const first = await commitCloudSnapshot(mock.client,"user",async()=>({entries:[second]}),null,()=>true);
    const next = await commitCloudSnapshot(mock.client,"user",async()=>({...first.merged,entries:[]}),cloudKnownState(first.merged),()=>true);
    expect(mock.writes()).toBe(2);
    expect(next.merged.entries).toEqual([]);
  });
  it("merges both devices before committing", async () => {
    const { client } = fakeClient();
    const result = await commitCloudSnapshot(client, "user", async () => ({ entries: [second] }), null, () => true);
    expect((result.merged.entries as Array<{ id: string }>).map(item => item.id).sort()).toEqual(["computer", "phone"]);
  });

  it("retries a concurrent write and preserves that device's new record", async () => {
    const mock = fakeClient(true);
    const result = await commitCloudSnapshot(mock.client, "user", async () => ({ entries: [second] }), null, () => true);
    expect(mock.writes()).toBe(2);
    expect((result.merged.entries as Array<{ id: string }>).map(item => item.id).sort()).toEqual(["computer", "other-device", "phone"]);
  });

  it("aborts if the signed-in account changes", async () => {
    const mock = fakeClient();
    await expect(commitCloudSnapshot(mock.client, "user", async () => ({ entries: [] }), null, () => false)).rejects.toThrow("Account changed");
    expect(mock.writes()).toBe(0);
  });
});
