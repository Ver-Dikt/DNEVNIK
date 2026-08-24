import { describe, expect, it } from "vitest";
import { parseSmartInput } from "@/lib/smart-parser";
import { defaultKnowledge, defaultSettings } from "@/lib/storage";

const now = new Date("2026-08-20T10:00:00.000Z");
const ctx = { timezone: "Europe/Moscow", now };
const familyCtx = {
  timezone: "Europe/Moscow",
  now,
  knowledge: defaultKnowledge,
  settings: defaultSettings,
  projects: [{ id: "music-grafton", name: "Grafton", area: "Музыка", aliases: ["grafton"], createdAt: now.toISOString() }]
};

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
    ["ну короче надо наверное купить четыре петли где-то по семьсот рублей", "purchase"],
    ["Завтра купить XLR два штуки по полторы тысячи", "purchase"],
    ["По ремонту гардероба надо поменять петли и заказать ручки", "task"],
    ["Идея потом сделать подсветку в шкафу", "idea"],
    ["На этой неделе проверить микшер, купить четыре потенциометра и написать Андрею", "task"],
    ["Вот ссылка на петли https://example.com стоят 790 рублей", "purchase"]
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

  it("understands spoken half-thousand price", () => {
    const result = parseSmartInput("Завтра купить XLR два штуки по полторы тысячи", ctx);
    expect(result.items[0]?.quantity).toBe(2);
    expect(result.items[0]?.unitPrice).toBe(1500);
    expect(result.items[0]?.schedule).toBe("tomorrow");
  });

  it("keeps multi-action weekly phrase useful", () => {
    const result = parseSmartInput("На этой неделе проверить микшер, купить четыре потенциометра и написать Андрею", ctx);
    expect(result.items.length).toBeGreaterThanOrEqual(2);
    expect(result.items.map((item) => item.kind)).toContain("purchase");
  });

  it("splits two paint purchases without inventing locations as tasks", () => {
    const result = parseSmartInput("Нужна банка краски для стены в коридоре и банка краски для самого гардероба.", ctx);
    expect(result.items).toHaveLength(2);
    expect(result.items.every((item) => item.kind === "purchase")).toBe(true);
    expect(result.items.some((item) => item.title.toLowerCase() === "гардероб")).toBe(false);
  });

  it("does not create a separate wardrobe task from a purchase object", () => {
    const result = parseSmartInput("Надо купить ручки и петли для гардероба.", ctx);
    expect(result.items.some((item) => item.title.toLowerCase() === "гардероб")).toBe(false);
    expect(result.items.every((item) => item.kind === "purchase")).toBe(true);
  });

  it("propagates wardrobe context across a purchase list", () => {
    const result = parseSmartInput("Для гардероба нужны ручки, петли и краска.", ctx);
    expect(result.items).toHaveLength(3);
    expect(result.items.every((item) => item.kind === "purchase")).toBe(true);
    expect(result.items.every((item) => item.projectPath.includes("Гардероб") || item.title.toLowerCase().includes("гардероб"))).toBe(true);
  });

  it("parses corridor painting as one task", () => {
    const result = parseSmartInput("Коридор покрасить на следующей неделе.", ctx);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.kind).toBe("task");
  });

  it("parses needed corridor paint as one purchase", () => {
    const result = parseSmartInput("Нужна краска для коридора.", ctx);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.kind).toBe("purchase");
  });

  it("keeps a bare noun in inbox for review", () => {
    const result = parseSmartInput("Гардероб.", ctx);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.kind).toBe("inbox");
    expect(result.needsReview).toBe(true);
  });

  it("splits a paint purchase and later painting task", () => {
    const result = parseSmartInput("Купить банку краски для гардероба, потом надо будет его покрасить.", ctx);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]?.kind).toBe("purchase");
    expect(result.items[1]?.kind).toBe("task");
    expect(result.items[1]?.title.toLowerCase()).toContain("гардероб");
  });

  it("splits purchase and later idea", () => {
    const result = parseSmartInput("Купить краску и идея потом добавить подсветку.", ctx);
    expect(result.items).toHaveLength(2);
    expect(result.items.map((item) => item.kind)).toEqual(["purchase", "idea"]);
  });

  it("detects music task and existing Grafton project", () => {
    const result = parseSmartInput("Трек Grafton надо свести.", familyCtx);
    expect(result.items[0]?.kind).toBe("task");
    expect(result.items[0]?.area).toBe("Музыка");
    expect(result.items[0]?.project).toBe("Grafton");
    expect(result.items[0]?.category).toBe("Сведение");
  });

  it("matches follow-up Grafton phrase to existing project", () => {
    const result = parseSmartInput("По Grafton ещё мастер сделать.", familyCtx);
    expect(result.items[0]?.project).toBe("Grafton");
    expect(result.items[0]?.category).toBe("Мастеринг");
  });

  it("creates a project candidate for unknown music entity", () => {
    const result = parseSmartInput("Трек Solaris надо свести.", { ...familyCtx, projects: [] });
    expect(result.items[0]?.area).toBe("Музыка");
    expect(result.items[0]?.projectCandidate).toBe("Solaris");
  });

  it("parses home paint purchase with total price", () => {
    const result = parseSmartInput("Для гардероба купить две банки краски по 1800.", familyCtx);
    expect(result.items[0]?.kind).toBe("purchase");
    expect(result.items[0]?.area).toBe("Дом");
    expect(result.items[0]?.quantity).toBe(2);
    expect(result.items[0]?.totalPrice).toBe(3600);
  });

  it("keeps paint allocation notes", () => {
    const result = parseSmartInput("Для гардероба надо купить две банки краски, одну на стену, одну на сам гардероб, по 1800 рублей каждая.", familyCtx);
    expect(result.items[0]?.notes).toContain("стену");
  });

  it("splits shared home shopping into two purchases", () => {
    const result = parseSmartInput("Нам домой надо купить порошок и туалетную бумагу.", familyCtx);
    expect(result.items).toHaveLength(2);
    expect(result.items.every((item) => item.kind === "purchase")).toBe(true);
    expect(result.items.every((item) => item.assignedTo === "shared")).toBe(true);
  });

  it("detects personal assignee and tomorrow", () => {
    const result = parseSmartInput("Мне завтра надо написать Андрею.", familyCtx);
    expect(result.items[0]?.assignedTo).toBe("me");
    expect(result.items[0]?.schedule).toBe("tomorrow");
  });

  it("detects partner assignee", () => {
    const result = parseSmartInput("Ей надо купить кабель.", familyCtx);
    expect(result.items[0]?.assignedTo).toBe("partner");
  });

  it("keeps unknown vague text in review", () => {
    const result = parseSmartInput("Там с этой штукой надо разобраться.", familyCtx);
    expect(result.needsReview).toBe(true);
  });

  it("splits music, home purchase, and idea dictation", () => {
    const result = parseSmartInput("Завтра свести Grafton, купить домой порошок и идея сделать новую подсветку в студии.", familyCtx);
    expect(result.items).toHaveLength(3);
    expect(result.items.map((item) => item.kind)).toEqual(["task", "purchase", "idea"]);
  });

  it("uses recent context for short follow-up", () => {
    const result = parseSmartInput("И ещё петли четыре штуки.", {
      ...familyCtx,
      recentContext: { area: "Дом", project: "Гардероб", domain: "home", updatedAt: new Date().toISOString() }
    });
    expect(result.items[0]?.project).toBe("Гардероб");
  });

  it("does not use expired recent context", () => {
    const result = parseSmartInput("И ещё петли четыре штуки.", {
      ...familyCtx,
      recentContext: { area: "Дом", project: "Гардероб", domain: "home", updatedAt: "2020-01-01T00:00:00.000Z" }
    });
    expect(result.items[0]?.project).not.toBe("Гардероб");
  });

  it("marks someday phrases as someday", () => {
    const result = parseSmartInput("Когда-нибудь купить новый контроллер.", familyCtx);
    expect(result.items[0]?.schedule).toBe("someday");
  });

  it("detects work area without creating random project", () => {
    const result = parseSmartInput("По работе надо проверить микшер в заведении", familyCtx);
    expect(result.items[0]?.kind).toBe("task");
    expect(result.items[0]?.area).toBe("Работа");
    expect(result.items[0]?.projectCandidate).toBeUndefined();
  });

  it("detects work tomorrow task", () => {
    const result = parseSmartInput("По работе завтра надо проверить микшер в заведении", familyCtx);
    expect(result.items[0]?.area).toBe("Работа");
    expect(result.items[0]?.schedule).toBe("tomorrow");
  });

  it("detects tomorrow client master task", () => {
    const result = parseSmartInput("Завтра отправить мастер клиенту", familyCtx);
    expect(result.items[0]?.schedule).toBe("tomorrow");
    expect(result.items[0]?.area).toBe("Работа");
  });

  it("keeps no-date music task unscheduled", () => {
    const result = parseSmartInput("Свести Grafton", familyCtx);
    expect(result.items[0]?.schedule).toBe("none");
  });

  it("parses saturday paint purchase", () => {
    const result = parseSmartInput("В субботу для гардероба купить две банки краски по 1800 рублей.", familyCtx);
    expect(result.items[0]?.kind).toBe("purchase");
    expect(result.items[0]?.dueDate).toBeTruthy();
    expect(result.items[0]?.totalPrice).toBe(3600);
  });

  it("parses three cables per-unit price", () => {
    const result = parseSmartInput("Купить три кабеля по 700", familyCtx);
    expect(result.items[0]?.quantity).toBe(3);
    expect(result.items[0]?.totalPrice).toBe(2100);
  });

  it("parses daily recurring task", () => {
    const result = parseSmartInput("Каждый день проверить календарь", familyCtx);
    expect(result.items[0]?.repeat).toBe("daily");
  });

  it("parses monthly recurring task", () => {
    const result = parseSmartInput("Каждый месяц оплачивать интернет", familyCtx);
    expect(result.items[0]?.repeat).toBe("monthly");
  });

  it("parses first day monthly recurring task", () => {
    const result = parseSmartInput("Каждого первого числа оплатить интернет", familyCtx);
    expect(result.items[0]?.repeat).toBe("monthly_first");
  });

  it("parses explicit time", () => {
    const result = parseSmartInput("Завтра в 09:30 отправить мастер клиенту", familyCtx);
    expect(result.items[0]?.time).toBe("09:30");
  });

  it("splits required v3 multi-item dictation", () => {
    const result = parseSmartInput("Завтра свести Grafton, домой купить порошок, а ещё идея для студии сделать новую подсветку.", familyCtx);
    expect(result.items).toHaveLength(3);
    expect(result.items.map((item) => item.kind)).toEqual(["task", "purchase", "idea"]);
  });

  it("parses shared home powder and food purchases", () => {
    const result = parseSmartInput("Нам домой купить порошок и корм", familyCtx);
    expect(result.items).toHaveLength(2);
    expect(result.items.every((item) => item.assignedTo === "shared")).toBe(true);
  });

  it("preserves raw text on unknown", () => {
    const result = parseSmartInput("Там с этой штукой разобраться", familyCtx);
    expect(result.items[0]?.sourceText).toContain("штукой");
    expect(result.needsReview).toBe(true);
  });

  it("detects studio idea area", () => {
    const result = parseSmartInput("Идея для студии сделать новую подсветку", familyCtx);
    expect(result.items[0]?.kind).toBe("idea");
    expect(result.items[0]?.area).toBe("Студия");
  });

  it("parses personal wish as wishlist, not purchase", () => {
    const result = parseSmartInput("Хочу себе потом iPhone 17 Pro на 256 за 90000", familyCtx);
    expect(result.items[0]?.kind).toBe("wish");
    expect(result.items[0]?.assignedTo).toBe("me");
    expect(result.items[0]?.wish?.status).toBe("saved");
    expect(result.items[0]?.wish?.estimatedPrice).toBe(90000);
  });

  it("parses shared wishlist phrase", () => {
    const result = parseSmartInput("Давай сохраним этот телевизор в наши хотелки", familyCtx);
    expect(result.items[0]?.kind).toBe("wish");
    expect(result.items[0]?.assignedTo).toBe("shared");
  });

  it("stores url on wish", () => {
    const result = parseSmartInput("Сохрани в хотелки https://example.com/item", familyCtx);
    expect(result.items[0]?.kind).toBe("wish");
    expect(result.items[0]?.url).toBe("https://example.com/item");
  });

  it("does not force generic work for named bar context", () => {
    const result = parseSmartInput("Завтра по ХХ Бару проверить микшер", familyCtx);
    expect(result.items[0]?.kind).toBe("task");
    expect(result.items[0]?.schedule).toBe("tomorrow");
    expect(result.items[0]?.projectCandidate).toBe("ХХ Бару");
  });

  it("keeps unscheduled studio task visible without date", () => {
    const result = parseSmartInput("Поменять стол в студии", familyCtx);
    expect(result.items[0]?.schedule).toBe("none");
    expect(result.items[0]?.area).toBe("Студия");
  });
});
