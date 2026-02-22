import { callLLMWithSearch } from "./clients";
import { extractJson } from "./helpers";

const BATCH_SIZE = 15;

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
- Score each market from 0 to 1: likelihood the market can hedge the security's price. If creating a good hedge relationship is difficult or unlikely, give it a low score. If a market is likely to be highly correlated with the price of the security, give it a high score. If a market is likely to be uncorrelated with the price of the security, give it a score closer to 0.5. For example, a good hedge against holdings in AAPL is a predictive market that attempts to predict if Apple's earnings next quarter will be higher or lower than expected.
- Higher score = stronger inverse correlation. Example: holdings in AAPL are inversely correlated with a downside position on "Apple releases new product" (for example, the market for "Apple releases new product" will rise if AAPL rises, so a downside position on the market will hedge the downside of AAPL). That is a high-score hedge.
- Lower score = weak or no clear inverse relationship. Hard-to-hedge items get a low score.
- Use the exact "event_ticker" values from the list above so we can match responses.

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
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    console.log(`Scoring batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} markets)...`);
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
  return scoredMarkets.slice(0, 3);
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
