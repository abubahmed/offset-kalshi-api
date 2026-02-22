import { callLLMWithSearch } from "./clients";
import { extractJson } from "./helpers";
import { normalizedPosition } from "./plaid";
import { discoverFactors } from "./factorDiscovery";
import { generateKalshiSearchTerms } from "./generateTerms";
import { fetchKalshiMarkets } from "./fetchKalshiMarkets";

// ─── Score Kalshi links for hedge likelihood ─────────

export async function scoreKalshiLinksForHedging(
  registry: any,
  security: any,
  kalshiRows: any[]
): Promise<any> {
  const system = "You are a financial analyst. Return only valid JSON. No prose, no explanation, no markdown.";

  const prompt = `
Task: Score how well each Kalshi prediction market could hedge the price of ${security.ticker}. Use web search, your knowledge of the sector and ${security.ticker}, and the factor registry below.

Security to hedge:
${JSON.stringify(security, null, 2)}

Factor registry (drivers for this security):
${JSON.stringify(registry.factors, null, 2)}

Kalshi prediction markets to score:
${JSON.stringify(kalshiRows.map((r) => ({ href: r.href, link: r.title ?? r.link, factor: r.factor })), null, 2)}

Scoring rules:
- Score each link from 0 to 1: likelihood the market can hedge the security's price. If creating a good hedge relationship is difficult or unlikely, give it a low score.
- Higher score = stronger inverse correlation. Example: holdings in AAPL are inversely correlated with a downside position on "Apple releases new product" (for example, the market for "Apple releases new product" will rise if AAPL rises, so a downside position on the market will hedge the downside of AAPL). That is a high-score hedge.
- Lower score = weak or no clear inverse relationship. Hard-to-hedge items get a low score.
- Use the exact "href" values from the list above so we can match responses.

Return this JSON only:
{
  "scores": [
    { "href": "<exact href>", "title": "<market title>", "score": <0-1>, "reasoning": "<one sentence explaining the score, giving an example of how the market hedges the security>" }
  ]
}
`;

  console.log(`Number of markets to score: ${kalshiRows.length}`);

  const raw = await callLLMWithSearch(prompt, system);
  return extractJson(raw);
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

async function main() {
  const registry = await discoverFactors(normalizedPosition, 3);

  // Print out number of factors
  console.log(`\nNumber of factors: ${registry.factors.length}`);

  console.log("\n[Step 3a] Kalshi search query generation...");
  await generateKalshiSearchTerms(registry);

  // Print out number of search terms
  console.log(`\nNumber of search terms: ${registry.factors.flatMap((f: any) => f.kalshi_search_terms ?? []).length}`);

  console.log("\n[Step 3b] Kalshi search (scrape links per term)...");
  const kalshiResults = await fetchKalshiLinksForRegistry(registry);

  console.log("\n[Step 3c] Score links for hedge likelihood...");
  const scoredLinks = await scoreKalshiLinksForHedging(registry, normalizedPosition, kalshiResults);

  // Print out number of scored links
  console.log(`\nNumber of scored links: ${scoredLinks.scores.length}`);

  console.log(JSON.stringify(scoredLinks, null, 2));
}

if (require.main === module) {
  main().catch(console.error);
}
