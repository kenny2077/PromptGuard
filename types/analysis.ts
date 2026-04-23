export type Severity = "info" | "warning" | "error" | "critical";

export type Category =
  | "clarity"
  | "security"
  | "structure"
  | "privacy"
  | "efficiency";

export type PromptFormat = "plain-text" | "message-array";

export type DiagnosticSource = "original" | "normalized" | "decoded";

export type RiskLevel = "ready" | "needs-edits" | "high-risk";

export interface SourceLocation {
  startOffset: number;
  endOffset: number;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface PromptRole {
  role: string;
  content: string;
  location: SourceLocation;
}

export interface PromptVariable {
  name: string;
  syntax: string;
  occurrences: SourceLocation[];
}

export interface PromptDocument {
  source: string;
  format: PromptFormat;
  roles: PromptRole[];
  variables: PromptVariable[];
  estimatedTokens: number;
  characterCount: number;
  lineCount: number;
}

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
  location?: SourceLocation;
  source?: DiagnosticSource;
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
  metadata: {
    durationMs: number;
    characterCount: number;
    estimatedTokens: number;
    lineCount: number;
    inputFormat: PromptFormat;
    roleCount: number;
    variableCount: number;
    normalized: boolean;
    decodedVariantCount: number;
    decodedEncodings: string[];
    riskLevel: RiskLevel;
    fingerprint: string;
  };
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
