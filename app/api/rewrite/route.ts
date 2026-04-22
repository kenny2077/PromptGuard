import OpenAI from "openai";
import { generateDeterministicRewrite } from "../../../lib/rewrite/deterministic";
import type { AnalysisReport } from "../../../types/analysis";

export const runtime = "nodejs";
export const maxDuration = 20;

interface RewriteRequest {
  prompt?: unknown;
  report?: AnalysisReport;
}

export async function POST(request: Request) {
  const body = (await request.json()) as RewriteRequest;
  const prompt = typeof body.prompt === "string" ? body.prompt : "";
  const deterministic = generateDeterministicRewrite(prompt, body.report?.diagnostics ?? []);

  if (!prompt.trim()) {
    return Response.json(
      {
        mode: "deterministic",
        rewrittenPrompt: "",
        changes: [],
        message: "No prompt was provided.",
      },
      { status: 400 },
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return Response.json({
      mode: "deterministic",
      rewrittenPrompt: deterministic.rewrittenPrompt,
      changes: deterministic.changes,
      message: "No API key found. Deterministic rewrite is active.",
    });
  }

  try {
    const client = new OpenAI();
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL ?? "gpt-5",
      input: [
        {
          role: "system",
          content:
            "Rewrite prompts for clarity, safety, privacy, and prompt-injection resistance. Preserve user intent. Do not introduce new tasks. Return only the rewritten prompt.",
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              originalPrompt: prompt,
              deterministicRewrite: deterministic.rewrittenPrompt,
              diagnostics: body.report?.diagnostics ?? [],
            },
            null,
            2,
          ),
        },
      ],
    });

    return Response.json({
      mode: "ai",
      rewrittenPrompt: response.output_text || deterministic.rewrittenPrompt,
      changes: [
        ...deterministic.changes,
        {
          kind: "ai",
          description: "Refined the deterministic rewrite with the OpenAI Responses API.",
        },
      ],
      message: "AI rewrite applied.",
    });
  } catch {
    return Response.json({
      mode: "deterministic",
      rewrittenPrompt: deterministic.rewrittenPrompt,
      changes: deterministic.changes,
      message: "AI rewrite failed. Deterministic rewrite is active.",
    });
  }
}
