import type {
  PromptDocument,
  PromptFormat,
  PromptRole,
  PromptVariable,
  SourceLocation,
} from "../../types/analysis";

interface RawRole {
  role: string;
  content: string;
  startOffset: number;
}

export function locationFromOffset(text: string, start: number, end: number): SourceLocation {
  let line = 1;
  let column = 1;

  for (let index = 0; index < start && index < text.length; index += 1) {
    if (text[index] === "\n") {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }

  const startLine = line;
  const startColumn = column;
  let endLine = startLine;
  let endColumn = startColumn;

  for (let index = start; index < end && index < text.length; index += 1) {
    if (text[index] === "\n") {
      endLine += 1;
      endColumn = 1;
    } else {
      endColumn += 1;
    }
  }

  return {
    startOffset: start,
    endOffset: end,
    startLine,
    startColumn,
    endLine,
    endColumn,
  };
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function lineCount(text: string): number {
  if (!text) return 0;
  return text.split("\n").length;
}

function extractVariables(text: string): PromptVariable[] {
  const patterns: Array<{ regex: RegExp; syntax: string }> = [
    { regex: /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, syntax: "{{}}" },
    { regex: /\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, syntax: "${}" },
    { regex: /%\(([a-zA-Z_][a-zA-Z0-9_]*)\)s/g, syntax: "%(...)s" },
    { regex: /(?<!\{|\$)\{([a-zA-Z_][a-zA-Z0-9_]*)\}(?!\})/g, syntax: "{}" },
  ];
  const variables = new Map<string, PromptVariable>();
  const occupiedRanges: Array<[number, number]> = [];

  for (const { regex, syntax } of patterns) {
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text))) {
      const start = match.index;
      const end = start + match[0].length;
      const overlapsExisting = occupiedRanges.some(
        ([occupiedStart, occupiedEnd]) => start >= occupiedStart && end <= occupiedEnd,
      );

      if (overlapsExisting) continue;

      occupiedRanges.push([start, end]);

      const name = match[1];
      const key = `${syntax}:${name}`;
      const variable = variables.get(key) ?? {
        name,
        syntax,
        occurrences: [],
      };

      variable.occurrences.push(locationFromOffset(text, start, end));
      variables.set(key, variable);
    }
  }

  return Array.from(variables.values());
}

function rolesFromBracketMarkers(source: string): RawRole[] {
  const markerRegex = /^\[(system|developer|user|assistant)\]\s*$/gim;
  const markers: Array<{ role: string; start: number; end: number }> = [];
  let match: RegExpExecArray | null;

  while ((match = markerRegex.exec(source))) {
    markers.push({
      role: match[1].toLowerCase(),
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return markers.map((marker, index) => {
    const next = markers[index + 1]?.start ?? source.length;
    const contentStart = source.indexOf("\n", marker.start);
    const rawStart = contentStart === -1 ? marker.end : contentStart + 1;
    const content = source.slice(rawStart, next).trim();
    const leadingWhitespace = source.slice(rawStart, next).search(/\S/);

    return {
      role: marker.role,
      content,
      startOffset: rawStart + Math.max(0, leadingWhitespace),
    };
  });
}

function rolesFromXml(source: string): RawRole[] {
  const roles: RawRole[] = [];
  const xmlRegex = /<(system|developer|user|assistant)>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;

  while ((match = xmlRegex.exec(source))) {
    const content = match[2].trim();
    const innerStart = match.index + match[0].indexOf(match[2]);
    const leadingWhitespace = match[2].search(/\S/);

    roles.push({
      role: match[1].toLowerCase(),
      content,
      startOffset: innerStart + Math.max(0, leadingWhitespace),
    });
  }

  return roles;
}

function rolesFromHeadings(source: string): RawRole[] {
  const headingRegex = /^#{1,3}\s*(system|developer|user|assistant)(?:\s+prompt)?\s*$/gim;
  const headings: Array<{ role: string; start: number }> = [];
  let match: RegExpExecArray | null;

  while ((match = headingRegex.exec(source))) {
    headings.push({ role: match[1].toLowerCase(), start: match.index });
  }

  return headings.map((heading, index) => {
    const next = headings[index + 1]?.start ?? source.length;
    const contentStart = source.indexOf("\n", heading.start);
    const rawStart = contentStart === -1 ? heading.start : contentStart + 1;
    const content = source.slice(rawStart, next).trim();
    const leadingWhitespace = source.slice(rawStart, next).search(/\S/);

    return {
      role: heading.role,
      content,
      startOffset: rawStart + Math.max(0, leadingWhitespace),
    };
  });
}

function rolesFromLabels(source: string): RawRole[] {
  const labelRegex = /^(system|developer|user|assistant)\s*:\s*/gim;
  const labels: Array<{ role: string; start: number; end: number }> = [];
  let match: RegExpExecArray | null;

  while ((match = labelRegex.exec(source))) {
    labels.push({
      role: match[1].toLowerCase(),
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return labels.map((label, index) => {
    const next = labels[index + 1]?.start ?? source.length;
    const content = source.slice(label.end, next).trim();
    const leadingWhitespace = source.slice(label.end, next).search(/\S/);

    return {
      role: label.role,
      content,
      startOffset: label.end + Math.max(0, leadingWhitespace),
    };
  });
}

function detectRoles(source: string, formatHint?: PromptFormat): RawRole[] {
  if (formatHint === "message-array") {
    const bracketRoles = rolesFromBracketMarkers(source);
    if (bracketRoles.length) return bracketRoles;
  }

  const xmlRoles = rolesFromXml(source);
  if (xmlRoles.length) return xmlRoles;

  const bracketRoles = rolesFromBracketMarkers(source);
  if (bracketRoles.length) return bracketRoles;

  const headingRoles = rolesFromHeadings(source);
  if (headingRoles.length) return headingRoles;

  const labelRoles = rolesFromLabels(source);
  if (labelRoles.length) return labelRoles;

  return [{ role: "prompt", content: source, startOffset: 0 }];
}

export function parsePrompt(source: string, formatHint: PromptFormat = "plain-text"): PromptDocument {
  const roles: PromptRole[] = detectRoles(source, formatHint).map((role) => ({
    role: role.role,
    content: role.content,
    location: locationFromOffset(source, role.startOffset, role.startOffset + role.content.length),
  }));

  return {
    source,
    format: formatHint,
    roles,
    variables: extractVariables(source),
    estimatedTokens: estimateTokens(source),
    characterCount: source.length,
    lineCount: lineCount(source),
  };
}
