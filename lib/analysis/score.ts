import type {
  AnalysisOptions,
  Diagnostic,
  ScoreBreakdown,
} from "../../types/analysis";
import { assessmentToScoreBreakdown, buildPromptAssessment } from "./assessment";

export function scoreDiagnostics(
  diagnostics: Diagnostic[],
  options: Partial<AnalysisOptions> = {},
): ScoreBreakdown {
  return assessmentToScoreBreakdown(buildPromptAssessment(diagnostics, options));
}
