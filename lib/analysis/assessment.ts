import type {
  AnalysisOptions,
  AssessmentBlocker,
  Diagnostic,
  PromptAssessment,
  RubricDimensionKey,
  ScoreBand,
  ScoreBreakdown,
  Severity,
} from "../../types/analysis";

const DEFAULT_OPTIONS: AnalysisOptions = {
  privacySensitivity: 3,
  clarityStrictness: 3,
  securityStrictness: 3,
};

const READINESS_DIMENSIONS: RubricDimensionKey[] = [
  "taskClarity",
  "contextSufficiency",
  "outputSpecification",
  "instructionCoherence",
];

const SAFETY_DIMENSIONS: RubricDimensionKey[] = ["securityHygiene", "privacyHygiene"];

const DIMENSION_LABELS: Record<RubricDimensionKey, string> = {
  taskClarity: "Task clarity",
  contextSufficiency: "Context sufficiency",
  outputSpecification: "Output specification",
  instructionCoherence: "Instruction coherence",
  securityHygiene: "Security hygiene",
  privacyHygiene: "Privacy hygiene",
};

const SEVERITY_RANK: Record<Severity, number> = {
  info: 0,
  warning: 1,
  error: 2,
  critical: 3,
};

const RULE_PRIORITY: Record<string, number> = {
  "secret-exfiltration-risk": 100,
  "prompt-injection-risk": 95,
  "obfuscated-attack-pattern": 95,
  "sensitive-data-leak": 90,
  "low-information-input": 85,
  "missing-task-definition": 80,
  "undelimited-user-input": 78,
  "thin-task-context": 72,
  "contradictory-directives": 55,
  "missing-output-format": 50,
  "vague-instruction": 35,
};

const RULE_EFFECTS: Record<string, Partial<Record<RubricDimensionKey, number>>> = {
  "low-information-input": {
    taskClarity: 4.5,
    contextSufficiency: 4.5,
    outputSpecification: 2.5,
    instructionCoherence: 1,
  },
  "missing-task-definition": {
    taskClarity: 3.5,
    contextSufficiency: 2,
    outputSpecification: 1,
  },
  "thin-task-context": {
    contextSufficiency: 3.5,
    outputSpecification: 1.5,
  },
  "missing-output-format": {
    outputSpecification: 2.5,
  },
  "vague-instruction": {
    taskClarity: 1.25,
    instructionCoherence: 0.5,
  },
  "contradictory-directives": {
    instructionCoherence: 2.5,
  },
  "prompt-injection-risk": {
    securityHygiene: 5,
    instructionCoherence: 2.5,
  },
  "secret-exfiltration-risk": {
    securityHygiene: 5,
    privacyHygiene: 2,
  },
  "undelimited-user-input": {
    securityHygiene: 3.5,
    instructionCoherence: 1.5,
  },
  "obfuscated-attack-pattern": {
    securityHygiene: 5,
    instructionCoherence: 2,
  },
  "sensitive-data-leak": {
    privacyHygiene: 4.5,
    securityHygiene: 0.5,
  },
  "excessive-length": {
    contextSufficiency: 0.75,
    instructionCoherence: 1,
  },
  "repeated-instructions": {
    instructionCoherence: 0.75,
  },
  "missing-examples-for-complex-task": {
    contextSufficiency: 0.5,
    outputSpecification: 0.5,
  },
};

