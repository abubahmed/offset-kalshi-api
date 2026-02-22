import { callLLMWithSearch } from "./clients";
import { extractJson } from "./helpers";

export async function generateKalshiSearchTerms(registry: any): Promise<any> {
  const system =
    "You generate Kalshi-specific search terms for prediction markets. Return a JSON array of 2-3 short search phrases only (e.g. [\"term1\", \"term2\"]). No markdown, no explanation.";
  for (const factor of registry.factors) {
    const prompt = `Factor: "${factor.label}"
Description: ${factor.description}

Generate 2-3 Kalshi-specific search terms: short phrases someone would use to find relevant prediction markets or events on Kalshi for this factor. Be concrete (e.g. "chip export ban", "semiconductor restriction", "BIS AI rule", "China trade Q2"). Return only a JSON array of strings. Use web search (optional) to generate search terms most likely to find relevant prediction markets or events on Kalshi for the given factor.`;
    const raw = await callLLMWithSearch(prompt, system);
    const parsed = extractJson<string[]>(raw);
    factor.kalshi_search_terms = Array.isArray(parsed) ? parsed : [String(parsed)];
  }
  return registry;
}

const main = async () => {
  const { discoverFactors } = await import("./factorDiscovery");

  const holding = {
    ticker: "AAPL",
  };
  const registry = await discoverFactors(holding);
  const registryWithTerms = await generateKalshiSearchTerms(registry);
  console.log(JSON.stringify(registryWithTerms, null, 2));
}

if (require.main === module) {
  main().catch(console.error);
}