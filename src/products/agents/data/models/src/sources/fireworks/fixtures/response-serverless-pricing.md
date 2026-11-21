> ## Documentation Index
> Fetch the complete documentation index at: https://docs.fireworks.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Serverless pricing

> Per-token serverless pricing for text, vision, and embedding models on Fireworks, including Standard, Priority, Fast, Ultra-fast (Preview), and Flex serverless mode rates.

## Overview

Serverless inference is priced per token. For how Standard, Priority, Fast, Ultra-fast (Preview), and Flex modes work and how to select one, see [Serverless Modes](https://docs.fireworks.ai/serverless/serverless-modes.md).

Every text or vision request is billed across three dimensions:

* **Input tokens** — what you send to the model.
* **Cached input tokens** — input tokens served from [prompt cache](https://docs.fireworks.ai/guides/prompt-caching.md), priced lower.
* **Output tokens** — what the model generates.

Embeddings are billed only on input tokens.

## How pricing works

* Prices below are **per 1 million tokens** in US dollars.

## Text and vision models

Per-model pricing for headline models. Fast, Ultra-fast (Preview), and Flex variants appear as adjacent rows. In each **Standard** or **Priority** cell, prices are **input / cached input / output** (USD per 1M tokens), in that order.

| Model | Standard | Priority |
| - | - | - |
| [Ember-1](https://app.fireworks.ai/models/fireworks/ember-1) | \$3.00 / \$0.30 / \$15.00 | \$3.75 / \$0.375 / \$18.75 |
| [Muse Spark Open](https://app.fireworks.ai/models/fireworks/muse-spark-open) | \$1.25 / \$0.15 / \$4.25 | \$1.875 / \$0.225 / \$6.375 |
| [Kimi K3.1 Pro](https://app.fireworks.ai/models/fireworks/kimi-k3p1-pro) | \$2.00 / \$0.20 / \$10.00 | \$3.00 / \$0.30 / \$15.00 |
| [Kimi K3](https://app.fireworks.ai/models/fireworks/kimi-k3) | \$3.00 / \$0.30 / \$15.00 | \$3.75 / \$0.375 / \$18.75 |
| [Kimi K3 Fast](https://app.fireworks.ai/models/fireworks/kimi-k3) | \$4.50 / \$0.45 / \$22.50 | — |
| [Kimi K3 (US)](https://app.fireworks.ai/models/fireworks/kimi-k3) | \$4.50 / \$0.45 / \$22.50 | \$5.625 / \$0.5625 / \$28.125 |
| [DeepSeek V4.1 Flash](https://app.fireworks.ai/models/fireworks/deepseek-v4p1-flash) | \$0.30 / \$0.006 / \$1.20 | \$0.375 / \$0.0075 / \$1.50 |
| [DeepSeek V4.1 Flash (US)](https://app.fireworks.ai/models/fireworks/deepseek-v4p1-flash) | \$0.45 / \$0.009 / \$1.80 | \$0.5625 / \$0.01125 / \$2.25 |
| [DeepSeek V4.1 Flash 1017](https://app.fireworks.ai/models/fireworks/deepseek-v4p1-flash-1017) | \$0.30 / \$0.006 / \$1.20 | \$0.375 / \$0.0075 / \$1.50 |
| [DeepSeek V4.1 Flash 1017 Flex](https://app.fireworks.ai/models/fireworks/deepseek-v4p1-flash-1017) | \$0.15 / \$0.003 / \$0.60 | — |
| [DeepSeek V4.1 Flash 1017 Ultra-fast (Preview)](https://app.fireworks.ai/models/fireworks/deepseek-v4p1-flash-1017) | \$2.40 / \$0.048 / \$9.60 | — |
| [DeepSeek V4.1 Flash 1017 (US)](https://app.fireworks.ai/models/fireworks/deepseek-v4p1-flash-1017) | \$0.45 / \$0.009 / \$1.80 | \$0.5625 / \$0.01125 / \$2.25 |
| [GLM 5.3 Flash](https://app.fireworks.ai/models/fireworks/glm-5p3-flash) | \$0.15 / \$0.03 / \$0.50 | \$0.1875 / \$0.0375 / \$0.625 |
| [GLM 5.3 Flash (US)](https://app.fireworks.ai/models/fireworks/glm-5p3-flash) | \$0.225 / \$0.045 / \$0.75 | \$0.28125 / \$0.05625 / \$0.9375 |
| [Ultramarine 1 Flash (US)](https://app.fireworks.ai/models/fireworks/ultramarine-1-flash-us) | \$0.15 / \$0.03 / \$0.50 | \$0.1875 / \$0.0375 / \$0.625 |
| [GLM 5.3](https://app.fireworks.ai/models/fireworks/glm-5p3) | \$1.40 / \$0.26 / \$4.40 | \$1.75 / \$0.325 / \$5.50 |
| [GLM 5.3 (US)](https://app.fireworks.ai/models/fireworks/glm-5p3) | \$2.10 / \$0.39 / \$6.60 | \$2.625 / \$0.4875 / \$8.25 |
| [GLM 5.3 Fast](https://app.fireworks.ai/models/fireworks/glm-5p3) | \$2.10 / \$0.39 / \$6.60 | — |
| [Qwen 3.8 Max](https://app.fireworks.ai/models/fireworks/qwen3p8-max) | \$2.00 / \$0.25 / \$6.00 | \$3.00 / \$0.375 / \$9.00 |
| [MiniMax M3](https://app.fireworks.ai/models/fireworks/minimax-m3) | \$0.30 / \$0.06 / \$1.20 | \$0.45 / \$0.09 / \$1.80 |
| [OpenAI GPT OSS 120B](https://app.fireworks.ai/models/fireworks/gpt-oss-120b) | \$0.15 / \$0.015 / \$0.60 | \$0.18 / \$0.018 / \$0.72 |
| [NVIDIA Nemotron 3.5 Lightning 30B A3B](https://app.fireworks.ai/models/fireworks/nemotron-lightning-3p5-30b-a3b) | \$0.05 / \$0.01 / \$0.20 | \$0.0625 / \$0.0125 / \$0.25 |
| [NVIDIA Nemotron 3 Ultra (Preview)](https://app.fireworks.ai/models/fireworks/nemotron-3-ultra-nvfp4) | \$0.60 / \$0.12 / \$2.40 | \$0.75 / \$0.15 / \$3.00 |

**—** in the Priority column means Priority is not available for that model. This pricing table is the source of truth for Priority availability.

Muse Spark Open runs on US-only capacity. The 50% US-only premium is waived, so the rates in that row are what you pay.

## Decision models

[Rune 26B-A4B](https://app.fireworks.ai/models/fireworks/rune) is a System One decision model. It reads the input once and returns calibrated probabilities for a set of typed questions, and it never generates output tokens. You pay for input only, so the rates below cover the full cost of a request.

| Model | Standard | Priority |
| - | - | - |
| [Rune 26B-A4B](https://app.fireworks.ai/models/fireworks/rune) | \$0.042 / \$0.0084 / \$0.00 | — |

Cached input is 20% of the input rate. Call it with `model: "accounts/fireworks/models/rune"`; see the [System One decisions API](https://docs.fireworks.ai/api-reference/post-systemone.md) for the request shape.

Rune runs on US capacity. There is no US-capacity premium, so the rates above are what you pay.

## Other base models — by size and architecture

For any text or vision model not listed individually, pricing is set by parameter count and architecture. These size-based prices apply uniformly to input and output (no separate cached-input rate):

| Model | \$ / 1M tokens |
| - | - |
| Less than 4B parameters | \$0.10 |
| 4B – 16B parameters | \$0.20 |
| More than 16B parameters | \$0.90 |
| MoE up to 56B parameters (e.g. Mixtral 8x7B) | \$0.50 |
| MoE 56.1B – 176B parameters (e.g. DBRX, Mixtral 8x22B) | \$1.20 |

## Embeddings

Embeddings are billed per 1M input tokens.

| Base model parameter count | \$ / 1M input tokens |
| - | - |
| up to 150M | \$0.008 |
| 150M – 350M | \$0.016 |
| Qwen3 8B | \$0.10 |

## Notes

* For account-level controls (spend tiers, monthly spend limits, on-demand GPU quotas), see [Account quotas](https://docs.fireworks.ai/guides/quotas_usage/account-quotas.md).
