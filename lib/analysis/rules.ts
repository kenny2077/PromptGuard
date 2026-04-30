import type {
  Category,
  Diagnostic,
  DiagnosticSource,
  PromptDocument,
  Severity,
} from "../../types/analysis";
import type { DecodedVariant } from "./decoder";
import type { NormalizationResult } from "./normalize";
import { locationFromOffset, parsePrompt } from "./parser";

interface RuleMatch {
  evidence: string[];
  startIndex?: number;
  endIndex?: number;
}

interface DiagnosticSeed {
  ruleId: string;
  title: string;
  severity: Severity;
  category: Category;
  message: string;
  evidence: string[];
  suggestion: string;
  startIndex?: number;
  endIndex?: number;
  source?: DiagnosticSource;
}

export interface RuleScanContext {
  normalized: NormalizationResult;
  decodedVariants: DecodedVariant[];
}

const ACTION_VERBS = [
  "analyze",
  "compare",
  "create",
  "draft",
  "extract",
  "generate",
  "identify",
  "list",
  "rewrite",
  "summarize",
  "write",
  "classify",
  "review",
  "explain",
  "convert",
  "build",
  "produce",
];

const ACTION_VERB_SET = new Set(ACTION_VERBS);

const OUTPUT_FORMAT_TERMS = [
  "json",
  "table",
  "bullet",
  "bullets",
  "numbered list",
  "markdown",
  "csv",
  "yaml",
  "xml",
  "paragraph",
  "sections",
  "format",
  "schema",
  "checklist",
];

const GENERIC_CONTEXT_TOKENS = new Set([
  "a",
  "an",
  "anything",
  "content",
  "data",
  "input",
  "it",
  "message",
  "nothing",
  "prompt",
  "something",
  "task",
  "text",
  "that",
  "the",
  "them",
  "thing",
  "this",
]);

const VAGUE_PATTERNS = [
  /\bbe helpful\b/gi,
  /\bdo your best\b/gi,
  /\btry to\b/gi,
  /\bif possible\b/gi,
  /\bas needed\b/gi,
  /\bfeel free to\b/gi,
  /\bmaybe\b/gi,
];

const INJECTION_PATTERNS = [
  /\bignore (?:all )?(?:previous|prior|above) instructions\b/gi,
  /\bdisregard (?:the )?(?:above|previous|prior)\b/gi,
  /\boverride (?:the )?system\b/gi,
  /\bforget everything\b/gi,
  /\bnew instructions\b/gi,
  /\bdeveloper mode\b/gi,
  /\bjailbreak\b/gi,
];

const SECRET_TARGET =
  "(?:system prompt|api[_ -]?keys?|access tokens?|passwords?|credentials?|\\.env|private keys?|secrets?)";

const SECRET_REQUEST_PATTERNS = [
  new RegExp(
    `\\b(?:show|print|display|output|reveal|give|read|cat|dump|extract|tell me)\\b.{0,50}${SECRET_TARGET}`,
    "gi",
  ),
  new RegExp(
    `${SECRET_TARGET}.{0,40}\\b(?:show|print|display|output|reveal|give|dump|extract)\\b`,
    "gi",
  ),
];

const SENSITIVE_PATTERNS = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g,
  /\b\d{3}-\d{2}-\d{4}\b/g,
  /\bsk-[A-Za-z0-9._-]{6,}\b/g,
  /\bsk-proj-[A-Za-z0-9_-]{20,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\b(?:ghp|gho|github_pat|xoxb|xoxp|xoxa|xoxr)-[A-Za-z0-9._-]{8,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g,
  /\bBearer\s+[A-Za-z0-9\-._~+/]+=*\b/g,
  /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
  /\bhooks\.slack\.com\/services\/[A-Z0-9/]+/g,
  /\bAIza[0-9A-Za-z\-_]{35}\b/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
];

const PLACEHOLDER_PATTERN =
  /(\{\{\s*(?:user_)?input\s*\}\}|\{(?:query|message|input|content|user_input)\}|\$\{(?:message|query|input|content|user_input)\})/gi;

function collectMatches(input: string, patterns: RegExp[], limit = 5): RuleMatch {
  const evidence: string[] = [];
  let startIndex: number | undefined;
  let endIndex: number | undefined;

  for (const pattern of patterns) {
    const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
    const regex = new RegExp(pattern.source, flags);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(input)) && evidence.length < limit) {
      const value = match[0].trim();

      if (!evidence.includes(value)) {
        evidence.push(value);
      }

      if (startIndex === undefined) {
        startIndex = match.index;
        endIndex = match.index + match[0].length;
      }
    }
  }

  return { evidence, startIndex, endIndex };
}

