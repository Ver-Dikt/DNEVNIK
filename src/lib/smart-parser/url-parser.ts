export function parseUrl(text: string): { url?: string; confidence: number } {
  const match = text.match(/(?:https?:\/\/|www\.)[^\s]+/i);
  if (!match) return { confidence: 0 };
  const raw = match[0].replace(/[),.]+$/, "");
  return {
    url: raw.startsWith("www.") ? `https://${raw}` : raw,
    confidence: 0.98
  };
}
