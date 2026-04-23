export interface DecodedVariant {
  encoding: "base64" | "url" | "html-entity" | "unicode-escape";
  original: string;
  decoded: string;
}

const MAX_DECODED_LENGTH = 4000;

function decodeBase64(value: string): string | null {
  try {
    if (typeof globalThis.atob !== "function") return null;

    const decoded = globalThis.atob(value);
    return /[A-Za-z]/.test(decoded) ? decoded.slice(0, MAX_DECODED_LENGTH) : null;
  } catch {
    return null;
  }
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, decimal: string) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&colon;/gi, ":")
    .replace(/&sol;/gi, "/")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/g, "'");
}

function decodeUnicodeEscape(value: string): string | null {
  try {
    return value.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    );
  } catch {
    return null;
  }
}

function pushUnique(variants: DecodedVariant[], variant: DecodedVariant) {
  if (!variant.decoded.trim() || variant.decoded === variant.original) return;
  if (variants.some((existing) => existing.encoding === variant.encoding && existing.decoded === variant.decoded)) return;
  variants.push(variant);
}

export function decodePromptVariants(input: string): DecodedVariant[] {
  const variants: DecodedVariant[] = [];
  const base64Pattern = /[A-Za-z0-9+/]{16,}={0,2}/g;
  let base64Match: RegExpExecArray | null;

  while ((base64Match = base64Pattern.exec(input))) {
    const decoded = decodeBase64(base64Match[0]);

    if (decoded) {
      pushUnique(variants, {
        encoding: "base64",
        original: base64Match[0],
        decoded,
      });
    }
  }

  const urlPattern = /(?:%[0-9a-fA-F]{2}){3,}/g;
  let urlMatch: RegExpExecArray | null;

  while ((urlMatch = urlPattern.exec(input))) {
    try {
      const decoded = decodeURIComponent(urlMatch[0]);

      pushUnique(variants, {
        encoding: "url",
        original: urlMatch[0],
        decoded: decoded.slice(0, MAX_DECODED_LENGTH),
      });
    } catch {
      // Ignore malformed percent-encoding.
    }
  }

  if (input.includes("&") && input.includes(";")) {
    const decoded = decodeHtmlEntities(input);

    pushUnique(variants, {
      encoding: "html-entity",
      original: input.slice(0, 120),
      decoded: decoded.slice(0, MAX_DECODED_LENGTH),
    });
  }

  const unicodePattern = /(?:\\u[0-9a-fA-F]{4}){3,}/g;
  let unicodeMatch: RegExpExecArray | null;

  while ((unicodeMatch = unicodePattern.exec(input))) {
    const decoded = decodeUnicodeEscape(unicodeMatch[0]);

    if (decoded) {
      pushUnique(variants, {
        encoding: "unicode-escape",
        original: unicodeMatch[0],
        decoded: decoded.slice(0, MAX_DECODED_LENGTH),
      });
    }
  }

  return variants.slice(0, 8);
}
