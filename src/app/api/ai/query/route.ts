import { NextResponse } from "next/server";
import { getAIProvider } from "@/lib/ai-provider";
import type { AIQueryInput } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as AIQueryInput;
    if (!input.query?.trim()) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }
    const result = await getAIProvider().answerQuery(input);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      {
        answer: "Не удалось получить ответ AI. Поиск и записи продолжают работать локально.",
        relatedIds: []
      },
      { status: 200 }
    );
  }
}
