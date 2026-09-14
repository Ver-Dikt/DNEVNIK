import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

function setup() {
  const handlers: Record<string, (event: Record<string, unknown>) => void> = {};
  const cache = { addAll: vi.fn().mockResolvedValue(undefined), match: vi.fn().mockResolvedValue(new Response('<script src="/DNEVNIK/_next/static/app.js"></script><link href="/DNEVNIK/_next/static/style.css">')), put: vi.fn() };
  const caches = { open: vi.fn().mockResolvedValue(cache), keys: vi.fn().mockResolvedValue(["other-app", "dnevnik-v12", "dnevnik-v17-final"]), delete: vi.fn().mockResolvedValue(true), match: vi.fn().mockResolvedValue(undefined) };
  const self = { registration: { scope: "https://example.com/DNEVNIK/" }, location: { origin: "https://example.com" }, skipWaiting: vi.fn(), clients: { claim: vi.fn() }, addEventListener: (name: string, callback: typeof handlers[string]) => { handlers[name] = callback; } };
  runInNewContext(readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8"), { self, caches, URL, Request, Response, fetch: vi.fn() });
  return { handlers, cache, caches, self };
}

describe("PWA updates", () => {
  it("preloads the application scripts and styles without forcing an update", async () => {
    const { handlers, cache, self } = setup();
    let done: Promise<void> | undefined;
    handlers.install({ waitUntil: (promise: Promise<void>) => { done = promise; } });
    await done;
    expect(cache.addAll).toHaveBeenCalledTimes(2);
    expect(cache.addAll.mock.calls[1][0].map((request: Request) => request.url)).toEqual(["https://example.com/DNEVNIK/_next/static/app.js", "https://example.com/DNEVNIK/_next/static/style.css"]);
    expect(self.skipWaiting).not.toHaveBeenCalled();
  });
  it("does not delete other applications' caches", async () => {
    const { handlers, caches } = setup();
    let done: Promise<void> | undefined;
    handlers.activate({ waitUntil: (promise: Promise<void>) => { done = promise; } });
    await done;
    expect(caches.delete).toHaveBeenCalledExactlyOnceWith("dnevnik-v12");
  });
  it("does not intercept API or third party requests", () => {
    const { handlers } = setup();
    const respondWith = vi.fn();
    for (const url of ["https://example.com/api/ai/parse", "https://other.example/asset.js"]) {
      handlers.fetch({ request: new Request(url), respondWith });
    }
    expect(respondWith).not.toHaveBeenCalled();
  });
});
