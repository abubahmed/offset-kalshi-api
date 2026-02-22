function findMatchingBrace(
  str: string,
  start: number,
  open: string,
  close: string
): number {
  let depth = 0;
  for (let i = start; i < str.length; i++) {
    if (str[i] === open) depth++;
    else if (str[i] === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

export function extractJson<T = unknown>(message: string): T {
  try {
    if (!message || typeof message !== "string") return {} as T;

    const clean = message
      .replace(/^\s*```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();

    const firstObj = clean.indexOf("{");
    const firstArr = clean.indexOf("[");

    const useObject =
      firstArr === -1 || (firstObj !== -1 && firstObj < firstArr);

    if (useObject && firstObj !== -1) {
      const end = findMatchingBrace(clean, firstObj, "{", "}");
      if (end !== -1) return JSON.parse(clean.slice(firstObj, end + 1)) as T;
    }

    if (!useObject && firstArr !== -1) {
      const end = findMatchingBrace(clean, firstArr, "[", "]");
      if (end !== -1) return JSON.parse(clean.slice(firstArr, end + 1)) as T;
    }

    for (let i = 0; i < clean.length; i++) {
      if (clean[i] === "{") {
        const end = findMatchingBrace(clean, i, "{", "}");
        if (end !== -1) {
          try {
            return JSON.parse(clean.slice(i, end + 1)) as T;
          } catch {
            continue;
          }
        }
      }
      if (clean[i] === "[") {
        const end = findMatchingBrace(clean, i, "[", "]");
        if (end !== -1) {
          try {
            return JSON.parse(clean.slice(i, end + 1)) as T;
          } catch {
            continue;
          }
        }
      }
    }
  } catch {
    console.error("Error extracting JSON from message:", message);
  }
  return {} as T;
}