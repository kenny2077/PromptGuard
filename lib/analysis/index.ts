import type {
  AnalysisOptions,
  AnalysisReport,
  PromptFormat,
  RiskLevel,
  Severity,
} from "../../types/analysis";
import { generateDeterministicRewrite } from "../rewrite/deterministic";
import { decodePromptVariants } from "./decoder";
import { normalizeForScan } from "./normalize";
import { parsePrompt } from "./parser";
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

function riskLevel(summary: ReturnType<typeof summarize>): RiskLevel {
  if (summary.critical > 0 || summary.errors > 1) return "high-risk";
  if (summary.errors > 0 || summary.warnings > 0) return "needs-edits";
  return "ready";
}

function fingerprint(input: string, diagnostics: AnalysisReport["diagnostics"]): string {
  const value = `${input.length}:${diagnostics.map((diagnostic) => diagnostic.ruleId).join(",")}`;
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function analyzePrompt(
  prompt: string,
  options: Partial<AnalysisOptions> = {},
  formatHint: PromptFormat = "plain-text",
): AnalysisReport {
  const startedAt = performance.now();
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  const document = parsePrompt(prompt, formatHint);
  const normalized = normalizeForScan(document.source);
  const decodedVariants = decodePromptVariants(document.source);
  const diagnostics = runRules(document, { normalized, decodedVariants });
  const rewrite = generateDeterministicRewrite(prompt, diagnostics);
  const summary = summarize(diagnostics);

  return {
    scores: scoreDiagnostics(diagnostics, mergedOptions),
    diagnostics,
    summary,
    rewrittenPrompt: rewrite.rewrittenPrompt,
    changes: rewrite.changes,
    metadata: {
      durationMs: Math.max(1, Math.round(performance.now() - startedAt)),
      characterCount: document.characterCount,
      estimatedTokens: document.estimatedTokens,
      lineCount: document.lineCount,
      inputFormat: document.format,
      roleCount: document.roles.length,
      variableCount: document.variables.length,
      normalized: normalized.changed,
      decodedVariantCount: decodedVariants.length,
      decodedEncodings: decodedVariants.map((variant) => variant.encoding),
      riskLevel: riskLevel(summary),
      fingerprint: fingerprint(document.source, diagnostics),
    },
  };
}

export { scoreDiagnostics } from "./score";
export { runRules } from "./rules";
export { parsePrompt } from "./parser";
export { normalizeForScan } from "./normalize";
export { decodePromptVariants } from "./decoder";
