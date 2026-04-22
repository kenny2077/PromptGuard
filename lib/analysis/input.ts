export interface NormalizedPromptInput {
  ok: true;
  text: string;
}

export interface InvalidPromptInput {
  ok: false;
  error: string;
}

interface MessageLike {
  role?: unknown;
  content?: unknown;
}

export function normalizePromptInput(
  rawInput: string,
  mode: "plain" | "messages",
): NormalizedPromptInput | InvalidPromptInput {
  if (mode === "plain") {
    return { ok: true, text: rawInput };
  }

  try {
    const parsed = JSON.parse(rawInput) as unknown;

    if (!Array.isArray(parsed)) {
      return {
        ok: false,
        error: "Message array mode expects a JSON array of role/content objects.",
      };
    }

    const lines = parsed.map((message: MessageLike, index) => {
      if (
        !message ||
        typeof message !== "object" ||
        typeof message.role !== "string" ||
        typeof message.content !== "string"
      ) {
        throw new Error(`Message ${index + 1} must include string role and content fields.`);
      }

      return `${message.role}: ${message.content}`;
    });

    return { ok: true, text: lines.join("\n\n") };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not parse message array JSON.",
    };
  }
}