function clampScore(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function roundTo(value: number, places = 1): number {
  const precision = 10 ** places;
  return Math.round(value * precision) / precision;
}

function sensitivityMultiplier(value: number): number {
  const normalized = Math.max(1, Math.min(5, value));
  return 0.7 + normalized * 0.1;
}

function dimensionMultiplier(key: RubricDimensionKey, options: AnalysisOptions): number {
  if (key === "privacyHygiene") {
    return sensitivityMultiplier(options.privacySensitivity);
  }

  if (key === "securityHygiene") {
    return sensitivityMultiplier(options.securityStrictness);
  }

  return sensitivityMultiplier(options.clarityStrictness);
}

function fallbackEffects(diagnostic: Diagnostic): Partial<Record<RubricDimensionKey, number>> {
  const amount = diagnostic.severity === "critical" ? 2.25 : diagnostic.severity === "error" ? 1.75 : diagnostic.severity === "warning" ? 1 : 0.4;

  switch (diagnostic.category) {
    case "clarity":
      return {
        taskClarity: amount,
        contextSufficiency: amount * 0.4,
      };
    case "structure":
      return {
        instructionCoherence: amount,
        outputSpecification: amount * 0.25,
      };
    case "security":
      return {
        securityHygiene: amount,
      };
    case "privacy":
      return {
        privacyHygiene: amount,
      };
    case "efficiency":
      return {
        instructionCoherence: amount * 0.5,
        contextSufficiency: amount * 0.35,
      };
    default:
      return {};
  }
}

function average(values: number[]): number {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function bandForScore(score: number): ScoreBand {
  if (score <= 25) return "0-25";
  if (score <= 60) return "26-60";
  if (score <= 80) return "61-80";
  return "81-100";
}

function dimensionSummary(score: number, relatedRuleCount: number): string {
  if (relatedRuleCount === 0) {
    return "No material issues detected.";
  }

  if (score >= 4) {
    return "Minor issues, but the prompt is still usable in this area.";
  }

  if (score >= 3) {
    return "Noticeable gaps are likely to affect output quality.";
  }

  if (score >= 2) {
    return "This area needs work before the prompt is reliable.";
  }

  return "Blocking weakness in this area.";
}

function buildBlockers(diagnostics: Diagnostic[]): AssessmentBlocker[] {
  return [...diagnostics]
    .sort((left, right) => {
      const severityDelta = SEVERITY_RANK[right.severity] - SEVERITY_RANK[left.severity];

      if (severityDelta !== 0) {
        return severityDelta;
      }

      const priorityDelta = (RULE_PRIORITY[right.ruleId] ?? 0) - (RULE_PRIORITY[left.ruleId] ?? 0);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      return right.evidence.length - left.evidence.length;
    })
    .slice(0, 3)
    .map((diagnostic) => ({
      ruleId: diagnostic.ruleId,
      title: diagnostic.title,
      category: diagnostic.category,
      severity: diagnostic.severity,
      message: diagnostic.message,
      suggestion: diagnostic.suggestion,
      evidence: diagnostic.evidence,
    }));
}

function confidenceForDiagnostics(diagnostics: Diagnostic[]): number {
  if (!diagnostics.length) {
    return 0.93;
  }

  const evidenceCount = diagnostics.reduce((count, diagnostic) => count + diagnostic.evidence.length, 0);
  let confidence = 0.72 + Math.min(0.12, evidenceCount * 0.03);

  if (diagnostics.some((diagnostic) => diagnostic.severity === "critical")) {
    confidence += 0.06;
  }

  if (diagnostics.some((diagnostic) => diagnostic.source !== "original")) {
    confidence += 0.05;
  }

  if (diagnostics.every((diagnostic) => diagnostic.evidence.length === 0)) {
    confidence -= 0.08;
  }

  return roundTo(clampScore(confidence, 0.45, 0.98), 2);
}

function deriveCaps(diagnostics: Diagnostic[]) {
  let validityCap = 100;
  let safetyCap = 100;

  for (const diagnostic of diagnostics) {
    if (diagnostic.ruleId === "low-information-input") {
      validityCap = Math.min(validityCap, 25);
    }

    if (diagnostic.ruleId === "missing-task-definition") {
      validityCap = Math.min(validityCap, 55);
    }

    if (diagnostic.ruleId === "thin-task-context") {
      validityCap = Math.min(validityCap, 70);
    }

    if (diagnostic.ruleId === "missing-output-format") {
      validityCap = Math.min(validityCap, 88);
    }

    if (diagnostic.ruleId === "undelimited-user-input") {
      safetyCap = Math.min(safetyCap, 68);
    }

    if (diagnostic.ruleId === "sensitive-data-leak") {
      safetyCap = Math.min(safetyCap, 70);
    }

    if (diagnostic.ruleId === "prompt-injection-risk" || diagnostic.ruleId === "obfuscated-attack-pattern") {
      safetyCap = Math.min(safetyCap, 18);
    }

    if (diagnostic.ruleId === "secret-exfiltration-risk") {
      safetyCap = Math.min(safetyCap, 12);
    }

    if (diagnostic.category === "security" && diagnostic.severity === "warning") {
      safetyCap = Math.min(safetyCap, 84);
    }
  }

  return { validityCap, safetyCap };
}

export function buildPromptAssessment(
  diagnostics: Diagnostic[],
  options: Partial<AnalysisOptions> = {},
): PromptAssessment {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  const dimensionValues: Record<RubricDimensionKey, number> = {
    taskClarity: 5,
    contextSufficiency: 5,
    outputSpecification: 5,
    instructionCoherence: 5,
    securityHygiene: 5,
    privacyHygiene: 5,
  };
  const relatedRules: Record<RubricDimensionKey, string[]> = {
    taskClarity: [],
    contextSufficiency: [],
    outputSpecification: [],
    instructionCoherence: [],
    securityHygiene: [],
    privacyHygiene: [],
  };

  for (const diagnostic of diagnostics) {
    const effects = RULE_EFFECTS[diagnostic.ruleId] ?? fallbackEffects(diagnostic);

    for (const [rawKey, rawAmount] of Object.entries(effects)) {
      if (rawAmount === undefined) {
        continue;
      }

      const key = rawKey as RubricDimensionKey;
      const weightedAmount = rawAmount * dimensionMultiplier(key, mergedOptions);
      dimensionValues[key] = roundTo(clampScore(dimensionValues[key] - weightedAmount, 0, 5));

      if (!relatedRules[key].includes(diagnostic.title)) {
        relatedRules[key].push(diagnostic.title);
      }
    }
  }

  const readinessScore = Math.round(
    average(READINESS_DIMENSIONS.map((dimension) => dimensionValues[dimension])) * 20,
  );
  const safetyScore = Math.round(
    average(SAFETY_DIMENSIONS.map((dimension) => dimensionValues[dimension])) * 20,
  );
  const { validityCap, safetyCap } = deriveCaps(diagnostics);
  const overallScore = Math.max(0, Math.min(readinessScore, safetyScore, validityCap, safetyCap));
  const hasSecurityOrPrivacyBlocker = diagnostics.some(
    (diagnostic) =>
      (diagnostic.category === "security" || diagnostic.category === "privacy") &&
      (diagnostic.severity === "error" || diagnostic.severity === "critical"),
  );
  const hasInvalidBlocker = diagnostics.some((diagnostic) =>
    ["low-information-input", "missing-task-definition"].includes(diagnostic.ruleId),
  );
  const hasContextBlocker = diagnostics.some((diagnostic) => diagnostic.ruleId === "thin-task-context");

  const verdict = hasSecurityOrPrivacyBlocker
    ? "unsafe"
    : hasInvalidBlocker
      ? "invalid"
      : hasContextBlocker
        ? "needs-context"
        : diagnostics.length === 0 && overallScore >= 90
          ? "strong"
          : "usable";

  const topBlockers = buildBlockers(diagnostics);

  return {
    verdict,
    overallScore,
    readinessScore,
    safetyScore,
    scoreBand: bandForScore(overallScore),
    confidence: confidenceForDiagnostics(diagnostics),
    topBlockers,
    bestNextFix: topBlockers[0]?.suggestion ?? null,
    dimensions: {
      taskClarity: {
        label: DIMENSION_LABELS.taskClarity,
        score: dimensionValues.taskClarity,
        summary: dimensionSummary(dimensionValues.taskClarity, relatedRules.taskClarity.length),
        relatedRules: relatedRules.taskClarity,
      },
      contextSufficiency: {
        label: DIMENSION_LABELS.contextSufficiency,
        score: dimensionValues.contextSufficiency,
        summary: dimensionSummary(dimensionValues.contextSufficiency, relatedRules.contextSufficiency.length),
        relatedRules: relatedRules.contextSufficiency,
      },
      outputSpecification: {
        label: DIMENSION_LABELS.outputSpecification,
        score: dimensionValues.outputSpecification,
        summary: dimensionSummary(dimensionValues.outputSpecification, relatedRules.outputSpecification.length),
        relatedRules: relatedRules.outputSpecification,
      },
      instructionCoherence: {
        label: DIMENSION_LABELS.instructionCoherence,
        score: dimensionValues.instructionCoherence,
        summary: dimensionSummary(dimensionValues.instructionCoherence, relatedRules.instructionCoherence.length),
        relatedRules: relatedRules.instructionCoherence,
      },
      securityHygiene: {
        label: DIMENSION_LABELS.securityHygiene,
        score: dimensionValues.securityHygiene,
        summary: dimensionSummary(dimensionValues.securityHygiene, relatedRules.securityHygiene.length),
        relatedRules: relatedRules.securityHygiene,
      },
      privacyHygiene: {
        label: DIMENSION_LABELS.privacyHygiene,
        score: dimensionValues.privacyHygiene,
        summary: dimensionSummary(dimensionValues.privacyHygiene, relatedRules.privacyHygiene.length),
        relatedRules: relatedRules.privacyHygiene,
      },
    },
  };
}

export function assessmentToScoreBreakdown(assessment: PromptAssessment): ScoreBreakdown {
  const clarity = Math.round(
    average([
      assessment.dimensions.taskClarity.score,
      assessment.dimensions.contextSufficiency.score,
      assessment.dimensions.outputSpecification.score,
    ]) * 20,
  );

  return {
    overall: assessment.overallScore,
    clarity,
    security: Math.round(assessment.dimensions.securityHygiene.score * 20),
    structure: Math.round(assessment.dimensions.instructionCoherence.score * 20),
    privacy: Math.round(assessment.dimensions.privacyHygiene.score * 20),
  };
}
