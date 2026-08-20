const splitMarkers = [
  /[!?;\n]+|(?<![a-z0-9])\.(?![a-z0-9])/gi,
  /\s+\+\s+/g,
  /,\s+(?=[^,]{0,32}(идея|купить|заказать|надо|нужно|проверить|отправить|позвонить|жду|андрею))/gi,
  /\s+и\s+ещ[еe]\s+(?=(идея|купить|заказать|надо|нужно|проверить|отправить|позвонить|жду))/gi,
  /\s+ещ[еe]\s+(?=(идея|купить|заказать|надо|нужно|проверить|отправить|позвонить|жду))/gi,
  /\s+и\s+(?=(идея|купить|заказать|надо|нужно|проверить|отправить|позвонить|жду))/gi
];

export function splitIntoSegments(normalized: string): string[] {
  let prepared = normalized;
  for (const marker of splitMarkers) {
    prepared = prepared.replace(marker, " | ");
  }

  const segments = prepared
    .split("|")
    .map((part) => part.trim())
    .filter((part) => part.length > 1);

  return segments;
}
