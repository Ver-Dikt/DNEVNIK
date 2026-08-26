import { NextResponse } from "next/server";
import type { ProductMetadata } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { url?: string };
  const url = body.url;
  if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  if (!["http:", "https:"].includes(target.protocol)) {
    return NextResponse.json({ error: "Unsupported protocol" }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6500);
    const response = await fetch(target.toString(), {
      headers: {
        "accept": "text/html,application/xhtml+xml",
        "accept-language": "ru,en;q=0.9",
        "user-agent": "Mozilla/5.0 DNEVNIK local product preview"
      },
      redirect: "follow",
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return NextResponse.json({ store: storeFromUrl(target), warning: "Metadata fetch failed" }, { status: 200 });
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      return NextResponse.json({ store: storeFromUrl(target), warning: "Unsupported content type" }, { status: 200 });
    }

    const html = await response.text();
    const metadata = extractProductMetadata(html, target);
    return NextResponse.json(metadata);
  } catch {
    return NextResponse.json({ store: storeFromUrl(target), warning: "Metadata unavailable" }, { status: 200 });
  }
}

function extractProductMetadata(html: string, target: URL): ProductMetadata {
  const jsonLd = extractJsonLd(html);
  const title = first(
    jsonLd.title,
    meta(html, "property", "og:title"),
    meta(html, "name", "twitter:title"),
    titleTag(html)
  );
  const imageUrl = absoluteUrl(first(
    jsonLd.imageUrl,
    meta(html, "property", "og:image"),
    meta(html, "name", "twitter:image")
  ), target);
  const price = firstNumber(
    jsonLd.price,
    meta(html, "property", "product:price:amount"),
    meta(html, "property", "og:price:amount"),
    meta(html, "name", "price"),
    html.match(/"price"\s*:\s*"?([0-9]+(?:[.,][0-9]+)?)/i)?.[1]
  );
  const currency = first(
    jsonLd.currency,
    meta(html, "property", "product:price:currency"),
    meta(html, "property", "og:price:currency"),
    meta(html, "name", "priceCurrency")
  );

  return {
    title,
    imageUrl,
    price,
    currency,
    store: storeFromUrl(target)
  };
}

function extractJsonLd(html: string): ProductMetadata {
  const scripts = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  for (const script of scripts) {
    const raw = script.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "").trim();
    try {
      const parsed = JSON.parse(raw) as unknown;
      const product = findProduct(parsed);
      if (!product) continue;
      const productRecord = product as Record<string, unknown>;
      const offers = Array.isArray(productRecord.offers) ? productRecord.offers[0] : productRecord.offers;
      const offerRecord = offers && typeof offers === "object" ? offers as Record<string, unknown> : {};
      const image = Array.isArray(productRecord.image) ? productRecord.image[0] : productRecord.image;
      return {
        title: typeof productRecord.name === "string" ? productRecord.name : undefined,
        imageUrl: typeof image === "string" ? image : undefined,
        price: typeof offerRecord.price === "number" ? offerRecord.price : typeof offerRecord.price === "string" ? Number(offerRecord.price.replace(",", ".")) : undefined,
        currency: typeof offerRecord.priceCurrency === "string" ? offerRecord.priceCurrency : undefined
      };
    } catch {
      continue;
    }
  }
  return {};
}

function findProduct(value: unknown): unknown {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const product = findProduct(item);
      if (product) return product;
    }
    return null;
  }
  const record = value as Record<string, unknown>;
  const type = record["@type"];
  if (type === "Product" || (Array.isArray(type) && type.includes("Product"))) return record;
  return findProduct(record["@graph"]);
}

function meta(html: string, attr: "name" | "property", key: string): string | undefined {
  const pattern = new RegExp(`<meta[^>]+${attr}=["']${escapeRegExp(key)}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i");
  return decodeHtml(html.match(pattern)?.[1]);
}

function titleTag(html: string): string | undefined {
  return decodeHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim());
}

function absoluteUrl(value: string | undefined, base: URL): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value, base).toString();
  } catch {
    return value;
  }
}

function first(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => Boolean(value?.trim()))?.trim();
}

function firstNumber(...values: Array<number | string | undefined>): number | undefined {
  for (const value of values) {
    const parsed = typeof value === "number" ? value : Number(value?.replace(/[^\d,.]/g, "").replace(",", "."));
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return undefined;
}

function decodeHtml(value?: string): string | undefined {
  if (!value) return undefined;
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function storeFromUrl(url: URL): string {
  return url.hostname.replace(/^www\./, "");
}
