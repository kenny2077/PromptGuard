import type {
  AnalysisOptions,
  Diagnostic,
  ScoreBreakdown,
  Severity,
} from "../../types/analysis";

const DEFAULT_OPTIONS: AnalysisOptions = {
  privacySensitivity: 3,
  clarityStrictness: 3,
  securityStrictness: 3,
};

const BASE_WEIGHTS: Record<Severity, number> = {
  info: 2,
  warning: 8,
  error: 15,
  critical: 28,
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function sensitivityMultiplier(value: number): number {
  const normalized = Math.max(1, Math.min(5, value));
  return 0.7 + normalized * 0.1;
}

function categoryMultiplier(
  diagnostic: Diagnostic,
  options: AnalysisOptions,
): number {
  if (diagnostic.category === "privacy") {
    return sensitivityMultiplier(options.privacySensitivity);
  }

  if (diagnostic.category === "clarity" || diagnostic.category === "structure") {
    return sensitivityMultiplier(options.clarityStrictness);
  }

  if (diagnostic.category === "security") {
    return sensitivityMultiplier(options.securityStrictness);
  }

  return 1;
}

function penalty(diagnostic: Diagnostic, options: AnalysisOptions): number {
  return BASE_WEIGHTS[diagnostic.severity] * categoryMultiplier(diagnostic, options);
}

export function scoreDiagnostics(
  diagnostics: Diagnostic[],
  options: Partial<AnalysisOptions> = {},
): ScoreBreakdown {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  const categoryPenalties = {
    clarity: 0,
    security: 0,
    structure: 0,
    privacy: 0,
  };
  let overallPenalty = 0;

  for (const diagnostic of diagnostics) {
    const value = penalty(diagnostic, mergedOptions);
    overallPenalty += value;

    if (diagnostic.category === "efficiency") {
      categoryPenalties.structure += value * 0.5;
      categoryPenalties.clarity += value * 0.25;
      continue;
    }

    categoryPenalties[diagnostic.category] += value;
  }

  return {
    overall: clampScore(100 - overallPenalty),
    clarity: clampScore(100 - categoryPenalties.clarity),
    security: clampScore(100 - categoryPenalties.security),
    structure: clampScore(100 - categoryPenalties.structure),
    privacy: clampScore(100 - categoryPenalties.privacy),
  };
}
