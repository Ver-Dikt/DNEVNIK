import { describe, expect, it } from "vitest";
import { navigationTarget } from "./assistant-navigation";

describe("navigation from conversation", () => {
  it("accepts an explicit request with a known destination", () => {
    expect(navigationTarget("Открой покупки", "purchases")).toBe("purchases");
    expect(navigationTarget("Перейди в календарь", "plan")).toBe("plan");
    expect(navigationTarget("Открой покупки", ["purchases"])).toBe("purchases");
  });
  it("does not navigate for a question or an unknown target", () => {
    expect(navigationTarget("Что купить?", "purchases")).toBeNull();
    expect(navigationTarget("Открой покупки", "../../settings")).toBeNull();
    expect(navigationTarget("Объясни, как открыть покупки", "purchases")).toBeNull();
  });
});
