import type { SupabaseClient } from "@supabase/supabase-js";
import { decodeBackupFiles, encodeBackupFiles } from "./backup-files";
import { mergeCloudSnapshots, prepareLocalSnapshot, sameSnapshotContent, type CloudKnownState } from "./cloud-merge";

type Snapshot = Record<string, unknown>;

/** Compare-and-swap prevents two devices from overwriting the same snapshot. */
export async function commitCloudSnapshot(client: SupabaseClient, userId: string, getLocal: () => Promise<Snapshot>, known: CloudKnownState | null, isCurrent: () => boolean) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: row, error } = await client.from("app_state").select("data, updated_at").eq("user_id", userId).maybeSingle();
    if (error) throw error;
    if (!isCurrent()) throw new Error("Account changed during sync");
    const local = await getLocal();
    const now = new Date(Math.max(Date.now(), Date.parse(row?.updated_at ?? "") + 1 || 0)).toISOString();
    const prepared = prepareLocalSnapshot(local, known, now);
    const remote = decodeBackupFiles(row?.data ?? {}) as Snapshot;
    const localForMerge = !known && Array.isArray(remote.entries) && remote.entries.length ? { ...prepared, exportedAt: "" } : prepared;
    const merged = mergeCloudSnapshots(localForMerge, remote, now);
    const encoded = await encodeBackupFiles(merged);
    if (!isCurrent()) throw new Error("Account changed during sync");
    if (row && encoded && typeof encoded === "object" && row.data && typeof row.data === "object" && sameSnapshotContent(encoded as Snapshot, row.data as Snapshot) && sameSnapshotContent({ metadata: (encoded as Snapshot).sync }, { metadata: (row.data as Snapshot).sync })) return { local, merged };
    const result = row
      ? await client.from("app_state").update({ data: encoded, updated_at: now }).eq("user_id", userId).eq("updated_at", row.updated_at).select("user_id").maybeSingle()
      : await client.from("app_state").insert({ user_id: userId, data: encoded, updated_at: now }).select("user_id").maybeSingle();
    if (result.error) {
      if (!row && result.error.code === "23505") continue;
      throw result.error;
    }
    if (result.data) return { local, merged };
    // Another device saved after our read. Read again and merge both changes.
  }
  throw new Error("Cloud snapshot changed repeatedly; retry sync");
}
