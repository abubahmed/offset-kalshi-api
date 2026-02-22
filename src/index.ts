import { callLLMWithSearch, callLLMMini, runKalshiSearchForTerms } from "./clients";
import { extractJson } from "./extractJson";
import { normalizedPosition } from "./plaid";

// ─── Step 1: Broad Discovery ──────────────────────────────────────────────────

async function broadDiscovery(holding: any): Promise<any> {
  const prompt = `
You are a financial analyst. Search broadly to identify key factors that could materially impact ${holding.ticker} (upside or downside — anything that could move the security).

Holding context:
${JSON.stringify(holding, null, 2)}

Run these searches:
- "${holding.ticker} key drivers 2025"
- "what is moving ${holding.ticker} right now"
- "${holding.ticker} latest news"
- Other searches that are necessary to identify key drivers
- You are also allowed to use prior knowledge of the ticker and/or sector to identify key drivers

Synthesize your findings into a factor registry. Return around 3-5 factors — the most material drivers only. These drivers should capture most or all of the upside and downside potential of the security.

Return this exact JSON:
{
  "ticker": "${holding.ticker}",
  "factors": [
    {
      "id": "f_001",
      "category": "<short string>",
      "label": "<concise factor label>",
      "description": "<1-2 sentences describing this factor and why it matters>",
      "salience": <float 0-1>,
      "evidence_quality": <float 0-1>,
      "confidence": <salience × evidence_quality>
    }
  ],
  "new_factors_added": <int>,
  "factors_retired": 0,
  "factors_modified": 0,
  "avg_confidence": <float>
}
`;

  const raw = await callLLMWithSearch(prompt);
  return extractJson(raw);
}

// ─── Step 2: Targeted Refinement ─────────────────────────────────────────────

async function targetedRefinement(ticker: string, registry: any): Promise<any> {
  const prompt = `
You are a financial analyst refining a factor registry for ${ticker}.

Current factors:
${JSON.stringify(registry.factors, null, 2)}

Search for evidence on ALL of the above factors simultaneously. For each factor run a targeted query or queries:
${registry.factors.map((f: any) => `- "${ticker} ${f.label} 2025"`).join("\n")}

Then update the registry. You have full permission to:
- CONFIRM factors and raise their confidence if evidence is strong
- ENRICH descriptions with specific data points, dates, analyst quotes
- MERGE two factors if they're really the same
- SPLIT a factor if it actually contains two distinct drivers
- RENAME/RELABEL a factor if a better framing emerges
- DELETE a factor if evidence contradicts it or it's not material
- ADD new factors uncovered during targeted research
- OTHER actions that are necessary to refine the registry (note you are mutating the registry all at once, so you have permission to reshape it according to the best of your judgment)

Keep the registry to around 3-5 factors total; merge or drop lower-priority ones to stay in range. These drivers should capture most or all of the upside and downside potential of the security.

Scoring:
- salience: how much could this move the stock (0.0–1.0)
- evidence_quality: how strong and recent is the evidence (0.0–1.0)
- confidence: salience × evidence_quality

Return this exact JSON (preserve ids where possible, generate new f_XXX for new factors):
{
  "ticker": "${ticker}",
  "factors": [
    {
      "id": "<string>",
      "category": "<short string>",
      "label": "<concise factor label>",
      "description": "<enriched 1-3 sentence description with specifics>",
      "salience": <float 0-1>,
      "evidence_quality": <float 0-1>,
      "confidence": <float 0-1>
    }
  ],
  "new_factors_added": <int>,
  "factors_retired": <int>,
  "factors_modified": <int>,
  "avg_confidence": <float>
}
`;

  const raw = await callLLMWithSearch(prompt);
  return extractJson(raw);
}

// ─── Step 3: Adversarial Challenge ───────────────────────────────────────────

async function adversarialChallenge(ticker: string, registry: any): Promise<any> {
  const prompt = `
You are a skeptical financial analyst stress-testing a factor registry for ${ticker}.

Current factors (these are your target — challenge them):
${JSON.stringify(registry.factors, null, 2)}

Search for what the consensus is missing:
- "${ticker} catalysts analysts are ignoring"
- "${ticker} bear case 2025"
- "${ticker} underappreciated drivers"
- OTHER queries that are necessary to challenge the registry
- You are also allowed to use prior knowledge of the ticker and/or sector to challenge the registry

Your job is adversarial: assume the current registry is overconfident and incomplete.
- Are any factors understated? Raise salience.
- Are any factors overstated or already priced in? Lower confidence or delete.
- What material drivers are missing entirely? Add them.
- Are descriptions too vague? Make them sharper and more specific.

You have full permission to mutate the registry in any way:
- Delete factors that don't survive scrutiny
- Add factors the consensus is sleeping on
- Adjust scores to reflect adversarial evidence
- Rewrite descriptions to be more precise

Keep the registry to around 3-5 factors total; merge or drop to stay in range. These drivers should capture most or all of the upside and downside potential of the security.

Note that your goal is to present challenges to the registry to optimize it, not to be adversarial for the sake of being adversarial. Your ultimate goal is to help the user have a more complete and accurate factor registry.

Return this exact JSON:
{
  "ticker": "${ticker}",
  "factors": [
    {
      "id": "<string>",
      "category": "<short string>",
      "label": "<concise factor label>",
      "description": "<sharp 1-3 sentence description>",
      "salience": <float 0-1>,
      "evidence_quality": <float 0-1>,
      "confidence": <float 0-1>
    }
  ],
  "new_factors_added": <int>,
  "factors_retired": <int>,
  "factors_modified": <int>,
  "avg_confidence": <float>
}
`;

  const raw = await callLLMWithSearch(prompt);
  return extractJson(raw);
}

