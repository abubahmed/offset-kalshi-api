import { callLLMWithSearch } from "./clients";
import { extractJson } from "./helpers";
import { FACTOR_MIN, FACTOR_MAX, CONFIDENCE_EXIT_THRESHOLD, MAX_REFINEMENT_ITERATIONS } from "./constants";

// ─── Step 1: Broad Discovery ──────────────────────────────────────────────────

export async function broadDiscovery(holding: any): Promise<any> {
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

Synthesize your findings into a factor registry. Return around ${FACTOR_MIN}-${FACTOR_MAX} factors — the most material drivers only. These drivers should capture most or all of the upside and downside potential of the security.

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

export async function targetedRefinement(ticker: string, registry: any): Promise<any> {
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

Keep the registry to around ${FACTOR_MIN}-${FACTOR_MAX} factors total; merge or drop lower-priority ones to stay in range. These drivers should capture most or all of the upside and downside potential of the security.

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

export async function adversarialChallenge(ticker: string, registry: any): Promise<any> {
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

export function shouldExit(
  registry: any,
  diff: any,
  iteration: number,
  maxIterations: number
): { exit: boolean; reason: string } {
  if (iteration >= maxIterations) {
    return { exit: true, reason: `Hard cap reached (${maxIterations} refinement iterations)` };
  }

  const noChanges =
    diff.new_factors_added === 0 && diff.factors_retired === 0 && diff.factors_modified === 0;
  if (noChanges && iteration >= 1) {
    return { exit: true, reason: "Registry stabilized — no changes in this iteration" };
  }

  const allHighConfidence = registry.factors.every((f: any) => f.confidence > CONFIDENCE_EXIT_THRESHOLD);
  if (allHighConfidence && registry.factors.length > 0) {
    return { exit: true, reason: "All factors have confidence > 0.75" };
  }

  return { exit: false, reason: "" };
}

// ─── Main Orchestrator ────────────────────────────────────────────────────────

export async function discoverFactors(
  holding: any,
  maxRefinementIterations = MAX_REFINEMENT_ITERATIONS
): Promise<any> {
  console.log(`\nStarting factor discovery for ${holding.ticker}...`);

  // Phase 1: Broad — one pass, cast wide
  console.log("\n[Phase 1] BROAD discovery...");
  let registry = await broadDiscovery(holding);
  console.log(
    `  ${registry.factors.length} factors discovered | avg confidence: ${registry.avg_confidence.toFixed(2)}`
  );

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
      new_factors_added:
        afterTargeted.new_factors_added + afterAdversarial.new_factors_added,
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

const main = async () => {
  const holding = {
    ticker: "AAPL",
  };
  const registry = await discoverFactors(holding);
  const factors = registry.factors;
  console.log(JSON.stringify(registry, null, 2));
}

if (require.main === module) {
  main().catch(console.error);
}