import { projectAliases } from "@/lib/smart-parser/phrase-rules";
import { stripRussianEnding } from "@/lib/smart-parser/normalizer";
import type { LearnedRule, ProjectMatchResult } from "@/lib/smart-parser/types";
import type { ProjectNode } from "@/lib/types";
import { projectPathFor } from "@/lib/organization";

const defaultProjectPaths = [
  ["Дом"],
  ["Дом", "Ремонт"],
  ["Дом", "Ремонт", "Гардероб"],
  ["Студия"],
  ["Музыка"],
  ["Работа"]
];

export function matchProject(text: string, projects: ProjectNode[] = [], learnedRules: LearnedRule[] = []): ProjectMatchResult {
  for (const rule of learnedRules) {
    if (rule.projectPath && text.includes(rule.phrase.toLowerCase())) {
      return { projectPath: rule.projectPath, confidence: 0.98, matchedText: rule.phrase };
    }
  }

  const candidates = buildCandidates(projects);
  const normalizedText = stripRussianEnding(text);
  let best: ProjectMatchResult = { projectPath: [], confidence: 0 };
  let bestScore = 0;
  let ambiguous = false;

  for (const candidate of candidates) {
    for (const alias of candidate.aliases) {
      const normalizedAlias = stripRussianEnding(alias.toLowerCase());
      const exact = text.includes(alias.toLowerCase());
      const stem = normalizedAlias.length > 3 && normalizedText.includes(normalizedAlias);
      if (!exact && !stem) continue;
      const confidence = exact ? 0.88 : 0.68;
      const parentsMentioned = candidate.path.slice(1, -1).filter(part => normalizedText.includes(stripRussianEnding(part.toLowerCase()))).length;
      const score = confidence + parentsMentioned * .2;
      if (score > bestScore) {
        bestScore = score; ambiguous = false;
        best = { projectPath: candidate.path, confidence, matchedText: alias };
      } else if (score === bestScore && JSON.stringify(candidate.path) !== JSON.stringify(best.projectPath)) {
        ambiguous = true;
      }
    }
  }

  return ambiguous ? { projectPath: [], confidence: 0 } : best;
}

function buildCandidates(projects: ProjectNode[]): Array<{ path: string[]; aliases: string[] }> {
  if (!projects.length) {
    return defaultProjectPaths.map((path) => ({
      path,
      aliases: [path.at(-1)!, ...(projectAliases[path.at(-1)!] ?? [])]
    }));
  }

  return projects.map((project) => ({
    path: projectPathFor(project, projects),
    aliases: [project.name, ...(project.aliases ?? []), ...(projectAliases[project.name] ?? [])]
  }));
}
