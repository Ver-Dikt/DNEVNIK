import { numberWords } from "@/lib/smart-parser/phrase-rules";
import type { DateParseResult } from "@/lib/smart-parser/types";
import type { SchedulePreset } from "@/lib/types";

const weekdays = [
  ["воскресенье", "воскресенья"],
  ["понедельник", "понедельника"],
  ["вторник", "вторника"],
  ["среду", "среда", "среды"],
  ["четверг", "четверга"],
  ["пятницу", "пятница", "пятницы"],
  ["субботу", "суббота", "субботы"]
];

export function parseDate(text: string, now = new Date()): DateParseResult {
  const timeHint = parseTimeHint(text);

  const direct: Array<[RegExp, SchedulePreset, number | undefined, number]> = [
    [/(^|\s)сегодня(?=\s|$)/, "today", 0, 0.96],
    [/(^|\s)послезавтра(?=\s|$)/, "tomorrow", 2, 0.9],
    [/(^|\s)завтра(?=\s|$)/, "tomorrow", 1, 0.96],
    [/(на этой неделе|до конца недели|к концу недели)/, "this_week", undefined, 0.86],
    [/(на следующей неделе|следующая неделя|через неделю)/, "next_week", undefined, 0.84],
    [/(на выходных|в выходные|до выходных)/, "this_week", undefined, 0.78],
    [/(в этом месяце|до конца месяца)/, "this_month", undefined, 0.82],
    [/(в следующем месяце|через месяц)/, "this_month", undefined, 0.72],
    [/(потом|позже|когда-нибудь|когда нибудь|не срочно|как-нибудь потом|как нибудь потом)/, "someday", undefined, 0.82]
  ];

  for (const [pattern, schedule, days, confidence] of direct) {
    const match = text.match(pattern);
    if (match) {
      return { schedule, dueDate: days === undefined ? undefined : addDays(now, days), timeHint, confidence, matchedText: match[0] };
    }
  }

  const afterDays = text.match(/через\s+(\d+|[а-я]+)\s+дн/i);
  if (afterDays) {
    const days = parseNumber(afterDays[1]);
    if (days) return { schedule: "none", dueDate: addDays(now, days), timeHint, confidence: 0.9, matchedText: afterDays[0] };
  }

  const afterWeeks = text.match(/через\s+(\d+|[а-я]+)\s+недел/i);
  if (afterWeeks) {
    const weeks = parseNumber(afterWeeks[1]);
    if (weeks) return { schedule: weeks === 1 ? "next_week" : "none", dueDate: addDays(now, weeks * 7), timeHint, confidence: 0.88, matchedText: afterWeeks[0] };
  }

  for (let dayIndex = 0; dayIndex < weekdays.length; dayIndex += 1) {
    for (const label of weekdays[dayIndex]) {
      const match = text.match(new RegExp(`(?:^|\\s)(?:до|к|в|после)?\\s*${label}(?=\\s|$)`, "i"));
      if (match) {
        const offset = nextWeekdayOffset(now, dayIndex);
        const after = match[0].trim().startsWith("после") ? 1 : 0;
        return { schedule: "none", dueDate: addDays(now, offset + after), timeHint, confidence: 0.86, matchedText: match[0] };
      }
    }
  }

  if (/(^|\s)вчера(?=\s|$)/.test(text)) {
    return { schedule: "none", timeHint, confidence: 0.35, matchedText: "вчера" };
  }

  return { schedule: "none", timeHint, confidence: timeHint ? 0.35 : 0 };
}

function parseTimeHint(text: string): DateParseResult["timeHint"] {
  if (/(^|\s)утром(?=\s|$)/.test(text)) return "morning";
  if (/(^|\s)(днем|днём)(?=\s|$)/.test(text)) return "day";
  if (/(^|\s)вечером(?=\s|$)/.test(text)) return "evening";
  if (/(^|\s)ночью(?=\s|$)/.test(text)) return "night";
  return undefined;
}

function parseNumber(value: string): number {
  return Number(value) || numberWords[value] || 0;
}

function addDays(now: Date, days: number): string {
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function nextWeekdayOffset(now: Date, targetDay: number): number {
  const current = now.getDay();
  const offset = (targetDay - current + 7) % 7;
  return offset === 0 ? 7 : offset;
}
