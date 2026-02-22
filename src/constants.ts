// ─── Factor Discovery ─────────────────────────────────────────────────────────

/** Minimum number of factors to maintain in the registry. */
export const FACTOR_MIN = 3;

/** Maximum number of factors to maintain in the registry. */
export const FACTOR_MAX = 5;

/** Exit refinement loop early when every factor's confidence exceeds this threshold. */
export const CONFIDENCE_EXIT_THRESHOLD = 0.75;

/** Default maximum number of targeted+adversarial refinement iterations. */
export const MAX_REFINEMENT_ITERATIONS = 2;

// ─── Kalshi Search Terms ──────────────────────────────────────────────────────

/** Minimum number of Kalshi search terms to generate per factor. */
export const SEARCH_TERMS_MIN = 2;

/** Maximum number of Kalshi search terms to generate per factor. */
export const SEARCH_TERMS_MAX = 3;

// ─── Kalshi Market Fetch ──────────────────────────────────────────────────────

/** Number of results to return from Kalshi per search term query. */
export const KALSHI_RESULTS_PER_QUERY = 10;

// ─── Scoring ──────────────────────────────────────────────────────────────────

/** Number of markets sent to the LLM in a single scoring batch. */
export const SCORE_BATCH_SIZE = 15;

/** Number of top-scored markets to keep after scoring. */
export const TOP_K_MARKETS = 3;

// ─── Position Sizing ──────────────────────────────────────────────────────────

/** Fraction of the holding's market value to allocate toward hedging. */
export const HEDGE_RATIO = 1 / 3;

