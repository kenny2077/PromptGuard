"use client";

import {
  AlertTriangle,
  Activity,
  Braces,
  CheckCircle2,
  ChevronDown,
  Clock,
  Clipboard,
  Code2,
  Copy,
  FileJson2,
  Fingerprint,
  History,
  Info,
  MapPin,
  RefreshCw,
  ScanLine,
  Settings,
  ShieldCheck,
  Sparkles,
  Wand2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { analyzePrompt } from "../lib/analysis";
import { normalizePromptInput } from "../lib/analysis/input";
import { demoExamples } from "../lib/examples/demo-examples";
import { cn } from "../lib/utils";
import type {
  AnalysisOptions,
  AnalysisReport,
  Category,
  Diagnostic,
  RiskLevel,
  Severity,
} from "../types/analysis";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";

const severityOrder: Severity[] = ["critical", "error", "warning", "info"];

type InputMode = "plain" | "messages";

const productNavItems = [
  { label: "Scanner", icon: ScanLine, active: true },
  { label: "Report", icon: Activity, active: false },
  { label: "History", icon: History, active: false },
  { label: "About", icon: Info, active: false },
];

const severityMeta: Record<
  Severity,
  { label: string; tone: "neutral" | "teal" | "amber" | "rose" | "blue"; className: string }
> = {
  critical: {
    label: "Critical",
    tone: "rose",
    className: "border-rose-200 bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/30",
  },
  error: {
    label: "Error",
    tone: "rose",
    className: "border-orange-200 bg-orange-50 dark:border-orange-900/60 dark:bg-orange-950/25",
  },
  warning: {
    label: "Warning",
    tone: "amber",
    className: "border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/25",
  },
  info: {
    label: "Info",
    tone: "blue",
    className: "border-sky-200 bg-sky-50 dark:border-sky-900/60 dark:bg-sky-950/25",
  },
};

const categoryLabels: Record<Category, string> = {
  clarity: "Clarity",
  security: "Security",
  structure: "Structure",
  privacy: "Privacy",
  efficiency: "Efficiency",
};

const initialOptions: AnalysisOptions = {
  privacySensitivity: 3,
  clarityStrictness: 3,
  securityStrictness: 3,
};

const riskMeta: Record<RiskLevel, { label: string; className: string; description: string }> = {
  ready: {
    label: "Ready",
    className:
      "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900 dark:bg-teal-950/50 dark:text-teal-200",
    description: "No blocking issues found.",
  },
  "needs-edits": {
    label: "Needs edits",
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
    description: "Useful prompt, but the rewrite is safer.",
  },
  "high-risk": {
    label: "High risk",
    className:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200",
    description: "Review before sending this to a model.",
  },
};

function scoreTone(score: number) {
  if (score >= 85) return "text-teal-600 dark:text-teal-300";
  if (score >= 65) return "text-amber-600 dark:text-amber-300";
  return "text-rose-600 dark:text-rose-300";
}

function scoreBar(score: number) {
  if (score >= 85) return "bg-teal-500";
  if (score >= 65) return "bg-amber-500";
  return "bg-rose-500";
}

function formatLocation(diagnostic: Diagnostic) {
  if (!diagnostic.location) return null;
  return `L${diagnostic.location.startLine}:C${diagnostic.location.startColumn}`;
}

function sourceLabel(diagnostic: Diagnostic) {
  if (diagnostic.source === "decoded") return "Decoded";
  if (diagnostic.source === "normalized") return "Normalized";
  return "Original";
}

function groupDiagnostics(diagnostics: Diagnostic[]) {
  return severityOrder.map((severity) => ({
    severity,
    diagnostics: diagnostics.filter((diagnostic) => diagnostic.severity === severity),
  }));
}

function ScanSnapshot({ report }: { report: AnalysisReport }) {
  const metadata = report.metadata;
  const risk = riskMeta[metadata.riskLevel];
  const items = [
    {
      label: "Scan time",
      value: `${metadata.durationMs}ms`,
      icon: <Clock className="h-4 w-4" />,
    },
    {
      label: "Prompt size",
      value: `${metadata.estimatedTokens} tokens`,
      icon: <ScanLine className="h-4 w-4" />,
    },
    {
      label: "Format",
      value: metadata.inputFormat === "message-array" ? "Message JSON" : "Plain text",
      icon: <Code2 className="h-4 w-4" />,
    },
    {
      label: "Variables",
      value: `${metadata.variableCount}`,
      icon: <Braces className="h-4 w-4" />,
    },
    {
      label: "Fingerprint",
      value: metadata.fingerprint,
      icon: <Fingerprint className="h-4 w-4" />,
    },
  ];

  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-950 dark:text-white">Scan snapshot</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{risk.description}</p>
        </div>
        <span className={cn("inline-flex items-center rounded-md border px-2.5 py-1 text-sm font-semibold", risk.className)}>
          {risk.label}
        </span>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/70"
          >
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              {item.icon}
              {item.label}
            </div>
            <div className="mt-1 truncate text-sm font-semibold text-slate-950 dark:text-white">{item.value}</div>
          </div>
        ))}
      </div>
      {metadata.normalized || metadata.decodedVariantCount > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {metadata.normalized ? <Badge tone="amber">Normalized scan surface</Badge> : null}
          {metadata.decodedEncodings.map((encoding) => (
            <Badge key={encoding} tone="blue">
              Decoded {encoding}
            </Badge>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function EvidenceSummary({ report }: { report: AnalysisReport }) {
  const evidence = report.diagnostics
    .flatMap((diagnostic) =>
      diagnostic.evidence.slice(0, 2).map((item) => ({
        item,
        diagnostic,
      })),
    )
    .slice(0, 6);

  if (!evidence.length) return null;

  return (
    <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/70">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        <MapPin className="h-3.5 w-3.5" />
        Flagged evidence
      </div>
      <div className="flex flex-wrap gap-2">
        {evidence.map(({ item, diagnostic }) => (
          <span
            key={`${diagnostic.id}-${item}`}
            className="inline-flex max-w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
            title={diagnostic.title}
          >
            <span className="max-w-48 truncate font-mono">{item}</span>
            <span className="text-slate-400">{formatLocation(diagnostic) ?? sourceLabel(diagnostic)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function getStoredState() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem("promptguard-state");
    return raw ? (JSON.parse(raw) as Partial<PromptGuardState>) : null;
  } catch {
    return null;
  }
}

interface PromptGuardState {
  prompt: string;
  mode: InputMode;
  options: AnalysisOptions;
}

function ScoreCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
          {icon}
          {label}
        </div>
        <span className={cn("text-2xl font-semibold tabular-nums", scoreTone(value))}>{value}</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-900">
        <div className={cn("h-full rounded-full", scoreBar(value))} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function SliderControl({
  label,
  value,
  onChange,
  surface = "light",
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  surface?: "light" | "dark";
}) {
  const descriptor = value <= 2 ? "Light" : value === 3 ? "Balanced" : "Strict";
  const isDark = surface === "dark";

  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className={cn("font-medium", isDark ? "text-white/82" : "text-slate-700 dark:text-slate-200")}>{label}</span>
        <span className={cn("text-xs font-medium", isDark ? "text-white/40" : "text-slate-500 dark:text-slate-400")}>
          {descriptor}
        </span>
      </div>
      <input
        aria-label={label}
        type="range"
        min={1}
        max={5}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className={cn(
          "h-2 w-full cursor-pointer appearance-none rounded-full",
          isDark ? "bg-white/12 accent-white" : "bg-slate-200 accent-slate-950 dark:bg-slate-800 dark:accent-white",
        )}
      />
    </label>
  );
}

function ProductNavItem({
  icon: Icon,
  label,
  active = false,
}: {
  icon: typeof ScanLine;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        "group flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium transition lg:w-10 lg:justify-center lg:px-0 lg:group-hover/sidebar:w-full lg:group-hover/sidebar:justify-start lg:group-hover/sidebar:px-3",
        active ? "bg-white/[0.08] text-white" : "text-white/55 hover:bg-white/[0.05] hover:text-white/82",
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", active ? "text-white" : "text-white/45")} />
      <span className="lg:hidden lg:group-hover/sidebar:inline">{label}</span>
    </button>
  );
}

function SidebarDropdown({
  icon: Icon,
  label,
  value,
  open,
  onToggle,
  children,
}: {
  icon: typeof ScanLine;
  label: string;
  value?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium text-white/60 transition hover:bg-white/[0.05] hover:text-white/85",
          "lg:w-10 lg:justify-center lg:px-0 lg:group-hover/sidebar:w-full lg:group-hover/sidebar:justify-start lg:group-hover/sidebar:px-3",
          open && "bg-white/[0.06] text-white",
        )}
      >
        <Icon className="h-4 w-4 shrink-0 text-white/48" />
        <span className="lg:hidden lg:group-hover/sidebar:inline">{label}</span>
        {value ? (
          <span className="ml-auto text-xs font-medium text-white/35 lg:hidden lg:group-hover/sidebar:inline">{value}</span>
        ) : null}
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-white/35 transition lg:hidden lg:group-hover/sidebar:block",
            open && "rotate-180",
          )}
        />
      </button>
      {open ? (
        <div className="mt-2 rounded-md border border-white/10 bg-white/[0.035] p-3 lg:hidden lg:group-hover/sidebar:block">
          {children}
        </div>
      ) : null}
    </section>
  );
}

function ProductSidebar({
  mode,
  setMode,
  options,
  onOptionChange,
}: {
  mode: InputMode;
  setMode: (mode: InputMode) => void;
  options: AnalysisOptions;
  onOptionChange: (key: keyof AnalysisOptions, value: number) => void;
}) {
  const [inputOpen, setInputOpen] = useState(false);
  const [parametersOpen, setParametersOpen] = useState(false);
  const inputModeLabel = mode === "messages" ? "JSON" : "Plain";

  return (
    <aside className="group/sidebar shrink-0 border-b border-black/10 bg-[#080810] text-white lg:sticky lg:top-0 lg:h-screen lg:w-16 lg:border-b-0 lg:border-r lg:overflow-x-hidden lg:overflow-y-auto lg:transition-[width] lg:duration-300 lg:ease-out lg:hover:w-[292px]">
      <div className="flex flex-col lg:min-h-full lg:w-[292px]">
        <div className="px-5 py-5">
          <Link href="/" className="flex items-center gap-3" aria-label="PromptGuard overview">
            <span className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/[0.06]">
              <ShieldCheck className="h-4 w-4 text-white" />
            </span>
            <span className="lg:hidden lg:group-hover/sidebar:block">
              <span className="block text-lg font-semibold text-white">PromptGuard</span>
              <span className="block text-xs font-medium text-white/42">Scanner console</span>
            </span>
          </Link>
        </div>

        <div className="px-3 pb-5 lg:pb-0">
          <nav className="space-y-1.5">
            <ProductNavItem {...productNavItems[0]} />
            <SidebarDropdown
              icon={FileJson2}
              label="Input mode"
              value={inputModeLabel}
              open={inputOpen}
              onToggle={() => setInputOpen((value) => !value)}
            >
              <div className="grid grid-cols-2 rounded-md border border-white/10 bg-white/[0.04] p-1">
                {[
                  ["plain", "Plain"],
                  ["messages", "JSON"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMode(value as InputMode)}
                    className={cn(
                      "rounded px-2 py-2 text-xs font-semibold transition",
                      mode === value ? "bg-white text-[#080810]" : "text-white/55 hover:text-white",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </SidebarDropdown>
            <SidebarDropdown
              icon={Settings}
              label="Parameters"
              open={parametersOpen}
              onToggle={() => setParametersOpen((value) => !value)}
            >
              <div className="space-y-4">
                <SliderControl
                  surface="dark"
                  label="Privacy"
                  value={options.privacySensitivity}
                  onChange={(value) => onOptionChange("privacySensitivity", value)}
                />
                <SliderControl
                  surface="dark"
                  label="Clarity"
                  value={options.clarityStrictness}
                  onChange={(value) => onOptionChange("clarityStrictness", value)}
                />
                <SliderControl
                  surface="dark"
                  label="Security"
                  value={options.securityStrictness}
                  onChange={(value) => onOptionChange("securityStrictness", value)}
                />
              </div>
            </SidebarDropdown>
            {productNavItems.slice(1).map((item) => (
              <ProductNavItem key={item.label} {...item} />
            ))}
          </nav>
        </div>
      </div>
    </aside>
  );
}

function EmptyReport() {
  return (
    <div className="flex min-h-[560px] flex-col items-center justify-center rounded-md border border-dashed border-slate-300 bg-white/70 px-8 text-center dark:border-slate-800 dark:bg-slate-950/50">
      <div className="flex h-14 w-14 items-center justify-center rounded-md bg-slate-100 text-slate-950 dark:bg-slate-900 dark:text-white">
        <ShieldCheck className="h-7 w-7" />
      </div>
      <h2 className="mt-5 text-xl font-semibold text-slate-950 dark:text-white">Ready to scan</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-600 dark:text-slate-400">
        Paste a prompt to get scores, diagnostics, and a safer rewrite.
      </p>
    </div>
  );
}

function DiagnosticList({ report }: { report: AnalysisReport }) {
  const grouped = groupDiagnostics(report.diagnostics);

  if (!report.diagnostics.length) {
    return (
      <div className="rounded-md border border-teal-200 bg-teal-50 p-4 text-sm text-teal-800 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-200">
        <div className="flex items-center gap-2 font-medium">
          <CheckCircle2 className="h-4 w-4" />
          No issues found
        </div>
        <p className="mt-1 text-teal-700 dark:text-teal-300">This prompt is clear, bounded, and demo-ready.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {grouped.map(({ severity, diagnostics }) => {
        if (!diagnostics.length) return null;

        return (
          <div key={severity} className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge tone={severityMeta[severity].tone}>{severityMeta[severity].label}</Badge>
              <span className="text-xs text-slate-500 dark:text-slate-400">{diagnostics.length} issue(s)</span>
            </div>
            {diagnostics.map((diagnostic) => (
              <article
                key={diagnostic.id}
                className={cn("rounded-md border p-4", severityMeta[diagnostic.severity].className)}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-950 dark:text-white">{diagnostic.title}</h3>
                  <Badge tone="neutral">{categoryLabels[diagnostic.category]}</Badge>
                  <Badge tone={diagnostic.source === "decoded" ? "blue" : diagnostic.source === "normalized" ? "amber" : "neutral"}>
                    {sourceLabel(diagnostic)}
                  </Badge>
                  {formatLocation(diagnostic) ? <Badge tone="neutral">{formatLocation(diagnostic)}</Badge> : null}
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-300">{diagnostic.message}</p>
                {diagnostic.evidence.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {diagnostic.evidence.map((item) => (
                      <code
                        key={item}
                        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
                      >
                        {item}
                      </code>
                    ))}
                  </div>
                ) : null}
                <p className="mt-3 text-sm font-medium text-slate-800 dark:text-slate-200">
                  Fix: <span className="font-normal">{diagnostic.suggestion}</span>
                </p>
              </article>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function RewritePanel({
  report,
  original,
  compareMode,
  setCompareMode,
  onCopyRewrite,
  onCopyReport,
  onAiRewrite,
  aiStatus,
  aiBusy,
}: {
  report: AnalysisReport;
  original: string;
  compareMode: "rewritten" | "original";
  setCompareMode: (mode: "rewritten" | "original") => void;
  onCopyRewrite: () => void;
  onCopyReport: () => void;
  onAiRewrite: () => void;
  aiStatus: string;
  aiBusy: boolean;
}) {
  const displayed = compareMode === "original" ? original : report.rewrittenPrompt;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Safer rewrite</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Deterministic by default, AI-assisted when configured.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-md border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-950">
            <button
              type="button"
              onClick={() => setCompareMode("rewritten")}
              className={cn(
                "rounded px-3 py-1.5 text-xs font-medium transition",
                compareMode === "rewritten"
                  ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                  : "text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white",
              )}
            >
              Rewritten
            </button>
            <button
              type="button"
              onClick={() => setCompareMode("original")}
              className={cn(
                "rounded px-3 py-1.5 text-xs font-medium transition",
                compareMode === "original"
                  ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                  : "text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white",
              )}
            >
              Original
            </button>
          </div>
          <Button size="sm" onClick={onCopyRewrite}>
            <Copy className="h-3.5 w-3.5" />
            Copy
          </Button>
          <Button size="sm" variant="ghost" onClick={onCopyReport}>
            <FileJson2 className="h-3.5 w-3.5" />
            JSON
          </Button>
        </div>
      </div>

      <pre className="max-h-[360px] overflow-auto rounded-md border border-slate-200 bg-slate-950 p-4 text-sm leading-6 text-slate-100 shadow-sm dark:border-slate-800">
        <code>{displayed}</code>
      </pre>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={onAiRewrite} disabled={aiBusy}>
          {aiBusy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          AI-assisted rewrite
        </Button>
        {aiStatus ? <span className="text-sm text-slate-500 dark:text-slate-400">{aiStatus}</span> : null}
      </div>

      {report.changes.length ? (
        <div className="rounded-md border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <h3 className="text-sm font-semibold text-slate-950 dark:text-white">What changed</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
            {report.changes.map((change) => (
              <li key={`${change.kind}-${change.description}`} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-600 dark:text-teal-300" />
                <span>{change.description}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function PromptGuardApp() {
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<InputMode>("plain");
  const [options, setOptions] = useState<AnalysisOptions>(initialOptions);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [inputError, setInputError] = useState("");
  const [compareMode, setCompareMode] = useState<"rewritten" | "original">("rewritten");
  const [copyStatus, setCopyStatus] = useState("");
  const [aiStatus, setAiStatus] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const demoId = new URLSearchParams(window.location.search).get("demo");
      const demo = demoExamples.find((example) => example.id === demoId);

      if (demo) {
        const nextMode = demo.mode ?? "plain";
        const prepared = normalizePromptInput(demo.prompt, nextMode);

        setPrompt(demo.prompt);
        setMode(nextMode);
        setOptions(initialOptions);

        if (prepared.ok) {
          setInputError("");
          setReport(analyzePrompt(prepared.text, initialOptions, prepared.format));
          setCompareMode("rewritten");
          setAiStatus("");
        }

        return;
      }

      const stored = getStoredState();

      if (!stored) return;

      if (stored.prompt) setPrompt(stored.prompt);
      if (stored.mode) setMode(stored.mode);
      if (stored.options) setOptions(stored.options);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      "promptguard-state",
      JSON.stringify({
        prompt,
        mode,
        options,
      }),
    );
  }, [prompt, mode, options]);

  const normalized = useMemo(() => normalizePromptInput(prompt, mode), [prompt, mode]);
  const normalizedText = normalized.ok ? normalized.text : prompt;

  function runAnalysis(nextPrompt = prompt, nextMode = mode) {
    const prepared = normalizePromptInput(nextPrompt, nextMode);

    if (!prepared.ok) {
      setInputError(prepared.error);
      setReport(null);
      return;
    }

    setInputError("");
    setReport(analyzePrompt(prepared.text, options, prepared.format));
    setCompareMode("rewritten");
    setAiStatus("");
  }

  function updateScoringOption(key: keyof AnalysisOptions, value: number) {
    const nextOptions = { ...options, [key]: value };
    setOptions(nextOptions);

    if (report && normalized.ok) {
      setReport(analyzePrompt(normalized.text, nextOptions, normalized.format));
    }
  }

  async function copyText(value: string, status: string) {
    await navigator.clipboard.writeText(value);
    setCopyStatus(status);
    window.setTimeout(() => setCopyStatus(""), 1600);
  }

  async function requestAiRewrite() {
    if (!report) return;

    setAiBusy(true);
    setAiStatus("");

    try {
      const response = await fetch("/api/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: normalizedText, report }),
      });
      const payload = (await response.json()) as {
        mode: "ai" | "deterministic";
        rewrittenPrompt: string;
        changes: AnalysisReport["changes"];
        message?: string;
      };

      setReport((current) =>
        current
          ? {
              ...current,
              rewrittenPrompt: payload.rewrittenPrompt,
              changes: payload.changes,
            }
          : current,
      );
      setAiStatus(payload.message ?? (payload.mode === "ai" ? "AI rewrite applied." : "Using deterministic rewrite."));
    } catch {
      setAiStatus("AI rewrite unavailable. Deterministic rewrite is still ready.");
    } finally {
      setAiBusy(false);
    }
  }

  const scoreCards = report
    ? [
        { label: "Overall", value: report.scores.overall, icon: <ShieldCheck className="h-4 w-4" /> },
        { label: "Clarity", value: report.scores.clarity, icon: <Wand2 className="h-4 w-4" /> },
        { label: "Safety", value: report.scores.security, icon: <AlertTriangle className="h-4 w-4" /> },
        { label: "Structure", value: report.scores.structure, icon: <Code2 className="h-4 w-4" /> },
      ]
    : [];

  return (
    <div className="min-h-screen bg-[#f6f6f4] text-slate-950">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <ProductSidebar
          mode={mode}
          setMode={setMode}
          options={options}
          onOptionChange={updateScoringOption}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex min-h-14 items-center justify-between gap-3 border-b border-black/10 bg-[#f6f6f4]/95 px-5 py-3 backdrop-blur sm:px-8 lg:px-10">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase text-slate-500">Live product</p>
              <h1 className="text-xl font-semibold text-slate-950">Prompt scanner</h1>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {copyStatus ? <span className="hidden text-sm text-slate-500 sm:inline">{copyStatus}</span> : null}
              <Badge tone="neutral">{report ? "Report ready" : "Ready"}</Badge>
              <Link
                href="/"
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Overview
              </Link>
            </div>
          </header>

          <main className="flex-1 overflow-auto">
            <div className="mx-auto w-full max-w-[1520px] px-5 py-7 sm:px-8 lg:px-10">
              <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">Scan a prompt before it ships.</h2>
                  <p className="mt-2 max-w-2xl text-base leading-7 text-slate-600">
                    Paste a prompt, review structured diagnostics, and copy a safer rewrite.
                  </p>
                </div>
              </div>

              <section className="grid gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(420px,1.08fr)]">
                <section className="min-w-0 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-950">Prompt input</h3>
                      <p className="text-sm text-slate-500">
                        {mode === "messages" ? "OpenAI-style message array JSON." : "Plain text prompt."}
                      </p>
                    </div>
                    <Badge tone="neutral">{mode === "messages" ? "Message JSON" : "Plain text"}</Badge>
                  </div>

                  <Textarea
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    className="min-h-[380px] shadow-none lg:min-h-[520px]"
                    placeholder={
                      mode === "messages"
                        ? '[{"role":"user","content":"Summarize {{user_input}}"}]'
                        : "Paste a prompt to scan..."
                    }
                  />

                  {inputError ? (
                    <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                      {inputError}
                    </p>
                  ) : null}

                  {report ? <EvidenceSummary report={report} /> : null}

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
                    <p className="text-sm text-slate-500">Ready when your prompt is.</p>
                    <Button variant="primary" onClick={() => runAnalysis()} disabled={!prompt.trim()}>
                      <ShieldCheck className="h-4 w-4" />
                      Analyze prompt
                    </Button>
                  </div>
                </section>

                <div className="min-w-0 space-y-4">
                  {report ? (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {scoreCards.map((card) => (
                          <ScoreCard key={card.label} {...card} />
                        ))}
                      </div>

                      <ScanSnapshot report={report} />

                      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-semibold text-slate-950">Analysis report</h3>
                            <p className="text-sm text-slate-500">
                              {report.summary.critical} critical, {report.summary.errors} errors, {report.summary.warnings} warnings,{" "}
                              {report.summary.infos} infos
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyText(JSON.stringify(report, null, 2), "Report copied.")}
                          >
                            <Clipboard className="h-3.5 w-3.5" />
                            Copy report
                          </Button>
                        </div>
                        <DiagnosticList report={report} />
                      </section>

                      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
                        <RewritePanel
                          report={report}
                          original={normalizedText}
                          compareMode={compareMode}
                          setCompareMode={setCompareMode}
                          onCopyRewrite={() => copyText(report.rewrittenPrompt, "Rewrite copied.")}
                          onCopyReport={() => copyText(JSON.stringify(report, null, 2), "Report JSON copied.")}
                          onAiRewrite={requestAiRewrite}
                          aiStatus={aiStatus}
                          aiBusy={aiBusy}
                        />
                      </section>
                    </>
                  ) : (
                    <EmptyReport />
                  )}
                </div>
              </section>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
