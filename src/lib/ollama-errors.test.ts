import { describe, expect, it } from "vitest";
import { ollamaError } from "./ollama-errors";
describe("local model errors", () => {
  it("explains insufficient memory without exposing paths", () => {
    expect(ollamaError({error:"out of memory loading C:/private/model"})).toMatch(/не хватает памяти/);
    expect(ollamaError({error:"out of memory loading C:/private/model"})).not.toContain("C:/private");
  });
});
