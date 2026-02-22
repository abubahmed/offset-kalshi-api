import { callLLMWithSearch } from "./clients";
import { extractJson } from "./helpers";
import { SCORE_BATCH_SIZE, TOP_K_MARKETS } from "./constants";

async function scoreBatch(
  registry: any,
  security: any,
  rows: any[]
): Promise<any[]> {
  const system =
    "You are a financial analyst. Return only valid JSON. No prose, no explanation, no markdown.";

  const prompt = `
Task: Score how well each Kalshi prediction market could hedge the price of ${security.ticker}. Use web search, your knowledge of the sector and ${security.ticker}, and the factor registry below.

Security to hedge:
${JSON.stringify(security, null, 2)}

Factor registry (drivers for this security):
${JSON.stringify(registry, null, 2)}

Kalshi prediction markets to score:
${JSON.stringify(rows, null, 2)}

Scoring rules:
- Score each market from 0 to 1.
- Higher score = better hedge relationship.
- Lower score = worse hedge relationship.
- Use the exact "event_ticker" values from the list above so we can match responses.

For something to have a good hedge relationship, it should be highly correlated with the security's price. Either a yes or no position on that market should be highly correlated with the security's price.

If the market is not highly correlated with the security's price, it should have a score closer to 0.
If the market is highly correlated with the security's price, it should have a score closer to 1.

Return this JSON only:
{
  "scores": [
    { "event_ticker": "<exact event_ticker>", "score": <0-1>, "reasoning": "<one sentence explaining the score, giving an example of how the market hedges the security>" }
  ]
}
`;

  const raw = await callLLMWithSearch(prompt, system);
  const parsed = extractJson(raw) as { scores: any[] };
  return parsed?.scores ?? [];
}

/**
 * Takes output from fetchKalshiMarkets, registry, and security.
 * Scores each market on likelihood it can hedge the security's price.
 * Processes 15 markets per LLM call, then combines results.
 */
export async function scoreKalshiLinksForHedging(
  registry: any,
  security: any,
  kalshiMarkets: any[]
): Promise<any[]> {
  const rows = kalshiMarkets.map((m: any) => ({
    event_ticker: m.event_ticker ?? m.series_ticker ?? m.ticker ?? "",
    event_title: m.event_title ?? m.series_title ?? m.title ?? "",
  }));

  const allScores: any[] = [];
  for (let i = 0; i < rows.length; i += SCORE_BATCH_SIZE) {
    const batch = rows.slice(i, i + SCORE_BATCH_SIZE);
    console.log(`Scoring batch ${Math.floor(i / SCORE_BATCH_SIZE) + 1} (${batch.length} markets)...`);
    const batchScores = await scoreBatch(registry, security, batch);
    allScores.push(...batchScores);
  }

  const scoredMarkets = kalshiMarkets.map((m: any) => {
    const ticker = m.event_ticker ?? m.series_ticker ?? m.ticker ?? "";
    return {
      ...m,
      score: allScores.find((s: any) => s.event_ticker === ticker)?.score ?? 0,
    };
  });
  console.log(`Total scored: ${scoredMarkets.length}`);
  scoredMarkets.sort((a: any, b: any) => (b.score ?? 0) - (a.score ?? 0));
  return scoredMarkets.slice(0, TOP_K_MARKETS);
}

async function main() {
  const { generateKalshiSearchTerms } = await import("./generateTerms");
  const { discoverFactors } = await import("./factorDiscovery");
  const { fetchKalshiMarkets } = await import("./fetchKalshiMarkets");
  const { normalizedPosition } = await import("./plaid");

  const registry = await discoverFactors(normalizedPosition, 1);
  const registryWithTerms = await generateKalshiSearchTerms(registry);
  const markets = await fetchKalshiMarkets(registryWithTerms);

  const scored = await scoreKalshiLinksForHedging(
    registryWithTerms,
    normalizedPosition,
    markets
  );
  console.log("\nScored markets:", JSON.stringify(scored.slice(0, 3), null, 2));
}

if (require.main === module) {
  main().catch(console.error);
}