function createDiagnostic(seed: DiagnosticSeed, index: number, document: PromptDocument): Diagnostic {
  const location =
    seed.source !== "normalized" && seed.source !== "decoded" && seed.startIndex !== undefined && seed.endIndex !== undefined
      ? locationFromOffset(document.source, seed.startIndex, seed.endIndex)
      : undefined;

  return {
    id: `${seed.ruleId}-${index}`,
    ruleId: seed.ruleId,
    title: seed.title,
    severity: seed.severity,
    category: seed.category,
    message: seed.message,
    evidence: seed.evidence,
    suggestion: seed.suggestion,
    startIndex: seed.startIndex,
    endIndex: seed.endIndex,
    location,
    source: seed.source ?? "original",
  };
}

function hasActionVerb(input: string): boolean {
  const lower = input.toLowerCase();
  return ACTION_VERBS.some((verb) => new RegExp(`\\b${verb}\\b`).test(lower));
}

function wordTokens(input: string): string[] {
  return input.match(/[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)*/g) ?? [];
}

function asksForGeneration(input: string): boolean {
  return /\b(?:generate|write|create|summarize|extract|draft|produce|list|convert|rewrite|analyze)\b/i.test(
    input,
  );
}

function hasOutputFormat(input: string): boolean {
  const lower = input.toLowerCase();
  return OUTPUT_FORMAT_TERMS.some((term) => lower.includes(term));
}

function wordCount(input: string): number {
  return wordTokens(input).length;
}

function findContradictions(input: string): RuleMatch {
  const evidence: string[] = [];
  const lower = input.toLowerCase();
  let startIndex: number | undefined;
  let endIndex: number | undefined;

  const pairs: Array<[RegExp, RegExp, string]> = [
    [/\bconcise(?:ly)?\b/i, /\b(?:very detailed|detailed|comprehensive|exhaustive)\b/i, "concise + detailed"],
    [/\balways\b/i, /\bnever\b/i, "always + never"],
    [/\bjson\b/i, /\b(?:paragraph only|single paragraph|no bullets)\b/i, "JSON + paragraph-only"],
  ];

  for (const [left, right, label] of pairs) {
    if (left.test(input) && right.test(input)) {
      evidence.push(label);
      const leftIndex = lower.search(left);
      const rightIndex = lower.search(right);
      const first = Math.min(leftIndex, rightIndex);
      const last = Math.max(leftIndex, rightIndex);

      if (startIndex === undefined && first >= 0) {
        startIndex = first;
        endIndex = last + 12;
      }
    }
  }

  return { evidence, startIndex, endIndex };
}

function findObfuscatedAttacks(input: string): RuleMatch {
  const patterns = [
    /i\s+g\s+n\s+o\s+r\s+e\s+(?:all\s+)?previous\s+instructions/gi,
    /ignore[-_\s]*all[-_\s]*previous[-_\s]*instructions/gi,
    /d\s+i\s+s\s+r\s+e\s+g\s+a\s+r\s+d\s+(?:the\s+)?above/gi,
  ];

  return collectMatches(input, patterns);
}

function findUndelimitedPlaceholders(input: string): RuleMatch {
  const evidence: string[] = [];
  let startIndex: number | undefined;
  let endIndex: number | undefined;
  const regex = new RegExp(PLACEHOLDER_PATTERN.source, "gi");
  let match: RegExpExecArray | null;

  while ((match = regex.exec(input))) {
    const before = input.slice(Math.max(0, match.index - 40), match.index).toLowerCase();
    const after = input.slice(match.index + match[0].length, match.index + match[0].length + 40).toLowerCase();
    const stronglyDelimited =
      before.includes("<user_input>") ||
      after.includes("</user_input>") ||
      before.includes("```") ||
      after.includes("```") ||
      before.includes("treat content inside");

    if (!stronglyDelimited) {
      evidence.push(match[0]);
      startIndex ??= match.index;
      endIndex ??= match.index + match[0].length;
    }
  }

  return { evidence: [...new Set(evidence)].slice(0, 5), startIndex, endIndex };
}

