import type {
  AnalysisOptions,
  AnalysisReport,
  Severity,
} from "../../types/analysis";
import { generateDeterministicRewrite } from "../rewrite/deterministic";
import { runRules } from "./rules";
import { scoreDiagnostics } from "./score";

const DEFAULT_OPTIONS: AnalysisOptions = {
  privacySensitivity: 3,
  clarityStrictness: 3,
  securityStrictness: 3,
};

function summarize(diagnostics: AnalysisReport["diagnostics"]) {
  const counts: Record<Severity, number> = {
    critical: 0,
    error: 0,
    warning: 0,
    info: 0,
  };

  for (const diagnostic of diagnostics) {
    counts[diagnostic.severity] += 1;
  }

  return {
    critical: counts.critical,
    errors: counts.error,
    warnings: counts.warning,
    infos: counts.info,
  };
}

export function analyzePrompt(
  prompt: string,
  options: Partial<AnalysisOptions> = {},
): AnalysisReport {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  const diagnostics = runRules(prompt);
  const rewrite = generateDeterministicRewrite(prompt, diagnostics);

  return {
    scores: scoreDiagnostics(diagnostics, mergedOptions),
    diagnostics,
    summary: summarize(diagnostics),
    rewrittenPrompt: rewrite.rewrittenPrompt,
    changes: rewrite.changes,
  };
}

export { scoreDiagnostics } from "./score";
export { runRules } from "./rules";
