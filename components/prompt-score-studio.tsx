"use client";

import { RotateCcw, ScanLine, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { analyzePrompt } from "../lib/analysis";
import { normalizePromptInput } from "../lib/analysis/input";
import { demoExamples } from "../lib/examples/demo-examples";
import { cn } from "../lib/utils";
import type {
  AnalysisOptions,
  AnalysisReport,
  PromptVerdict,
} from "../types/analysis";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";

const storageKey = "promptguard-score-state";

const initialOptions: AnalysisOptions = {
  privacySensitivity: 3,
  clarityStrictness: 3,
  securityStrictness: 3,
};

const tuningPresets = [
  { id: "light", label: "Light", value: 2 },
  { id: "balanced", label: "Balanced", value: 3 },
  { id: "strict", label: "Strict", value: 4 },
] as const;

const verdictMeta: Record<PromptVerdict, { label: string; badge: string; summary: string }> = {
  invalid: {
    label: "Invalid",
    badge: "border-slate-300 bg-slate-100 text-slate-900",
    summary: "The prompt is too thin or too vague to score well.",
  },
  "needs-context": {
    label: "Needs context",
    badge: "border-slate-300 bg-[#f5f5f3] text-slate-900",
    summary: "The task exists, but it is still missing key context or scope.",
  },
  unsafe: {
    label: "Unsafe",
    badge: "border-slate-950 bg-slate-950 text-white",
    summary: "Security or privacy issues should be fixed before the prompt is used.",
  },
  usable: {
    label: "Usable",
    badge: "border-slate-300 bg-white text-slate-700",
    summary: "The prompt is workable, but it can still be sharpened.",
  },
  strong: {
    label: "Strong",
    badge: "border-slate-950 bg-slate-950 text-white",
    summary: "The prompt looks ready to use.",
  },
};

function countWords(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function getStoredState() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as Partial<{ prompt: string; options: AnalysisOptions }>) : null;
  } catch {
    return null;
  }
}

function detectPreset(options: AnalysisOptions) {
  const values = [options.privacySensitivity, options.clarityStrictness, options.securityStrictness];
  return tuningPresets.find((preset) => values.every((value) => value === preset.value))?.id ?? null;
}

function scoreTone(score: number) {
  if (score >= 90) return "text-slate-950";
  if (score >= 75) return "text-slate-700";
  return "text-slate-500";
}

function scoreBar(score: number) {
  if (score >= 90) return "bg-slate-950";
  if (score >= 75) return "bg-slate-700";
  return "bg-slate-400";
}

function statusLabel(prompt: string, report: AnalysisReport | null) {
  if (report) return "Score ready";
  if (prompt.trim()) return "Ready to analyze";
  return "Waiting for your input";
}

function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function severityLabel(summary: AnalysisReport["summary"]) {
  const pairs: Array<[keyof AnalysisReport["summary"], string, string]> = [
    ["critical", "critical", "criticals"],
    ["errors", "error", "errors"],
    ["warnings", "warning", "warnings"],
    ["infos", "info", "infos"],
  ];

  return pairs
    .filter(([key]) => summary[key] > 0)
    .map(([key, singular, plural]) => countLabel(summary[key], singular, plural))
    .join(" · ");
}

function OptionChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-4 py-2 text-sm font-medium transition",
        active
          ? "border-slate-950 bg-slate-950 text-white"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950",
      )}
    >
      {label}
    </button>
  );
}

function MetricRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <span className={cn("text-sm font-semibold tabular-nums", scoreTone(value))}>{value}</span>
      </div>
      <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-slate-200">
        <div className={cn("h-full rounded-full", scoreBar(value))} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-slate-200 bg-[#fafaf8] px-4 py-3">
      <div className="text-[0.68rem] font-medium uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-2 text-base font-semibold tracking-tight text-slate-900">{value}</div>
    </div>
  );
}

