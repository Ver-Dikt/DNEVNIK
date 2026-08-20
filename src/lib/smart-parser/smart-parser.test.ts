import { describe, expect, it } from "vitest";
import { parseSmartInput } from "@/lib/smart-parser";

const now = new Date("2026-08-20T10:00:00.000Z");
const ctx = { timezone: "Europe/Moscow", now };

describe("parseSmartInput", () => {
  const cases = [
    ["Завтра надо заказать XLR кабель, две штуки, видел по 1500 рублей.", "purchase"],
    ["По гардеробу надо поменять петли и поставить новые ручки. Не срочно, в этом месяце.", "task"],
    ["Идея: сделать подсветку за монитором в студии.", "idea"],
    ["Вот эти петли хочу купить https://example.com/product, стоят 790 рублей.", "purchase"],
    ["Когда-нибудь надо поменять стол в студии.", "task"],
    ["Посмотреть эту штуку на аппарате.", "task"],
    ["Купить 5060 Ti, видел за 48 тысяч.", "purchase"],
    ["Жду ответ от магазина по шкафу.", "task"],
    ["Не забыть отправить трек Андрею до пятницы.", "task"],
    ["Прикольно было бы сделать новый свет в студии.", "idea"],
    ["Надо взять 5 метров кабеля по 490 рублей.", "purchase"],
    ["Купить 12 ручек по 490 руб.", "purchase"],
    ["Заказать потом пару креплений.", "purchase"],
    ["Проверить ремонт на выходных.", "task"],
    ["Позвонить электрику вечером.", "task"],
    ["После пятницы посмотреть шкаф.", "task"],
    ["Через три недели поменять стол.", "task"],
    ["Ссылка на шкаф www.example.com/item", "inbox"],
    ["Запиши мысль сделать акустику в студии.", "idea"],
    ["Найти где купить кабель за $20.", "purchase"],
    ["Присмотреть монитор за 500 евро.", "purchase"],
    ["Взять адаптер за 500 NOK.", "purchase"],
    ["Доделать README сегодня.", "task"],
    ["Срочно отправить счет.", "task"],
    ["ну короче надо наверное купить четыре петли где-то по семьсот рублей", "purchase"]
  ] as const;

  it.each(cases)("detects kind for %s", (text, expected) => {
    const result = parseSmartInput(text, ctx);
    expect(result.items[0]?.kind).toBe(expected);
  });

  it("splits mixed dictation into multiple items", () => {
    const result = parseSmartInput("Завтра надо купить кабель, Андрею отправить трек и еще идея сделать новый свет в студии.", ctx);
    expect(result.items.length).toBeGreaterThanOrEqual(3);
    expect(result.items.map((item) => item.kind)).toContain("purchase");
    expect(result.items.map((item) => item.kind)).toContain("idea");
  });

  it("extracts quantity and unit price", () => {
    const result = parseSmartInput("Купить 12 ручек по 490 рублей.", ctx);
    expect(result.items[0]?.quantity).toBe(12);
    expect(result.items[0]?.unitPrice).toBe(490);
    expect(result.items[0]?.totalPrice).toBe(5880);
  });

  it("keeps unclear input for review", () => {
    const result = parseSmartInput("Вот это потом как-нибудь.", ctx);
    expect(result.needsReview).toBe(true);
  });

  it("matches project aliases", () => {
    const result = parseSmartInput("По шкафу надо поменять петли.", ctx);
    expect(result.items[0]?.projectPath).toEqual(["Дом", "Ремонт", "Гардероб"]);
  });
});
