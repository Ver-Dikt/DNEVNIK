import { parseSmartInput } from "./smart-parser";
import { expect,it } from "vitest";
import { normalizeWebLink } from "./web-link";
import { normalizeInput } from "./smart-parser/normalizer";
import { splitIntoSegments } from "./smart-parser/tokenizer";
import { detectIntent } from "./smart-parser/intent-detector";
import { detectDomain } from "./smart-parser/domain-detector";
it("normalizes a bare domain and pasted share text",()=>{expect(normalizeWebLink("ozon.ru/product/Test")).toBe("https://ozon.ru/product/Test");expect(normalizeWebLink("Посмотри https://example.com/Item?Key=AbC&x=1")).toBe("https://example.com/Item?Key=AbC&x=1");});
it("rejects scripts and embedded credentials",()=>{expect(normalizeWebLink("javascript:alert(1)")).toBeUndefined();expect(normalizeWebLink("https://user:pass@example.com")).toBeUndefined();});
it("preserves case and query delimiters through speech/text parser",()=>{const url="https://example.com/Item?Key=AbC&x=1";const normalized=normalizeInput("В хотелки "+url).normalized;expect(splitIntoSegments(normalized)).toEqual(["в хотелки "+url]);});
it("keeps separate dictated lines separate",()=>expect(splitIntoSegments(normalizeInput("купить молоко\nпозвонить маме").normalized)).toHaveLength(2));
it("honors explicitly named lists",()=>{expect(detectIntent("хочу потом купить кресло").intent).toBe("wish");expect(detectIntent("в дела купить краску").intent).toBe("task");});
it("recognizes work design and explicit home context",()=>{expect(detectDomain("сделать дизайн визитки").area).toBe("Работа");expect(detectDomain("купить стол для дома").area).toBe("Дом");});

it("preserves a signed link in the final parsed entry",()=>{const url="https://example.com/Item?Key=AbC&x=1";const result=parseSmartInput("в хотелки "+url,{timezone:"Europe/Moscow",now:new Date("2026-09-14T12:00:00Z")});expect(result.items).toHaveLength(1);expect(result.items[0].url).toBe(url);expect(result.items[0].kind).toBe("wish");});