function findRepeatedInstructions(input: string): RuleMatch {
  const chunks = input
    .split(/[\n.;]+/)
    .map((chunk) => chunk.trim().toLowerCase().replace(/[^a-z0-9 ]/g, ""))
    .filter((chunk) => chunk.length > 8);
  const seen = new Set<string>();
  const repeated: string[] = [];

  for (const chunk of chunks) {
    if (seen.has(chunk) && !repeated.includes(chunk)) {
      repeated.push(chunk);
    }

    seen.add(chunk);
  }

  return { evidence: repeated.slice(0, 3) };
}

function hasDiagnostic(diagnostics: DiagnosticSeed[], ruleId: string, source?: DiagnosticSource): boolean {
  return diagnostics.some((diagnostic) => {
    const diagnosticSource = diagnostic.source ?? "original";
    return diagnostic.ruleId === ruleId && (!source || diagnosticSource === source);
  });
}

function primaryTaskContent(document: PromptDocument): string {
  const userContent = document.roles.find((role) => role.role === "user" && role.content.trim());

  if (userContent) {
    return userContent.content;
  }

  const firstNonAssistant = document.roles.find((role) => role.role !== "assistant" && role.content.trim());
  return firstNonAssistant?.content || document.roles[0]?.content || document.source;
}

function meaningfulContextTokens(input: string): string[] {
  return wordTokens(input)
    .map((token) => token.toLowerCase())
    .filter((token) => !ACTION_VERB_SET.has(token) && !GENERIC_CONTEXT_TOKENS.has(token));
}

function findLowInformationInput(input: string): RuleMatch {
  const trimmed = input.trim();
  const tokens = wordTokens(trimmed).map((token) => token.toLowerCase());

  if (!tokens.length || hasActionVerb(trimmed)) {
    return { evidence: [] };
  }

  const uniqueTokens = [...new Set(tokens)];
  const isSingleToken = uniqueTokens.length === 1;
  const isTinyPrompt = tokens.length <= 2 && trimmed.length <= 24;
  const isRepeatedTinyPrompt = tokens.length <= 3 && uniqueTokens.length <= 2 && trimmed.length <= 32;

  if (isSingleToken || isTinyPrompt || isRepeatedTinyPrompt) {
    return { evidence: uniqueTokens.slice(0, 3) };
  }

  return { evidence: [] };
}

function findThinTaskContext(input: string): RuleMatch {
  const trimmed = input.trim();

  if (!trimmed || !hasActionVerb(trimmed)) {
    return { evidence: [] };
  }

  const tokens = wordTokens(trimmed);
  const meaningfulTokens = meaningfulContextTokens(trimmed);
  const isBareCommand = tokens.length <= 2;
  const isShortAndGeneric = tokens.length <= 3 && meaningfulTokens.length === 0;

  if (isBareCommand || isShortAndGeneric) {
    return {
      evidence: (meaningfulTokens.length ? meaningfulTokens : tokens.map((token) => token.toLowerCase())).slice(0, 3),
    };
  }

  return { evidence: [] };
}

