import { normalizeWebLink } from "@/lib/web-link";
import type { ProductMetadata, ProductMetadataProvider } from "@/lib/types";

export class LocalProductMetadataProvider implements ProductMetadataProvider {
  async fetch(url: string): Promise<ProductMetadata> {
    const normalized = normalizeWebLink(url);
    const parsed = normalized ? parseUrl(normalized) : null;
    if (!parsed) return {};
    if (process.env.NEXT_PUBLIC_BASE_PATH) return { store: storeFromUrl(parsed) };
    try {
      const response = await fetch("/api/product-metadata", {
        signal: AbortSignal.timeout(7000),
        body: JSON.stringify({ url: normalized }),
        headers: { "content-type": "application/json" },
        method: "POST"
      });
      if (!response.ok) return { store: storeFromUrl(parsed) };
      const metadata = await response.json() as ProductMetadata;
      return { store: storeFromUrl(parsed), ...metadata };
    } catch {
      return { store: storeFromUrl(parsed) };
    }
  }
}

export class FutureRemoteProductMetadataProvider implements ProductMetadataProvider {
  constructor(private readonly endpoint: string) {}

  async fetch(url: string): Promise<ProductMetadata> {
    const response = await fetch(`${this.endpoint}?url=${encodeURIComponent(url)}`);
    if (!response.ok) throw new Error("Product metadata service failed");
    return response.json() as Promise<ProductMetadata>;
  }
}

export const productMetadataProvider = new LocalProductMetadataProvider();

function parseUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function storeFromUrl(url: URL): string {
  return url.hostname.replace(/^www\./, "");
}
