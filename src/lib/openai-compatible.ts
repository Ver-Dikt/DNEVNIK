import type { AIParseInput, AIParseResult, AIProvider, AIQueryInput, AIQueryResult } from "@/lib/types";

export class OpenAICompatibleProvider implements AIProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly model: string
  ) {}

  async parseInbox(input: AIParseInput): Promise<AIParseResult> {
    const response = await this.chat([
      {
        role: "system",
        content:
          "Ты парсер персонального ежедневника. Верни только JSON AIParseResult. Не выдумывай факты, помечай needsReview при неясности."
      },
      {
        role: "user",
        content: input.text
      }
    ]);
    return JSON.parse(response) as AIParseResult;
  }

  async answerQuery(input: AIQueryInput): Promise<AIQueryResult> {
    const response = await this.chat([
      {
        role: "system",
        content: "Ответь по данным ежедневника кратко. Верни JSON AIQueryResult."
      },
      {
        role: "user",
        content: JSON.stringify(input)
      }
    ]);
    return JSON.parse(response) as AIQueryResult;
  }

  private async chat(messages: Array<{ role: "system" | "user"; content: string }>): Promise<string> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      throw new Error(`AI provider error: ${response.status}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("AI provider returned empty content");
    return content;
  }
}