function EmptyResults() {
  return (
    <div className="flex h-full min-h-0 w-full flex-1 items-center justify-center rounded-[24px] border border-slate-200 bg-white px-6 py-10 text-center">
      <div className="mx-auto flex max-w-xl flex-col items-center justify-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-[#fafaf8] text-slate-950">
          <ScanLine className="h-5 w-5" />
        </div>
        <h3 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">Your score will appear here.</h3>
        <p className="mt-2 max-w-[34ch] text-sm leading-7 text-slate-500">
          Run the detector to score prompt readiness, safety, and the most important next fix.
        </p>
      </div>
    </div>
  );
}

function ResultsPanel({ report, wordCount }: { report: AnalysisReport; wordCount: number }) {
  const assessment = report.assessment;
  const blockers = assessment.topBlockers.slice(0, 3);
  const summaryText = severityLabel(report.summary);
  const issueCount = report.summary.critical + report.summary.errors + report.summary.warnings;

  return (
    <div className="space-y-4">
      <div className="rounded-[24px] border border-slate-200 bg-white p-5">
        <div className="grid gap-4 sm:grid-cols-[190px_minmax(0,1fr)] sm:items-center">
          <div className="flex min-h-[146px] flex-col items-center justify-center rounded-[20px] border border-slate-200 bg-[#fafaf8] px-5 py-5 text-center">
            <div className="text-[0.68rem] font-medium uppercase tracking-[0.18em] text-slate-400">Overall score</div>
            <div className="mt-3 flex items-end justify-center gap-3">
              <span className={cn("text-[3.6rem] font-semibold leading-none tracking-tight tabular-nums", scoreTone(assessment.overallScore))}>
                {assessment.overallScore}
              </span>
              <span className="pb-1 text-sm text-slate-500">{assessment.scoreBand}</span>
            </div>
          </div>

          <div className="grid gap-3">
            <MetricRow label="Readiness" value={assessment.readinessScore} />
            <MetricRow label="Safety" value={assessment.safetyScore} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <StatCard label="Issues found" value={String(issueCount)} />
          <StatCard label="Prompt size" value={countLabel(wordCount, "word", "words")} />
          <StatCard label="Scan time" value={`${report.metadata.durationMs}ms`} />
        </div>
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Top blockers</h3>
          {summaryText ? <span className="text-xs text-slate-500">{summaryText}</span> : null}
        </div>

        {blockers.length ? (
          <div className="mt-4 space-y-3">
            {blockers.map((blocker) => (
              <article key={`${blocker.ruleId}-${blocker.title}`} className="rounded-[20px] border border-slate-200 bg-[#fafaf8] px-4 py-4">
                <div className="text-sm font-semibold text-slate-950">{blocker.title}</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{blocker.suggestion}</p>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-[20px] border border-slate-200 bg-[#fafaf8] px-4 py-4 text-sm leading-6 text-slate-600">
            No material blockers were surfaced in this scan.
          </div>
        )}

        <div className="mt-4 text-xs text-slate-500">
          {report.metadata.estimatedTokens} tokens · {countLabel(report.metadata.lineCount, "line", "lines")}
        </div>
      </div>
    </div>
  );
}

export function PromptScoreStudio() {
  const [prompt, setPrompt] = useState("");
  const [options, setOptions] = useState<AnalysisOptions>(initialOptions);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [inputError, setInputError] = useState("");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const demoId = new URLSearchParams(window.location.search).get("demo");
      const demo = demoExamples.find((example) => example.id === demoId);

      if (demo) {
        const prepared = normalizePromptInput(demo.prompt, "plain");

        setPrompt(demo.prompt);
        setOptions(initialOptions);

        if (prepared.ok) {
          setInputError("");
          setReport(analyzePrompt(prepared.text, initialOptions, prepared.format));
        }

        return;
      }

      const stored = getStoredState();

      if (!stored) return;

      if (stored.prompt) setPrompt(stored.prompt);
      if (stored.options) setOptions(stored.options);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        prompt,
        options,
      }),
    );
  }, [prompt, options]);

  const normalized = useMemo(() => normalizePromptInput(prompt, "plain"), [prompt]);
  const wordCount = useMemo(() => countWords(prompt), [prompt]);
  const activePreset = detectPreset(options);

  function runAnalysis(nextPrompt = prompt) {
    const prepared = normalizePromptInput(nextPrompt, "plain");

    if (!prepared.ok) {
      setInputError(prepared.error);
      setReport(null);
      return;
    }

    setInputError("");
    setReport(analyzePrompt(prepared.text, options, prepared.format));
  }

  function applyPreset(value: number) {
    const nextOptions = {
      privacySensitivity: value,
      clarityStrictness: value,
      securityStrictness: value,
    };
    setOptions(nextOptions);

    if (report && normalized.ok) {
      setReport(analyzePrompt(normalized.text, nextOptions, normalized.format));
    }
  }

  function clearInput() {
    setPrompt("");
    setReport(null);
    setInputError("");
  }

  return (
    <div className="pg-page-enter flex flex-col lg:h-screen lg:overflow-hidden">
      <header className="shrink-0 border-b border-black/10 px-5 py-5 lg:px-8">
        <h1 className="text-[2rem] font-semibold tracking-tight text-slate-950">Prompt Detector</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          Score prompt readiness, context, and safety before you send it to a model.
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden p-5 lg:p-8">
        <section className="flex h-full min-h-[680px] flex-col overflow-hidden rounded-[30px] border border-black/10 bg-white shadow-sm lg:min-h-0">
          <div className="shrink-0 flex flex-col gap-4 border-b border-black/10 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-lg font-semibold text-slate-950">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-950" />
                {statusLabel(prompt, report)}
              </div>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                {report ? verdictMeta[report.assessment.verdict].summary : "Paste a prompt and analyze it when you are ready."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-full border border-slate-200 bg-[#fafaf8] p-1">
                {tuningPresets.map((preset) => (
                  <OptionChip
                    key={preset.id}
                    active={activePreset === preset.id}
                    label={preset.label}
                    onClick={() => applyPreset(preset.value)}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="grid flex-1 min-h-0 lg:grid-cols-[minmax(0,1fr)_minmax(380px,0.94fr)] xl:grid-cols-[minmax(0,1.02fr)_minmax(420px,0.98fr)]">
            <section className="flex min-h-[560px] flex-col border-b border-black/10 p-5 lg:min-h-0 lg:border-b-0 lg:border-r lg:p-6">
              <p className="text-sm leading-6 text-slate-500">
                Type or paste the prompt you want to score.
              </p>

              <Textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                className="mt-4 min-h-[280px] flex-1 rounded-[24px] border-slate-200 bg-[#fafaf8] font-sans text-[1.03rem] leading-8 shadow-none focus:border-slate-300 focus:ring-0 lg:min-h-0"
                placeholder="Paste a prompt to scan..."
              />

              {inputError ? (
                <p className="mt-3 rounded-[18px] border border-slate-300 bg-[#f5f5f3] px-4 py-3 text-sm text-slate-700">
                  {inputError}
                </p>
              ) : null}

              <div className="sticky bottom-0 z-10 mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white/95 pt-4 pb-1 backdrop-blur supports-[backdrop-filter]:bg-white/85">
                <div className="text-sm text-slate-500">
                  <span className="font-medium text-slate-950">{wordCount}</span> words
                  {report ? (
                    <>
                      <span className="mx-2 text-slate-300">·</span>
                      <span className="font-medium text-slate-950">{report.metadata.estimatedTokens}</span> tokens
                    </>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="ghost" onClick={clearInput} disabled={!prompt}>
                    <RotateCcw className="h-4 w-4" />
                    Clear
                  </Button>
                  <Button variant="primary" onClick={() => runAnalysis()} disabled={!prompt.trim()}>
                    <ShieldCheck className="h-4 w-4" />
                    Analyze prompt
                  </Button>
                </div>
              </div>
            </section>

            <aside className="min-h-[420px] bg-[#fafaf8] p-5 lg:min-h-0 lg:p-6">
              <div className="h-full overflow-y-auto pr-1">
                {report ? <ResultsPanel report={report} wordCount={wordCount} /> : <EmptyResults />}
              </div>
            </aside>
          </div>
        </section>
      </div>
    </div>
  );
}
