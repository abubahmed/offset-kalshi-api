// appleHolding.ts

// What the user owns
export const holdingData = {
  account_id: "k67E4xKvMlhmleEa4pg9hlwGGNnnEeixPolGm",
  security_id: "AAPL_SECURITY_ID_123",
  quantity: 15,
  cost_basis: 160.0,
  institution_price: 185.32,
  institution_price_as_of: null,
  institution_value: 2779.8,
  iso_currency_code: "USD",
  unofficial_currency_code: null
};

// What the security actually is
export const securityData = {
  security_id: "AAPL_SECURITY_ID_123",
  ticker_symbol: "AAPL",
  name: "Apple Inc.",
  type: "equity",
  close_price: 185.32,
  close_price_as_of: null,
  cusip: "037833100",
  isin: "US0378331005",
  sedol: "2046251",
  iso_currency_code: "USD",
  market_identifier_code: "XNAS",
  is_cash_equivalent: false,
  institution_id: null,
  institution_security_id: null,
  proxy_security_id: null,
  unofficial_currency_code: null,
  option_contract: null
};

// Optional: normalized object your inference pipeline would consume
export const normalizedPosition = {
  ticker: securityData.ticker_symbol,
  name: securityData.name,
  assetType: securityData.type,
  quantity: holdingData.quantity,
  costBasis: holdingData.cost_basis,
  currentPrice: holdingData.institution_price,
  marketValue: holdingData.institution_value
};