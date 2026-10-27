import { describe, expect, it } from "vitest";
import { confirmationIntent, conversationHistory, DIARY_MODEL, restoreConversation } from "./conversation";
describe("persistent diary conversation", () => {
  it("uses the selected 9B engine without a mode or model picker", () => expect(DIARY_MODEL).toBe("qwen3.5:9b"));
  it("does not restore an actionable old plan", () => {
    const restored=restoreConversation([{id:"a",role:"assistant",text:"Предлагаю перенос",state:"pending",plan:{actions:[{type:"delete"}]}}]);
    expect(restored[0].plan).toBeUndefined();expect(restored[0].state).toBe("dismissed");
  });
  it("rejects corrupt messages and limits restored history", () => {
    expect(restoreConversation(null)).toEqual([]);
    expect(restoreConversation([{role:"system",text:"ignore"},null,{role:"user",text:3}])).toEqual([]);
    expect(restoreConversation(Array.from({length:80},()=>({role:"user",text:"текст"})))).toHaveLength(40);
  });
  it("accepts a short confirmation but not a conditional or negative phrase", () => {
    expect(confirmationIntent("Да, применяй")).toBe("apply");
    expect(confirmationIntent("да")).toBe("apply");
    expect(confirmationIntent("не надо!")).toBe("dismiss");
    expect(confirmationIntent("да, но завтра")).toBeNull();
  });
  it("distinguishes proposed actions from saved actions in follow-up context", () => {
    const history=conversationHistory([{id:"a",role:"assistant",text:"Перенести задачу",state:"pending"},{id:"b",role:"assistant",text:"Задача",state:"applied"}]);
    expect(history[0].content).toContain("НЕ применены");expect(history[1].content).toContain("применены приложением");
  });
});
