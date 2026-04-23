export interface NormalizationResult {
  text: string;
  changed: boolean;
  changes: string[];
}

const HOMOGLYPHS: Record<string, string> = {
  а: "a",
  е: "e",
  о: "o",
  р: "p",
  с: "c",
  х: "x",
  і: "i",
  І: "I",
  Α: "A",
  Β: "B",
  Ε: "E",
  Ι: "I",
  Ο: "O",
  Ρ: "P",
  Τ: "T",
  Χ: "X",
  α: "a",
  ο: "o",
  ρ: "p",
  ａ: "a",
  ｅ: "e",
  ｏ: "o",
  ｒ: "r",
  ｉ: "i",
  ｇ: "g",
  ｎ: "n",
};

export function normalizeForScan(input: string): NormalizationResult {
  let text = input;
  const changes: string[] = [];

  const withoutInvisible = text.replace(
    /[\u200b\u200c\u200d\u200e\u200f\u2028\u2029\u2060-\u2064\u00ad\ufeff\u{E0001}-\u{E007F}]/gu,
    "",
  );

  if (withoutInvisible !== text) {
    text = withoutInvisible;
    changes.push("Removed invisible Unicode control characters.");
  }

  let homoglyphChanged = false;
  text = Array.from(text)
    .map((character) => {
      if (HOMOGLYPHS[character]) {
        homoglyphChanged = true;
        return HOMOGLYPHS[character];
      }

      return character;
    })
    .join("");

  if (homoglyphChanged) {
    changes.push("Normalized common homoglyph characters.");
  }

  const withoutInlineComments = text.replace(/\/\*.*?\*\//g, "").replace(/(?<=\S)\/\/(?=\S)/g, "");
  if (withoutInlineComments !== text) {
    text = withoutInlineComments;
    changes.push("Removed inline comment fragments used to split words.");
  }

  const beforeDelimited = text;
  text = text.replace(
    /(?<![A-Za-z])(?:[A-Za-z]\s*[+.\-_|/\\]\s*){3,}[A-Za-z](?![A-Za-z])/g,
    (fragment) => fragment.replace(/[^A-Za-z]/g, ""),
  );

  if (text !== beforeDelimited) {
    changes.push("Collapsed delimiter-split letter sequences.");
  }

  const words = text.split(/\s+/);
  const rebuilt: string[] = [];
  let singleLetterRun: string[] = [];

  for (const word of words) {
    if (/^[A-Za-z]$/.test(word)) {
      singleLetterRun.push(word);
      continue;
    }

    if (singleLetterRun.length >= 4) {
      rebuilt.push(singleLetterRun.join(""));
      changes.push("Collapsed spaced single-letter attack text.");
    } else {
      rebuilt.push(...singleLetterRun);
    }

    singleLetterRun = [];
    rebuilt.push(word);
  }

  if (singleLetterRun.length >= 4) {
    rebuilt.push(singleLetterRun.join(""));
    changes.push("Collapsed spaced single-letter attack text.");
  } else {
    rebuilt.push(...singleLetterRun);
  }

  text = rebuilt.join(" ").replace(/[ \t]{2,}/g, " ").trim();

  return {
    text,
    changed: changes.length > 0,
    changes: [...new Set(changes)],
  };
}
