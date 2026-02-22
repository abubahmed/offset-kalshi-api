import { callLLMWithSearch } from "./clients";
import { extractJson } from "./helpers";
import { HEDGE_RATIO } from "./constants";

async function decideHedgeForEvent(
  security: any,
  event: any,
  subMarkets: any[]
): Promise<{ sub_market_ticker: string; stance: "yes" | "no"; reasoning: string } | null> {
  if (!subMarkets?.length) return null;

  const system =
    "You are a financial analyst choosing a hedge position. Return only valid JSON. No prose, no explanation, no markdown.";

  const prompt = `
Security to hedge:
${JSON.stringify(security, null, 2)}

Event:
- event_ticker: ${event.event_ticker ?? event.series_ticker ?? ""}
- event_title: ${event.event_title ?? event.series_title ?? ""}

Sub-markets (pick exactly ONE and decide yes or no):
${JSON.stringify(
    subMarkets.map((m) => ({
      ticker: m.ticker,
      yes_subtitle: m.yes_subtitle,
      no_subtitle: m.no_subtitle,
      yes_bid: m.yes_bid,
      yes_ask: m.yes_ask,
      last_price: m.last_price,
    })),
    null,
    2
  )}

Task: Choose the single best sub-market to hedge the security, and decide hedge stance.
- stance "yes" = buy YES contracts (bet the outcome happens).
- stance "no" = buy NO contracts (bet the outcome does not happen).

The direction we take should be inverse to whatever will inversely correlate to an increase to the security's price. Take a position that would be damaging to the security's price or stability if it happens. Do not take a position that would benefit the security's price or stability if it happens.

For example, if the prediction market is "Apple releases new product", and the security is AAPL, we should take a "no" stance on the market. Apple not releasing a new product would be damaging to the security's price and stability.

Return this JSON only:
{
  "sub_market_ticker": "<exact ticker from list>",
  "stance": "yes" or "no",
  "reasoning": "<few sentences explaining the reasoning for the stance, and why it would be damaging to the security's price or stability if it happens>"
}
`;

  const raw = await callLLMWithSearch(prompt, system);
  const parsed = extractJson(raw) as { sub_market_ticker?: string; stance?: string; reasoning?: string };
  if (!parsed?.sub_market_ticker || !parsed?.stance) return null;

  const stance = parsed.stance?.toLowerCase() === "yes" ? "yes" : "no";
  const subMarket = subMarkets.find((m) => m.ticker === parsed.sub_market_ticker);
  if (!subMarket) return null;

  return {
    sub_market_ticker: subMarket.ticker,
    stance,
    reasoning: parsed.reasoning ?? "",
  };
}

/**
 * For each scored market, uses an LLM to pick one sub-market and decide hedge stance (yes/no).
 * Returns markets with selected_sub_market and hedge_stance added.
 */
export async function takePositionKalshi(
  security: any,
  scoredMarkets: any[]
): Promise<any[]> {
  const results: any[] = [];
  for (let i = 0; i < scoredMarkets.length; i++) {
    const event = scoredMarkets[i];
    const subMarkets = event.markets ?? [];
    console.log(
      `Deciding hedge for ${event.event_ticker ?? event.series_ticker} (${i + 1}/${scoredMarkets.length})...`
    );

    const decision = await decideHedgeForEvent(security, event, subMarkets);
    if (decision) {
      const selectedSubMarket = subMarkets.find((m: any) => m.ticker === decision.sub_market_ticker);
      results.push({
        ...event,
        selected_sub_market: selectedSubMarket,
        hedge_stance: decision.stance,
        hedge_reasoning: decision.reasoning,
      });
    } else {
      results.push({ ...event, selected_sub_market: null, hedge_stance: null, hedge_reasoning: null });
    }
  }
  return results;
}

export function addHedgeAmounts(
  positions: any[],
  holding: { marketValue: number }
): any[] {
  const securityValue = holding.marketValue ?? 0;
  const totalHedgeBudget = securityValue * HEDGE_RATIO;
  const perPosition = positions.length > 0 ? totalHedgeBudget / positions.length : 0;

  return positions.map((p) => ({
    ...p,
    hedge_amount_usd: Math.round(perPosition * 100) / 100,
  }));
}

async function main() {
  const { generateKalshiSearchTerms } = await import("./generateTerms");
  const { discoverFactors } = await import("./factorDiscovery");
  const { fetchKalshiMarkets } = await import("./fetchKalshiMarkets");
  const { scoreKalshiLinksForHedging } = await import("./scoreKalshiLinksForHedging");
  const { normalizedPosition } = await import("./plaid");

  const registry = await discoverFactors(normalizedPosition, 1);
  const registryWithTerms = await generateKalshiSearchTerms(registry);
  const markets = await fetchKalshiMarkets(registryWithTerms);
  const scored = await scoreKalshiLinksForHedging(
    registryWithTerms,
    normalizedPosition,
    markets
  );
  const positions = await takePositionKalshi(normalizedPosition, scored);
  const withAmounts = addHedgeAmounts(positions, normalizedPosition);
  console.log("\nPositions:", JSON.stringify(withAmounts, null, 2));
}

if (require.main === module) {
  main().catch(console.error);
}
