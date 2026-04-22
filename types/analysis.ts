export type Severity = "info" | "warning" | "error" | "critical";

export type Category =
  | "clarity"
  | "security"
  | "structure"
  | "privacy"
  | "efficiency";

export interface Diagnostic {
  id: string;
  ruleId: string;
  title: string;
  severity: Severity;
  category: Category;
  message: string;
  evidence: string[];
  suggestion: string;
  startIndex?: number;
  endIndex?: number;
}

export interface ScoreBreakdown {
  overall: number;
  clarity: number;
  security: number;
  structure: number;
  privacy: number;
}

export interface RewriteChange {
  kind: string;
  description: string;
}

export interface AnalysisReport {
  scores: ScoreBreakdown;
  diagnostics: Diagnostic[];
  summary: {
    critical: number;
    errors: number;
    warnings: number;
    infos: number;
  };
  rewrittenPrompt: string;
  changes: RewriteChange[];
}

export interface AnalysisOptions {
  privacySensitivity: number;
  clarityStrictness: number;
  securityStrictness: number;
}

export interface RewriteResult {
  rewrittenPrompt: string;
  changes: RewriteChange[];
}

export interface DemoExample {
  id: string;
  label: string;
  description: string;
  prompt: string;
  mode?: "plain" | "messages";
}
