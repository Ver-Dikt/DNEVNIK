/** Accept pasted share text and bare domains; only browser-safe web URLs. */
export function normalizeWebLink(input?: string): string | undefined {
  if (!input?.trim()) return undefined;
  const text = input.trim();
  const candidate = text.match(/https?:\/\/[^\s<>"«»]+/i)?.[0] ?? (/^(?:[\p{L}\p{N}-]+\.)+[\p{L}]{2,}(?::\d+)?(?:[/?#][^\s]*)?$/u.test(text) ? "https://" + text : undefined);
  if (!candidate) return undefined;
  let raw = candidate.replace(/[.,;!?]+$/, "");
  if (raw.endsWith(")") && (raw.match(/\)/g)?.length ?? 0) > (raw.match(/\(/g)?.length ?? 0)) raw = raw.slice(0,-1);
  try { const url = new URL(raw); return ["https:","http:"].includes(url.protocol) && !url.username && !url.password && !!url.hostname ? url.href : undefined; } catch { return undefined; }
}
