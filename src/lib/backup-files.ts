// JSON cannot preserve Blob data by itself. Encode bytes, never temporary blob URLs.
export async function encodeBackupFiles(value: unknown): Promise<unknown> {
  if (value instanceof Blob) {
    const bytes = new Uint8Array(await value.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return { $dnevnikBlob: 1, mimeType: value.type, base64: btoa(binary) };
  }
  if (Array.isArray(value)) return Promise.all(value.map(encodeBackupFiles));
  if (value && typeof value === "object") {
    const pairs = await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await encodeBackupFiles(item)]));
    return Object.fromEntries(pairs);
  }
  return value;
}
export function decodeBackupFiles(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decodeBackupFiles);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (record.$dnevnikBlob === 1) {
      if (typeof record.base64 !== "string" || typeof record.mimeType !== "string") throw new Error("Invalid attachment");
      const binary = atob(record.base64);
      return new Blob([Uint8Array.from(binary, character => character.charCodeAt(0))], {type: record.mimeType});
    }
    return Object.fromEntries(Object.entries(record).map(([key,item]) => [key,decodeBackupFiles(item)]));
  }
  return value;
}
