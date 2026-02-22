import { normalizedPosition } from "./plaid";
import { discoverFactors } from "./factorDiscovery";
import { generateKalshiSearchTerms } from "./generateTerms";
import { fetchKalshiMarkets } from "./fetchKalshiMarkets";
import { scoreKalshiLinksForHedging } from "./scoreKalshiLinksForHedging";
import { takePositionKalshi, addHedgeAmounts } from "./takePositionKalshi";

/**
 * normalizedPosition properties used in the pipeline:
 * - ticker: factorDiscovery, scoreKalshiLinksForHedging
 * - marketValue: addHedgeAmounts (hedge budget = marketValue * HEDGE_RATIO)
 * (name, assetType, quantity, costBasis, currentPrice are passed to LLMs as context but not read in code)
 */
async function orchestrate({ holding }: { holding: any }) {
  const registry = await discoverFactors(holding, 1);
  const registryWithTerms = await generateKalshiSearchTerms(registry);
  const markets = await fetchKalshiMarkets(registryWithTerms);
  const scored = await scoreKalshiLinksForHedging(registryWithTerms, normalizedPosition, markets);
  const positions = await takePositionKalshi(normalizedPosition, scored);
  const withAmounts = addHedgeAmounts(positions, normalizedPosition);
  console.log("\nPositions:", JSON.stringify(withAmounts, null, 2));
  return withAmounts;
}

if (require.main === module) {
  import fs from "fs";
  const withAmounts = orchestrate({ holding: { ticker: "TSLA", marketValue: 500 } }).catch(console.error);
  fs.writeFileSync("hedge.json", JSON.stringify(withAmounts, null, 2));
}