// ─── Exit Condition ───────────────────────────────────────────────────────────

function shouldExit(registry: any, diff: any, iteration: number, maxIterations: number): { exit: boolean; reason: string } {
  if (iteration >= maxIterations) {
    return { exit: true, reason: `Hard cap reached (${maxIterations} refinement iterations)` };
  }

  const noChanges = diff.new_factors_added === 0 && diff.factors_retired === 0 && diff.factors_modified === 0;
  if (noChanges && iteration >= 1) {
    return { exit: true, reason: "Registry stabilized — no changes in this iteration" };
  }

  const allHighConfidence = registry.factors.every((f: any) => f.confidence > 0.75);
  if (allHighConfidence && registry.factors.length > 0) {
    return { exit: true, reason: "All factors have confidence > 0.75" };
  }

  return { exit: false, reason: "" };
}

// ─── Main Orchestrator ────────────────────────────────────────────────────────

async function discoverFactors(holding: any, maxRefinementIterations = 2): Promise<any> {
  console.log(`\nStarting factor discovery for ${holding.ticker}...`);

  // Phase 1: Broad — one pass, cast wide
  console.log("\n[Phase 1] BROAD discovery...");
  let registry = await broadDiscovery(holding);
  console.log(`  ${registry.factors.length} factors discovered | avg confidence: ${registry.avg_confidence.toFixed(2)}`);

  // Phase 2+: Targeted → Adversarial → repeat for k iterations
  for (let i = 1; i <= maxRefinementIterations; i++) {
    console.log(`\n[Refinement Iter ${i}] TARGETED pass...`);
    const afterTargeted = await targetedRefinement(holding.ticker, registry);
    console.log(
      `  +${afterTargeted.new_factors_added} added | -${afterTargeted.factors_retired} retired | ~${afterTargeted.factors_modified} modified | avg confidence: ${afterTargeted.avg_confidence.toFixed(2)}`
    );

    console.log(`[Refinement Iter ${i}] ADVERSARIAL pass...`);
    const afterAdversarial = await adversarialChallenge(holding.ticker, afterTargeted);
    console.log(
      `  +${afterAdversarial.new_factors_added} added | -${afterAdversarial.factors_retired} retired | ~${afterAdversarial.factors_modified} modified | avg confidence: ${afterAdversarial.avg_confidence.toFixed(2)}`
    );

    const diff = {
      new_factors_added: afterTargeted.new_factors_added + afterAdversarial.new_factors_added,
      factors_retired: afterTargeted.factors_retired + afterAdversarial.factors_retired,
      factors_modified: afterTargeted.factors_modified + afterAdversarial.factors_modified,
      avg_confidence: afterAdversarial.avg_confidence,
    };

    registry = afterAdversarial;

    const { exit, reason } = shouldExit(registry, diff, i, maxRefinementIterations);
    if (exit) {
      console.log(`\nExiting refinement: ${reason}`);
      break;
    }
  }

  registry.factors = registry.factors.sort((a: any, b: any) => b.confidence - a.confidence);
  return registry;
}

// ─── Step 3a: Kalshi Search Query Generation ───────────────────────────────────

async function generateKalshiSearchTerms(registry: any): Promise<any> {
  const system =
    "You generate Kalshi-specific search terms for prediction markets. Return a JSON array of 2-3 short search phrases only (e.g. [\"term1\", \"term2\"]). No markdown, no explanation.";
  for (const factor of registry.factors) {
    const prompt = `Factor: "${factor.label}"
Description: ${factor.description}

Generate 2-3 Kalshi-specific search terms: short phrases someone would use to find relevant prediction markets or events on Kalshi for this factor. Be concrete (e.g. "chip export ban", "semiconductor restriction", "BIS AI rule", "China trade Q2"). Return only a JSON array of strings.`;
    const raw = await callLLMMini(prompt, system);
    const parsed = extractJson<string[]>(raw);
    factor.kalshi_search_terms = Array.isArray(parsed) ? parsed : [String(parsed)];
  }
  return registry;
}

// ─── Kalshi: aggregate terms + run search per term ───────────────────────────

async function fetchKalshiLinksForRegistry(registry: any): Promise<any[]> {
  const termToFactor: Record<string, string> = {};
  for (const f of registry.factors) {
    for (const t of f.kalshi_search_terms ?? []) {
      if (termToFactor[t] == null) termToFactor[t] = f.label;
    }
  }
  const terms = [...new Set(Object.keys(termToFactor))];
  const results = await runKalshiSearchForTerms(terms);
  const rows = results.flatMap((r) =>
    r.links.map((l: any) => ({
      term: r.searchTerm,
      href: l.href,
      title: l.text,
      factor: termToFactor[r.searchTerm] ?? "",
    }))
  );

  console.log(`Number of markets (counting duplicates): ${rows.length}`);
  console.log(`Row titles: ${rows.map((r) => r.title).join(",\n ")}`);

  const seenHref = new Set<string>();
  const seenTitle = new Set<string>();
  const uniqueRows = rows.filter((row) => {
    if (seenHref.has(row.href)) return false;
    seenHref.add(row.href);
    if (seenTitle.has(row.title)) return false;
    seenTitle.add(row.title);
    return true;
  });

  console.log(`Number of unique markets: ${uniqueRows.length}`);
  return uniqueRows;
}

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
${JSON.stringify(kalshiRows.map((r) => ({ href: r.href, link: r.link, factor: r.factor })), null, 2)}

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
