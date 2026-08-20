import { describe, expect, it } from "vitest";
import { MockAIProvider } from "@/lib/mock-ai";

const provider = new MockAIProvider();

describe("MockAIProvider", () => {
  it("parses purchases with quantity and rub price", async () => {
    const result = await provider.parseInbox({
      text: "Завтра надо заказать XLR кабель, два штуки, видел по 1500 рублей.",
      timezone: "Europe/Moscow"
    });

    expect(result.items[0]?.kind).toBe("purchase");
    expect(result.items[0]?.unitPrice).toBe(1500);
    expect(result.items[0]?.currency).toBe("RUB");
    expect(result.items[0]?.schedule).toBe("tomorrow");
  });

  it("marks unclear equipment notes for review", async () => {
    const result = await provider.parseInbox({
      text: "Посмотреть эту штуку на аппарате.",
      timezone: "Europe/Moscow"
    });

    expect(result.needsReview).toBe(true);
    expect(result.items[0]?.needsReview).toBe(true);
  });

  it("detects studio ideas", async () => {
    const result = await provider.parseInbox({
      text: "Идея: сделать подсветку за монитором в студии.",
      timezone: "Europe/Moscow"
    });

    expect(result.items[0]?.kind).toBe("idea");
    expect(result.items[0]?.projectPath).toContain("Студия");
  });
});
