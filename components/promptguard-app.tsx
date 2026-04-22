"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  Code2,
  Copy,
  FileJson2,
  Moon,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Sun,
  Wand2,
} from "lucide-react";
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
  DemoExample,
  Diagnostic,
  Severity,
} from "../types/analysis";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";

const severityOrder: Severity[] = ["critical", "error", "warning", "info"];

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

function groupDiagnostics(diagnostics: Diagnostic[]) {
  return severityOrder.map((severity) => ({
    severity,
    diagnostics: diagnostics.filter((diagnostic) => diagnostic.severity === severity),
  }));
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
  mode: "plain" | "messages";
  options: AnalysisOptions;
  dark: boolean;
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
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const descriptor = value <= 2 ? "Light" : value === 3 ? "Balanced" : "Strict";

  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-200">{label}</span>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{descriptor}</span>
      </div>
      <input
        aria-label={label}
        type="range"
        min={1}
        max={5}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-teal-600 dark:bg-slate-800"
      />
    </label>
  );
}

function EmptyReport() {
  return (
    <div className="flex min-h-[560px] flex-col items-center justify-center rounded-md border border-dashed border-slate-300 bg-white/70 px-8 text-center dark:border-slate-800 dark:bg-slate-950/50">
      <div className="flex h-14 w-14 items-center justify-center rounded-md bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-200">
        <ShieldCheck className="h-7 w-7" />
      </div>
      <h2 className="mt-5 text-xl font-semibold text-slate-950 dark:text-white">Ready to scan</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-600 dark:text-slate-400">
        Paste a prompt or load a demo example. PromptGuard will return scores, diagnostics, and a safer rewrite.
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
  const [mode, setMode] = useState<"plain" | "messages">("plain");
  const [options, setOptions] = useState<AnalysisOptions>(initialOptions);
  const [dark, setDark] = useState(false);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [inputError, setInputError] = useState("");
  const [compareMode, setCompareMode] = useState<"rewritten" | "original">("rewritten");
  const [copyStatus, setCopyStatus] = useState("");
  const [aiStatus, setAiStatus] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

  useEffect(() => {
    const stored = getStoredState();

    if (!stored) return;

    const frame = window.requestAnimationFrame(() => {
      if (stored.prompt) setPrompt(stored.prompt);
      if (stored.mode) setMode(stored.mode);
      if (stored.options) setOptions(stored.options);
      if (typeof stored.dark === "boolean") setDark(stored.dark);
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
        dark,
      }),
    );
  }, [prompt, mode, options, dark]);

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
    setReport(analyzePrompt(prepared.text, options));
    setCompareMode("rewritten");
    setAiStatus("");
  }

  function loadExample(example: DemoExample, analyze = true) {
    const nextMode = example.mode ?? "plain";
    setPrompt(example.prompt);
    setMode(nextMode);

    if (analyze) {
      const prepared = normalizePromptInput(example.prompt, nextMode);

      if (prepared.ok) {
        setInputError("");
        setReport(analyzePrompt(prepared.text, options));
        setCompareMode("rewritten");
        setAiStatus("");
      }
    }
  }

  function updateScoringOption(key: keyof AnalysisOptions, value: number) {
    const nextOptions = { ...options, [key]: value };
    setOptions(nextOptions);

    if (report && normalized.ok) {
      setReport(analyzePrompt(normalized.text, nextOptions));
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
    <div className={cn(dark && "dark")}>
      <main className="min-h-screen bg-[#f7f8fb] text-slate-950 dark:bg-[#07090d] dark:text-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-6 sm:px-8 lg:px-10">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-teal-700 dark:text-teal-300">Codex Creator Challenge MVP</p>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">PromptGuard</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone="teal">Deterministic core</Badge>
              <Button size="icon" variant="ghost" aria-label="Toggle dark mode" onClick={() => setDark((value) => !value)}>
                {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            </div>
          </header>

          <section className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">
            <div className="space-y-5">
              <div>
                <h2 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-5xl">
                  Catch vague, unsafe, and privacy-risky prompts before they reach an AI model.
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
                  PromptGuard is spellcheck plus safety scanner for prompts: paste, analyze, fix, and copy a safer version.
                </p>
              </div>

              <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Prompt input</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Analyze a plain prompt or OpenAI-style messages.</p>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-900">
                    <button
                      type="button"
                      onClick={() => setMode("plain")}
                      className={cn(
                        "rounded px-3 py-1.5 text-xs font-medium transition",
                        mode === "plain"
                          ? "bg-white text-slate-950 shadow-sm dark:bg-slate-800 dark:text-white"
                          : "text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white",
                      )}
                    >
                      Plain text
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode("messages")}
                      className={cn(
                        "rounded px-3 py-1.5 text-xs font-medium transition",
                        mode === "messages"
                          ? "bg-white text-slate-950 shadow-sm dark:bg-slate-800 dark:text-white"
                          : "text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white",
                      )}
                    >
                      Message JSON
                    </button>
                  </div>
                </div>

                <Textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder={
                    mode === "messages"
                      ? '[{"role":"user","content":"Summarize {{user_input}}"}]'
                      : "Paste a prompt to scan..."
                  }
                />

                {inputError ? (
                  <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
                    {inputError}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  {demoExamples.map((example) => (
                    <button
                      key={example.id}
                      type="button"
                      onClick={() => loadExample(example)}
                      className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-medium text-slate-700 transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-teal-800 dark:hover:bg-teal-950/40 dark:hover:text-teal-200"
                      title={example.description}
                    >
                      {example.label}
                    </button>
                  ))}
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                  <SliderControl
                    label="Privacy sensitivity"
                    value={options.privacySensitivity}
                    onChange={(value) => updateScoringOption("privacySensitivity", value)}
                  />
                  <SliderControl
                    label="Clarity strictness"
                    value={options.clarityStrictness}
                    onChange={(value) => updateScoringOption("clarityStrictness", value)}
                  />
                  <SliderControl
                    label="Security strictness"
                    value={options.securityStrictness}
                    onChange={(value) => updateScoringOption("securityStrictness", value)}
                  />
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <Button variant="primary" onClick={() => runAnalysis()} disabled={!prompt.trim()}>
                    <ShieldCheck className="h-4 w-4" />
                    Analyze prompt
                  </Button>
                  <Button onClick={() => loadExample(demoExamples[1])}>
                    <Sparkles className="h-4 w-4" />
                    Load demo example
                  </Button>
                  {copyStatus ? <span className="text-sm text-teal-700 dark:text-teal-300">{copyStatus}</span> : null}
                </div>
              </section>
            </div>

            <div className="space-y-5">
              {report ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {scoreCards.map((card) => (
                      <ScoreCard key={card.label} {...card} />
                    ))}
                  </div>

                  <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Analysis report</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
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

                  <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
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

          <section className="grid gap-4 border-t border-slate-200 py-6 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300 md:grid-cols-3">
            <div>
              <h2 className="font-semibold text-slate-950 dark:text-white">Privacy-friendly</h2>
              <p className="mt-2 leading-6">Core analysis runs locally in deterministic TypeScript with no database or auth.</p>
            </div>
            <div>
              <h2 className="font-semibold text-slate-950 dark:text-white">Demo-ready</h2>
              <p className="mt-2 leading-6">Examples cover vague prompts, injection language, privacy leaks, and better baselines.</p>
            </div>
            <div>
              <h2 className="font-semibold text-slate-950 dark:text-white">Optional AI assist</h2>
              <p className="mt-2 leading-6">When `OPENAI_API_KEY` exists, the rewrite endpoint can refine the deterministic version.</p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
