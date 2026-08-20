export function cleanTitle(text: string): string {
  const cleaned = text
    .replace(/(?:https?:\/\/|www\.)[^\s]+/gi, "")
    .replace(/\b(сегодня|завтра|послезавтра|на этой неделе|на следующей неделе|до конца недели|в этом месяце|до конца месяца)\b/gi, "")
    .replace(/\b(надо|нужно|нужна|нужны|нужен|будет|потом|не забыть|хочу|запиши|идея|мысль|купить|заказать)\b/gi, "")
    .replace(/\b(для самого|для)\b/gi, "для")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "Новая запись";
  return cleaned[0].toUpperCase() + cleaned.slice(1);
}
