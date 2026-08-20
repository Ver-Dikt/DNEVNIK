import { NextResponse } from "next/server";
import { getAIProvider } from "@/lib/ai-provider";
import { defaultParserConfig } from "@/lib/smart-parser/phrase-rules";
import { parseSmartInput } from "@/lib/smart-parser";
import type { AIParseInput } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as AIParseInput;
    if (!input.text?.trim()) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }
    const localResult = parseSmartInput(input.text, { timezone: input.timezone, learnedRules: input.learnedRules, projects: input.projects });
    if (
      localResult.confidence >= defaultParserConfig.lowConfidence ||
      process.env.AI_ENABLED !== "true" ||
      (process.env.AI_PROVIDER ?? "mock") === "mock"
    ) {
      return NextResponse.json({
        confidence: localResult.confidence,
        needsReview: localResult.needsReview,
        rawText: input.text,
        items: localResult.items
      });
    }

    try {
      const aiResult = await getAIProvider().parseInbox(input);
      return NextResponse.json({
        ...aiResult,
        items: aiResult.items.map((item) => ({ ...item, parsedBy: "ai", originalInput: input.text }))
      });
    } catch {
      return NextResponse.json({
        confidence: localResult.confidence,
        needsReview: true,
        rawText: input.text,
        items: localResult.items.map((item) => ({ ...item, needsReview: true }))
      });
    }
  } catch {
    return NextResponse.json(
      {
        error: "Не удалось автоматически разобрать запись. Я сохранил ее в Inbox."
      },
      { status: 500 }
    );
  }
}
