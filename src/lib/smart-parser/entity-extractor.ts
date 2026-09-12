export function cleanTitle(text: string): string {
  const cleaned = text
    .replace(/(?:https?:\/\/|www\.)[^\s]+/gi, "")
    .replace(/(?<![\p{L}\p{N}_])(сегодня|завтра|послезавтра|на этой неделе|на следующей неделе|до конца недели|в этом месяце|до конца месяца)(?![\p{L}\p{N}_])/giu, "")
    .replace(/(?<![\p{L}\p{N}_])(надо|нужно|нужна|нужны|нужен|будет|потом|не забыть|хочу|запиши|идея|мысль|купить|заказать)(?![\p{L}\p{N}_])/giu, "")
    .replace(/(?<![\p{L}\p{N}_])(для самого|для)(?![\p{L}\p{N}_])/giu, "для")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "Новая запись";
  return cleaned[0].toUpperCase() + cleaned.slice(1);
}