export function runRules(input: string | PromptDocument, scanContext?: Partial<RuleScanContext>): Diagnostic[] {
  const document = typeof input === "string" ? parsePrompt(input) : input;
  const source = document.source;
  const trimmed = source.trim();
  const taskContent = primaryTaskContent(document);
  const diagnostics: DiagnosticSeed[] = [];

  if (!trimmed) {
    return [];
  }

  const lowInformation = findLowInformationInput(taskContent);
  if (lowInformation.evidence.length) {
    diagnostics.push({
      ruleId: "low-information-input",
      title: "Low-information input",
      severity: "error",
      category: "clarity",
      message: "The prompt is too minimal or opaque to tell the model what useful work to do.",
      evidence: lowInformation.evidence,
      suggestion: "State the task, the subject or source material, and the desired answer format.",
    });
  }

  const vague = collectMatches(taskContent, VAGUE_PATTERNS);
  if (vague.evidence.length) {
    diagnostics.push({
      ruleId: "vague-instruction",
      title: "Vague instruction",
      severity: "warning",
      category: "clarity",
      message: "Vague phrasing gives the model too much room to guess what a good answer looks like.",
      evidence: vague.evidence,
      suggestion: "Replace vague phrases with measurable criteria, scope, and desired output details.",
      startIndex: vague.startIndex,
      endIndex: vague.endIndex,
    });
  }

  if (asksForGeneration(taskContent) && !hasOutputFormat(source)) {
    diagnostics.push({
      ruleId: "missing-output-format",
      title: "Missing output format",
      severity: "warning",
      category: "clarity",
      message: "The prompt asks for generated work but does not say what shape the answer should take.",
      evidence: [],
      suggestion: "Specify JSON, bullets, a table, paragraphs, or another concrete format.",
    });
  }

  if (!hasActionVerb(taskContent)) {
    diagnostics.push({
      ruleId: "missing-task-definition",
      title: "Missing task definition",
      severity: "error",
      category: "clarity",
      message: "The prompt does not contain a clear action verb or goal.",
      evidence: [],
      suggestion: "Start with a direct task such as summarize, extract, compare, rewrite, or analyze.",
    });
  }

  const thinTaskContext = findThinTaskContext(taskContent);
  if (thinTaskContext.evidence.length) {
    diagnostics.push({
      ruleId: "thin-task-context",
      title: "Thin task context",
      severity: "error",
      category: "clarity",
      message: "The prompt names an action, but not enough context to know what should be acted on or how.",
      evidence: thinTaskContext.evidence,
      suggestion: "Name the source material or subject and add at least one concrete output requirement.",
    });
  }

  const contradictions = findContradictions(source);
  if (contradictions.evidence.length) {
    diagnostics.push({
      ruleId: "contradictory-directives",
      title: "Contradictory directives",
      severity: "warning",
      category: "structure",
      message: "Conflicting instructions make it harder for the model to decide which constraint wins.",
      evidence: contradictions.evidence,
      suggestion: "Choose one priority and make tradeoffs explicit.",
      startIndex: contradictions.startIndex,
      endIndex: contradictions.endIndex,
    });
  }

  const injection = collectMatches(source, INJECTION_PATTERNS);
  if (injection.evidence.length) {
    diagnostics.push({
      ruleId: "prompt-injection-risk",
      title: "Prompt injection risk",
      severity: "critical",
      category: "security",
      message: "The prompt contains language commonly used to override higher-priority instructions.",
      evidence: injection.evidence,
      suggestion: "Remove override language and treat untrusted content as data, not instructions.",
      startIndex: injection.startIndex,
      endIndex: injection.endIndex,
    });
  }

  const secretRequest = collectMatches(source, SECRET_REQUEST_PATTERNS);
  if (secretRequest.evidence.length) {
    diagnostics.push({
      ruleId: "secret-exfiltration-risk",
      title: "Secret exfiltration risk",
      severity: "critical",
      category: "security",
      message: "The prompt asks for sensitive hidden data or credentials that should not be disclosed.",
      evidence: secretRequest.evidence,
      suggestion: "Ask for a safe explanation or troubleshooting guidance instead of secrets.",
      startIndex: secretRequest.startIndex,
      endIndex: secretRequest.endIndex,
    });
  }

  const placeholders = findUndelimitedPlaceholders(source);
  if (placeholders.evidence.length) {
    diagnostics.push({
      ruleId: "undelimited-user-input",
      title: "Undelimited user input",
      severity: "error",
      category: "security",
      message: "Dynamic user content is inserted without clear boundaries, which can invite instruction mixing.",
      evidence: placeholders.evidence,
      suggestion: "Wrap dynamic content in XML tags, code fences, or a quoted block with explicit boundaries.",
      startIndex: placeholders.startIndex,
      endIndex: placeholders.endIndex,
    });
  }

  const obfuscated = findObfuscatedAttacks(source);
  if (obfuscated.evidence.length) {
    diagnostics.push({
      ruleId: "obfuscated-attack-pattern",
      title: "Obfuscated attack pattern",
      severity: "critical",
      category: "security",
      message: "The prompt includes lightly obfuscated instruction-override language.",
      evidence: obfuscated.evidence,
      suggestion: "Remove obfuscated override text and add a clear instruction hierarchy.",
      startIndex: obfuscated.startIndex,
      endIndex: obfuscated.endIndex,
    });
  }

  const normalized = scanContext?.normalized;

  if (normalized?.changed) {
    const normalizedInjection = collectMatches(normalized.text, INJECTION_PATTERNS);
    const normalizedSecret = collectMatches(normalized.text, SECRET_REQUEST_PATTERNS);
    const normalizedObfuscated = findObfuscatedAttacks(normalized.text);
    const normalizedEvidence = [
      ...normalizedInjection.evidence,
      ...normalizedSecret.evidence,
      ...normalizedObfuscated.evidence,
    ];

    if (normalizedEvidence.length && !hasDiagnostic(diagnostics, "obfuscated-attack-pattern", "original")) {
      diagnostics.push({
        ruleId: "obfuscated-attack-pattern",
        title: "Obfuscated attack pattern",
        severity: "critical",
        category: "security",
        message: "After light normalization, the prompt contains instruction-override or secret-exfiltration language.",
        evidence: [...new Set([...normalizedEvidence, ...normalized.changes])].slice(0, 5),
        suggestion: "Remove disguised override text and keep untrusted content in explicit input boundaries.",
        source: "normalized",
      });
    }
  }

  const decodedVariants = scanContext?.decodedVariants ?? [];
  for (const variant of decodedVariants) {
    const decodedInjection = collectMatches(variant.decoded, INJECTION_PATTERNS);
    const decodedSecret = collectMatches(variant.decoded, SECRET_REQUEST_PATTERNS);
    const decodedEvidence = [...decodedInjection.evidence, ...decodedSecret.evidence];

    if (decodedEvidence.length) {
      diagnostics.push({
        ruleId: "obfuscated-attack-pattern",
        title: "Encoded attack pattern",
        severity: "critical",
        category: "security",
        message: `A ${variant.encoding} fragment decodes to instruction-override or secret-exfiltration language.`,
        evidence: [
          `${variant.encoding}: ${variant.original.slice(0, 72)}${variant.original.length > 72 ? "..." : ""}`,
          ...decodedEvidence,
        ],
        suggestion: "Remove encoded payloads or treat them as inert source data with explicit boundaries.",
        source: "decoded",
      });
      break;
    }
  }

  const sensitive = collectMatches(source, SENSITIVE_PATTERNS);
  if (sensitive.evidence.length) {
    diagnostics.push({
      ruleId: "sensitive-data-leak",
      title: "Sensitive data in prompt",
      severity: "error",
      category: "privacy",
      message: "The prompt appears to include private or credential-like data.",
      evidence: sensitive.evidence,
      suggestion: "Redact or replace sensitive values with placeholders before sending the prompt.",
      startIndex: sensitive.startIndex,
      endIndex: sensitive.endIndex,
    });
  }

  if (source.length > 1200 || wordCount(source) > 220) {
    diagnostics.push({
      ruleId: "excessive-length",
      title: "Prompt may be too long",
      severity: "warning",
      category: "efficiency",
      message: "Long prompts are harder to inspect and can bury the actual task.",
      evidence: [`${wordCount(source)} words`, `~${document.estimatedTokens} tokens`],
      suggestion: "Split the prompt into task, context, constraints, and output format sections.",
    });
  }

  const repeated = findRepeatedInstructions(source);
  if (repeated.evidence.length) {
    diagnostics.push({
      ruleId: "repeated-instructions",
      title: "Repeated instruction",
      severity: "info",
      category: "efficiency",
      message: "Duplicated instructions add noise without improving model reliability.",
      evidence: repeated.evidence,
      suggestion: "Keep one canonical version of each instruction or constraint.",
    });
  }

  if (wordCount(source) > 90 && !/\b(?:example|examples|for instance|e\.g\.)\b/i.test(source)) {
    diagnostics.push({
      ruleId: "missing-examples-for-complex-task",
      title: "Complex task lacks examples",
      severity: "info",
      category: "structure",
      message: "A complex prompt can be easier to follow with one concrete example.",
      evidence: [],
      suggestion: "Add a short input-output example that shows the expected style or edge case.",
    });
  }

  const uniqueDiagnostics = diagnostics.filter((diagnostic, index, all) => {
    const key = `${diagnostic.ruleId}:${diagnostic.source ?? "original"}:${diagnostic.evidence.join("|")}`;
    return all.findIndex((candidate) => `${candidate.ruleId}:${candidate.source ?? "original"}:${candidate.evidence.join("|")}` === key) === index;
  });

  return uniqueDiagnostics.map((diagnostic, index) => createDiagnostic(diagnostic, index, document));
}
