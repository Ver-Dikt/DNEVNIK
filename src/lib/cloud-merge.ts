const collectionKeys = [
  "entries",
  "spaces",
  "projects",
  "members",
  "financeTransactions",
  "savingsGoals",
  "sharedPlans",
  "planTransactions",
  "importantDates",
  "calendarEvents",
  "documents",
  "loyaltyCards",
  "learnedRules"
] as const;

type CollectionKey = (typeof collectionKeys)[number];
type JsonRecord = Record<string, unknown>;

export interface CloudSyncMetadata {
  schema: 1;
  deleted: Partial<Record<CollectionKey, Record<string, string>>>;
}

export interface CloudKnownState {
  knownIds: Partial<Record<CollectionKey, string[]>>;
  deleted: CloudSyncMetadata["deleted"];
}

export function prepareLocalSnapshot(local: JsonRecord, known: CloudKnownState | null, now: string): JsonRecord {
  if (!known) return { ...local, sync: normalizeMetadata(local.sync) };
  const deleted = mergeDeleted(known.deleted, normalizeMetadata(local.sync).deleted);
  for (const key of collectionKeys) {
    const current = new Set(records(local[key]).map(recordId).filter((id): id is string => Boolean(id)));
    for (const id of known.knownIds[key] ?? []) {
      if (!current.has(id)) (deleted[key] ??= {})[id] = now;
    }
  }
  return { ...local, sync: { schema: 1, deleted } satisfies CloudSyncMetadata };
}

export function mergeCloudSnapshots(local: JsonRecord, remote: JsonRecord, now: string): JsonRecord {
  const localTime = snapshotTime(local);
  const remoteTime = snapshotTime(remote);
  const newest = remoteTime > localTime ? remote : local;
  const older = newest === local ? remote : local;
  const deleted = mergeDeleted(normalizeMetadata(local.sync).deleted, normalizeMetadata(remote.sync).deleted);
  const merged: JsonRecord = { ...older, ...newest };

  for (const key of collectionKeys) {
    merged[key] = mergeCollection(records(local[key]), records(remote[key]), deleted[key] ?? {}, localTime, remoteTime);
  }

  merged.draft = pickTimestamped(local.draft, remote.draft, localTime, remoteTime);
  merged.preview = pickTimestamped(local.preview, remote.preview, localTime, remoteTime);
  merged.knowledge = mergeKnowledge(local.knowledge, remote.knowledge, localTime, remoteTime);
  merged.version = String(Math.max(Number(local.version) || 0, Number(remote.version) || 0, 5));
  merged.exportedAt = now;
  merged.sync = { schema: 1, deleted } satisfies CloudSyncMetadata;
  return merged;
}

export function cloudKnownState(snapshot: JsonRecord): CloudKnownState {
  return {
    knownIds: Object.fromEntries(collectionKeys.map(key => [key, records(snapshot[key]).map(recordId).filter((id): id is string => Boolean(id))])) as CloudKnownState["knownIds"],
    deleted: normalizeMetadata(snapshot.sync).deleted
  };
}

export function sameSnapshotContent(left: JsonRecord, right: JsonRecord): boolean {
  return JSON.stringify(withoutSyncEnvelope(left)) === JSON.stringify(withoutSyncEnvelope(right));
}

function mergeCollection(local: JsonRecord[], remote: JsonRecord[], deleted: Record<string, string>, localSnapshotTime: string, remoteSnapshotTime: string): JsonRecord[] {
  const localById = new Map(local.map(item => [recordId(item), item]).filter((pair): pair is [string, JsonRecord] => Boolean(pair[0])));
  const remoteById = new Map(remote.map(item => [recordId(item), item]).filter((pair): pair is [string, JsonRecord] => Boolean(pair[0])));
  const ids = new Set([...localById.keys(), ...remoteById.keys()]);
  const result: JsonRecord[] = [];
  for (const id of ids) {
    const localItem = localById.get(id);
    const remoteItem = remoteById.get(id);
    const item = pickRecord(localItem, remoteItem, localSnapshotTime, remoteSnapshotTime);
    if (!item) continue;
    const tombstone = deleted[id];
    if (tombstone && tombstone >= recordTime(item, item === localItem ? localSnapshotTime : remoteSnapshotTime)) continue;
    result.push(item);
  }
  return result.sort((a, b) => recordTime(b, "").localeCompare(recordTime(a, "")) || String(recordId(a)).localeCompare(String(recordId(b))));
}

function pickRecord(local: JsonRecord | undefined, remote: JsonRecord | undefined, localSnapshotTime: string, remoteSnapshotTime: string): JsonRecord | undefined {
  if (!local) return remote;
  if (!remote) return local;
  const localRevision = Number(local.revision) || 0;
  const remoteRevision = Number(remote.revision) || 0;
  if (localRevision !== remoteRevision) return localRevision > remoteRevision ? local : remote;
  const localTime = recordTime(local, localSnapshotTime);
  const remoteTime = recordTime(remote, remoteSnapshotTime);
  return remoteTime > localTime ? remote : local;
}

function pickTimestamped(local: unknown, remote: unknown, localFallback: string, remoteFallback: string): unknown {
  if (local == null) return remote ?? null;
  if (remote == null) return local;
  const localTime = isRecord(local) && typeof local.timestamp === "string" ? local.timestamp : localFallback;
  const remoteTime = isRecord(remote) && typeof remote.timestamp === "string" ? remote.timestamp : remoteFallback;
  return remoteTime > localTime ? remote : local;
}

function mergeKnowledge(local: unknown, remote: unknown, localTime: string, remoteTime: string): unknown {
  const localRecord = isRecord(local) ? local : {};
  const remoteRecord = isRecord(remote) ? remote : {};
  const newest = remoteTime > localTime ? remoteRecord : localRecord;
  const corrections = mergeCollection(records(localRecord.corrections), records(remoteRecord.corrections), {}, localTime, remoteTime);
  return { ...localRecord, ...remoteRecord, ...newest, corrections };
}

function mergeDeleted(...sources: Array<CloudSyncMetadata["deleted"] | undefined>): CloudSyncMetadata["deleted"] {
  const result: CloudSyncMetadata["deleted"] = {};
  for (const source of sources) {
    for (const key of collectionKeys) {
      for (const [id, deletedAt] of Object.entries(source?.[key] ?? {})) {
        if (typeof deletedAt === "string" && deletedAt > (result[key]?.[id] ?? "")) (result[key] ??= {})[id] = deletedAt;
      }
    }
  }
  return result;
}

function normalizeMetadata(value: unknown): CloudSyncMetadata {
  if (!isRecord(value) || !isRecord(value.deleted)) return { schema: 1, deleted: {} };
  const deleted: CloudSyncMetadata["deleted"] = {};
  for (const key of collectionKeys) {
    const source = value.deleted[key];
    if (!isRecord(source)) continue;
    deleted[key] = Object.fromEntries(Object.entries(source).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  }
  return { schema: 1, deleted };
}

function withoutSyncEnvelope(value: JsonRecord): JsonRecord {
  const copy = { ...value };
  delete copy.exportedAt;
  delete copy.sync;
  return copy;
}

function snapshotTime(value: JsonRecord): string {
  return typeof value.exportedAt === "string" ? value.exportedAt : "";
}

function recordTime(value: JsonRecord, fallback: string): string {
  for (const key of ["updatedAt", "timestamp", "createdAt", "date"]) {
    if (typeof value[key] === "string") return value[key];
  }
  return fallback;
}

function recordId(value: JsonRecord): string | undefined {
  return typeof value.id === "string" && value.id ? value.id : undefined;
}

function records(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
