import { searchKalshiMarkets } from "./clients";

/**
 * Takes registry (from generateKalshiSearchTerms), extracts search terms, removes duplicates,
 * fetches from Kalshi API for each term, then removes duplicate findings.
 */
export async function fetchKalshiMarkets(registry: any): Promise<any[]> {
  const termToFactor: Record<string, string> = {};
  for (const f of registry.factors ?? []) {
    for (const t of f.kalshi_search_terms ?? []) {
      if (termToFactor[t] == null) termToFactor[t] = f.label ?? "";
    }
  }
  const terms = [...new Set(Object.keys(termToFactor))].filter(Boolean);
  console.log(`Search terms (deduped): ${terms.length} — ${terms.join(", ")}`);

  const allResults: any[] = [];
  for (const term of terms) {
    const page = await searchKalshiMarkets(term);
    for (const item of page ?? []) {
      allResults.push({ ...item, _searchTerm: term });
    }
  }

  console.log(`Raw results (before dedup): ${allResults.length}`);

  const seen = new Set<string>();
  const unique = allResults.filter((item) => {
    const id =
      item.event_ticker ??
      item.series_ticker ??
      item.ticker ??
      item.event_title ??
      JSON.stringify(item);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  console.log(`Unique markets (after dedup): ${unique.length}`);
  return unique.map((item) => ({
    ...item,
    factor: termToFactor[item._searchTerm] ?? "",
  }));
}

async function main() {
  const { generateKalshiSearchTerms } = await import("./generateTerms");
  const { discoverFactors } = await import("./factorDiscovery");

  const holding = { ticker: "AAPL", name: "Apple Inc." };
  const registry = await discoverFactors(holding, 1);
  const registryWithTerms = await generateKalshiSearchTerms(registry);

  const markets = await fetchKalshiMarkets(registryWithTerms);
  console.log("\nResults:");
  for (const m of markets) {
    console.log(`  - ${m.event_title ?? m.title ?? m.series_title ?? "?"}`);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
