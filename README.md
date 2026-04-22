# PromptGuard

PromptGuard helps people catch vague, unsafe, and privacy-risky prompts before they send them to an AI model.

It is a polished MVP for the Codex Creator Challenge: a fast, local-first prompt scanner that feels like spellcheck plus safety review for LLM prompts.

## Screenshots

Add final demo screenshots here before submission:

- Main scanner workflow
- Severity diagnostics
- Safer rewrite comparison

## Core Features

- Deterministic TypeScript analysis engine
- 12 understandable prompt-quality and prompt-safety rules
- Severity levels: info, warning, error, critical
- Category scores for clarity, security, structure, and privacy
- Sliders that adjust scoring strictness without changing rule definitions
- Safer deterministic rewrite generator
- Built-in demo prompts for vague prompts, injection risk, privacy leaks, and structured work prompts
- Optional OpenAI-assisted rewrite route when `OPENAI_API_KEY` is configured
- No auth, no database, local state only

## Architecture

```text
app/
  api/rewrite/route.ts        Optional AI-assisted rewrite endpoint
  layout.tsx                  Metadata and root layout
  page.tsx                    Main app entry
components/
  promptguard-app.tsx         Complete scanner UI
  ui/                         Small shadcn-style primitives
lib/
  analysis/                   Rule engine, scoring, input normalization
  examples/                   Demo prompt presets
  rewrite/                    Deterministic rewrite engine
types/
  analysis.ts                 Shared report and diagnostic types
tests/
  analysis.test.ts            Lightweight engine tests
```

The core scanner runs deterministically in the browser. The optional `/api/rewrite` route uses the OpenAI Responses API only when an API key is available; otherwise the product remains fully functional with the deterministic rewrite.

## Rules

- `vague-instruction` warning
- `missing-output-format` warning
- `missing-task-definition` error
- `contradictory-directives` warning
- `prompt-injection-risk` critical
- `secret-exfiltration-risk` critical
- `undelimited-user-input` error
- `obfuscated-attack-pattern` critical
- `sensitive-data-leak` error
- `excessive-length` warning
- `repeated-instructions` info
- `missing-examples-for-complex-task` info

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Test

```bash
npm run lint
npm run test
npm run build
```

## Optional AI Rewrite

The app works without an API key. To enable AI-assisted rewrite refinement:

```bash
OPENAI_API_KEY=your_key npm run dev
```

Optionally set `OPENAI_MODEL`; otherwise the route defaults to `gpt-5`.

## Deploy to Vercel

1. Push the project to GitHub.
2. Import the repo in Vercel.
3. Use the default Next.js settings.
4. Add `OPENAI_API_KEY` only if you want AI-assisted rewrites in production.
5. Deploy.

## Future Improvements

- Inline substring highlighting in the textarea
- Exportable PDF report
- More nuanced prompt-injection pattern coverage
- Shareable demo URLs using encoded local state
- A small prompt-quality benchmark fixture set
