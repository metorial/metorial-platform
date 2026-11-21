# Pricing

All prices are in USD.

### Text API Pricing

| Model | Context | Input / 1M tokens | Cached input / 1M tokens | Output / 1M tokens |
| --- | --- | --- | --- | --- |
| test-chat (< 200k prompt tokens) | 1M | $1 | $0.1 | $2 |
| test-chat (≥ 200k prompt tokens) | 1M | $2 | $0.2 | $4 |

*Prices shown per million tokens. Models listed with two rows use long context pricing: requests whose prompt reaches the listed token threshold are billed at the higher rate for all tokens in the request.*

## Grok 4.7 Fast pricing (Cursor and Grok Build only)

Grok 4.7 Fast is the same Grok 4.7 model served on faster infrastructure. It costs 2x the standard token rates. It's available only in [Cursor](https://cursor.com) and [Grok Build](/build/overview), and is billed through your plan there. It is not available on the public xAI API.

| Prompt tokens | Input | Cached input | Output |
|---|---|---|---|
| Below 200k | $4.00 / 1M | $1.00 / 1M | $12.00 / 1M |
| Above 200k | $6.00 / 1M | $1.50 / 1M | $18.00 / 1M |

## US Regional Endpoint Pricing

Requests sent to the [US regional endpoint](/developers/advanced-api-usage/regions), `https://us.api.x.ai/v1`, run inference in the United States; their token usage is billed at **1.1x** the global token rates, a 10% premium.

For `grok-4.7` this is $2.20 / $0.55 / $6.60 per 1M tokens (input / cached input / output) below 200k prompt tokens, and $4.40 / $1.10 / $13.20 above.
