import { normalizedPosition } from "./plaid";
import { discoverFactors } from "./factorDiscovery";
import { generateKalshiSearchTerms } from "./generateTerms";
import { fetchKalshiMarkets } from "./fetchKalshiMarkets";
import { scoreKalshiLinksForHedging } from "./scoreKalshiLinksForHedging";

async function main() {
  const registry = await discoverFactors(normalizedPosition, 3);

  console.log(`\nNumber of factors: ${registry.factors.length}`);

  console.log("\n[Step 3a] Kalshi search query generation...");
  const registryWithTerms = await generateKalshiSearchTerms(registry);

  console.log(
    `\nNumber of search terms: ${registryWithTerms.factors.flatMap((f: any) => f.kalshi_search_terms ?? []).length}`
  );

  console.log("\n[Step 3b] Fetch Kalshi markets...");
  const markets = await fetchKalshiMarkets(registryWithTerms);

  console.log("\n[Step 3c] Score links for hedge likelihood...");
  const scoredLinks = await scoreKalshiLinksForHedging(
    registryWithTerms,
    normalizedPosition,
    markets
  );

  console.log(`\nNumber of scored links: ${scoredLinks.scores.length}`);
  console.log(JSON.stringify(scoredLinks, null, 2));
}

if (require.main === module) {
  main().catch(console.error);
}
