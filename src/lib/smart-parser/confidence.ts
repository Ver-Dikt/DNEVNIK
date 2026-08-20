export function combineConfidence(parts: Array<number | undefined>): number {
  const values = parts.filter((value): value is number => typeof value === "number" && value > 0);
  if (!values.length) return 0.2;
  const weighted = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.max(0.05, Math.min(0.99, Number(weighted.toFixed(2))));
}

export function confidenceLabel(confidence: number): "Высокая" | "Средняя" | "Низкая" {
  if (confidence >= 0.8) return "Высокая";
  if (confidence >= 0.5) return "Средняя";
  return "Низкая";
}
