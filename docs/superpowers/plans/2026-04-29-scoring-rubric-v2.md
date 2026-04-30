# Prompt Scoring Rubric V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current penalty-only scanner score with a gated rubric that reports verdicts, dimension scores, blockers, confidence, and a clearer report payload.

**Architecture:** Keep the existing deterministic rules engine, but layer a rubric assessment module on top of the diagnostics it emits. Continue returning legacy score cards for compatibility, while adding a richer `assessment` object that the UI can render directly.

**Tech Stack:** Next.js App Router, React client components, TypeScript, Vitest

---

### Task 1: Add failing tests for rubric output

**Files:**
- Modify: `tests/analysis.test.ts`

- [ ] Add regression tests for `invalid`, `needs-context`, `unsafe`, and `strong` verdicts plus confidence/blocker fields.
- [ ] Run: `npm test -- tests/analysis.test.ts`
- [ ] Confirm the new expectations fail before implementation.

### Task 2: Implement rubric assessment in analysis layer

**Files:**
- Modify: `types/analysis.ts`
- Create: `lib/analysis/assessment.ts`
- Modify: `lib/analysis/index.ts`
- Modify: `lib/analysis/score.ts`
- Modify: `lib/rewrite/deterministic.ts`

- [ ] Add new assessment types for verdict, band, dimensions, blockers, and confidence.
- [ ] Build a deterministic rubric scorer that derives gates and positive readiness dimensions from diagnostics.
- [ ] Map the new rubric output back into the existing legacy score breakdown.
- [ ] Update rewrite fallbacks to use the richer assessment signals where helpful.
- [ ] Run: `npm test -- tests/analysis.test.ts`

### Task 3: Update scanner output surfaces

**Files:**
- Modify: `components/promptguard-app.tsx`

- [ ] Replace the current “single scalar first” presentation with verdict, readiness/safety/confidence cards, and a dimension breakdown.
- [ ] Surface top blockers and best next fix in the report area.
- [ ] Keep report copy/export working with the new JSON shape.
- [ ] Run: `npm test -- tests/analysis.test.ts`
- [ ] Run: `npm test`
- [ ] Run: `npm run lint`
- [ ] Run: `npm run build`
