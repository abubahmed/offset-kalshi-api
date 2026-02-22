import { scoreKalshiLinksForHedging } from "./index";
import { normalizedPosition } from "./plaid";

const testLinks = [
  {
    term: "tim cook apple",
    href: "https://kalshi.com/markets/kxaaplceochange/tim-cook-leaves-apple/kxaaplceochange",
    link: "When will Tim Cook leave Apple?",
    factor: "CEO leadership",
  },
  {
    term: "mac cellular",
    href: "https://kalshi.com/markets/kxmaccell/mac-cell-connectivity/kxmaccell-27",
    link: "Will Apple release a Macbook with cellular connectivity 2026?",
    factor: "Product innovation",
  },
];

const mockRegistry = {
  ticker: "AAPL",
  factors: [
    { id: "f_001", label: "CEO leadership", description: "Apple CEO succession risk", confidence: 0.8 },
    { id: "f_002", label: "Product innovation", description: "New product launches and features", confidence: 0.7 },
  ],
};

async function main() {
  console.log("Testing scoreKalshiLinksForHedging...");
  console.log("Links:", testLinks);
  console.log("Security:", normalizedPosition);
  console.log("Registry factors:", mockRegistry.factors);
  console.log("\nCalling scoreKalshiLinksForHedging...\n");

  const scored = await scoreKalshiLinksForHedging(mockRegistry, normalizedPosition, testLinks);
  console.log("Scored links:", JSON.stringify(scored, null, 2));
}

if (require.main === module) {
  main().catch(console.error);
}
