"use client";

import { Copy, RefreshCw, RotateCcw, Sparkles, Wand2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { analyzePrompt } from "../lib/analysis";
import { normalizePromptInput } from "../lib/analysis/input";
import { demoExamples } from "../lib/examples/demo-examples";
import type { AnalysisReport } from "../types/analysis";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";

const storageKey = "promptguard-rewrite-state";

function countWords(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function getStoredState() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as Partial<{ prompt: string }>) : null;
  } catch {
    return null;
  }
}

function statusLabel(prompt: string, report: AnalysisReport | null) {
  if (report?.rewrittenPrompt) return "Rewrite ready";
  if (prompt.trim()) return "Ready to rewrite";
  return "Waiting for your input";
}

function EmptyRewriteOutput() {
  return (
    <div className="flex h-full min-h-0 w-full flex-1 items-center justify-center rounded-[24px] border border-slate-200 bg-[#fafaf8] px-6 py-10 text-center">
      <div className="mx-auto flex max-w-xl flex-col items-center justify-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-950">
          <Wand2 className="h-5 w-5" />
        </div>
        <h3 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">Your rewrite will appear here.</h3>
        <p className="mt-2 max-w-[34ch] text-sm leading-7 text-slate-500">
          Run the rewrite to turn rough or risky prompts into clearer, safer instructions.
        </p>
      </div>
    </div>
  );
}

export function PromptRewriteStudio() {
  const [prompt, setPrompt] = useState("");
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [inputError, setInputError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [aiStatus, setAiStatus] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const demoId = new URLSearchParams(window.location.search).get("demo");
      const demo = demoExamples.find((example) => example.id === demoId);

      if (demo) {
        const prepared = normalizePromptInput(demo.prompt, "plain");

        setPrompt(demo.prompt);

        if (prepared.ok) {
          setInputError("");
          setReport(analyzePrompt(prepared.text, {}, prepared.format));
        }

        return;
      }

      const stored = getStoredState();

      if (!stored) return;

      if (stored.prompt) setPrompt(stored.prompt);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        prompt,
      }),
    );
  }, [prompt]);

  const wordCount = useMemo(() => countWords(prompt), [prompt]);

  function runRewrite(nextPrompt = prompt) {
    const prepared = normalizePromptInput(nextPrompt, "plain");

    if (!prepared.ok) {
      setInputError(prepared.error);
      setReport(null);
      return;
    }

    setInputError("");
    setAiStatus("");
    setReport(analyzePrompt(prepared.text, {}, prepared.format));
  }

  function clearInput() {
    setPrompt("");
    setReport(null);
    setInputError("");
    setAiStatus("");
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
        body: JSON.stringify({ prompt, report }),
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

  return (
    <div className="pg-page-enter flex flex-col lg:h-screen lg:overflow-hidden">
      <header className="shrink-0 border-b border-black/10 px-5 py-5 lg:px-8">
        <h1 className="text-[2rem] font-semibold tracking-tight text-slate-950">Prompt rewrite</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          Rewrite vague or risky prompts into a cleaner version with a dedicated input and output workspace.
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
                {report?.rewrittenPrompt
                  ? "Review the rewritten prompt on the right and copy the version you want."
                  : "Paste a prompt and run the rewrite when you are ready."}
              </p>
            </div>

          </div>

          <div className="grid flex-1 min-h-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <section className="flex min-h-[560px] flex-col border-b border-black/10 p-5 lg:min-h-0 lg:border-b-0 lg:border-r lg:p-6">
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Original prompt</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Type or paste the prompt you want to rewrite.
              </p>

              <Textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                className="mt-4 min-h-[280px] flex-1 rounded-[24px] border-slate-200 bg-[#fafaf8] font-sans text-[1.03rem] leading-8 shadow-none focus:border-slate-300 focus:ring-0 lg:min-h-0"
                placeholder="Paste a prompt to rewrite..."
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
                  <Button variant="primary" onClick={() => runRewrite()} disabled={!prompt.trim()}>
                    <Wand2 className="h-4 w-4" />
                    Rewrite prompt
                  </Button>
                </div>
              </div>
            </section>

            <section className="flex min-h-[420px] flex-col bg-[#fafaf8] p-5 lg:min-h-0 lg:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Rewritten prompt</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    A safer, more structured version of your prompt will appear here.
                  </p>
                </div>
                {copyStatus ? <span className="text-sm text-slate-500">{copyStatus}</span> : null}
              </div>

              {report?.rewrittenPrompt ? (
                <div className="mt-4 flex min-h-0 flex-1 flex-col rounded-[24px] border border-slate-200 bg-white p-5">
                  <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap text-[1rem] leading-7 text-slate-800">
                    <code>{report.rewrittenPrompt}</code>
                  </pre>
                </div>
              ) : (
                <div className="mt-4 flex min-h-0 flex-1">
                  <EmptyRewriteOutput />
                </div>
              )}

              <div className="sticky bottom-0 z-10 mt-4 space-y-4 border-t border-slate-200 bg-[#fafaf8]/95 pt-4 pb-1 backdrop-blur supports-[backdrop-filter]:bg-[#fafaf8]/88">
                {aiStatus ? <p className="text-sm text-slate-500">{aiStatus}</p> : null}

                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button variant="secondary" onClick={requestAiRewrite} disabled={!report || aiBusy}>
                    {aiBusy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    Refine with AI
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => copyText(report?.rewrittenPrompt ?? "", "Rewrite copied.")}
                    disabled={!report?.rewrittenPrompt}
                  >
                    <Copy className="h-4 w-4" />
                    Copy rewrite
                  </Button>
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>
    </div>
  );
}
