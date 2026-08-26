import type { ProductMetadata, ProductMetadataProvider } from "@/lib/types";

export class LocalProductMetadataProvider implements ProductMetadataProvider {
  async fetch(url: string): Promise<ProductMetadata> {
    const parsed = parseUrl(url);
    if (!parsed) return {};
    try {
      const response = await fetch("/api/product-metadata", {
        body: JSON.stringify({ url }),
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
