## orchestrate

### Input

```typescript
{
  holding: {
    ticker: string;      // e.g. "TSLA", "AAPL"
    marketValue: number; // USD value of the position
  }
}
```

### Output

Array of position objects, each shaped like:

```json
[
  {
    "is_trending": false,
    "is_new": false,
    "is_closing": false,
    "is_price_delta": false,
    "search_score": 84979674370,
    "fee_type": "quadratic",
    "fee_multiplier": 1,
    "_searchTerm": "auto import tariffs",
    "factor": "Impact of New Tariffs and Subsidy Cuts on EV Market",
    "score": 0.9,
    "selected_sub_market": {
      "ticker": "KXTARIFFRATEPRC-26JUL01-34",
      "yes_subtitle": "Between 30% and 39.99%",
      "no_subtitle": "",
      "yes_bid": 14,
      "yes_ask": 16,
      "last_price": 16,
      "yes_bid_dollars": "0.1400",
      "yes_ask_dollars": "0.1600",
      "last_price_dollars": "0.1600",
      "price_delta": 2,
      "close_ts": "2026-07-01T03:59:00Z",
      "expected_expiration_ts": "2026-07-01T14:00:00Z",
      "open_ts": "2026-02-04T15:00:00Z",
      "rulebook_variables": {},
      "result": "",
      "score": 1398,
      "market_id": "",
      "title": "",
      "icon_url_dark_mode": "https://kalshi-fallback-images.s3.amazonaws.com/structured_icons/dark_diamond.webp",
      "icon_url_light_mode": "https://kalshi-fallback-images.s3.amazonaws.com/structured_icons/diamond.webp",
      "background_color_light_mode": "#265CFF",
      "background_color_dark_mode": "#408FFF",
      "previous_price": 14,
      "previous_price_dollars": "0.1400",
      "volume": 12958
    },
    "hedge_stance": "yes",
    "hedge_reasoning": "An increase in US tariff rates on China between 30% and 39.99% would likely negatively impact Apple Inc. due to increased production costs and potential price increases on their products. This would be damaging to the security's price and stability if it happens.",
    "hedge_amount_usd": 308.87
  }
]
```
