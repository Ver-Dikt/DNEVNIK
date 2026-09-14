import { afterEach,expect,it,vi } from "vitest";
import { LocalProductMetadataProvider } from "./product-metadata";
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
it("does not call a missing server on GitHub Pages",async()=>{vi.stubEnv("NEXT_PUBLIC_BASE_PATH","/DNEVNIK");const request=vi.fn();vi.stubGlobal("fetch",request);expect(await new LocalProductMetadataProvider().fetch("example.com/Item")).toEqual({store:"example.com"});expect(request).not.toHaveBeenCalled();});
it("preserves a usable link when metadata network fails",async()=>{vi.stubEnv("NEXT_PUBLIC_BASE_PATH","");vi.stubGlobal("fetch",vi.fn().mockRejectedValue(new Error("offline")));expect(await new LocalProductMetadataProvider().fetch("https://example.com/Item")).toEqual({store:"example.com"});});
