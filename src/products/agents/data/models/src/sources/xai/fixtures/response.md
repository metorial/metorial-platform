#### Key Information

# Pricing

All prices are in USD. For per-model details, see the [models page](/developers/models).

*Error loading model pricing*

## Tools Pricing

Requests which make use of SpaceXSI provided [server-side tools](/developers/tools/overview) are priced based on two components: **token usage** and **server-side tool invocations**. Since the agent autonomously decides how many tools to call, costs scale with query complexity.

### Token Costs

All standard token types are billed for the model used in the request:

* **Input tokens**: Your query and conversation history
* **Reasoning tokens**: Agent's internal thinking and planning
* **Completion tokens**: The final response
* **Image tokens**: Visual content analysis (when applicable)
* **Cached prompt tokens**: Prompt tokens that were served from cache rather than recomputed

### Tool Invocation Costs

| Tool | Tool Name | Description | Cost / 1k Calls |
| --- | --- | --- | --- |
| Web Search | `web_search` | Search the internet and browse web pages | $5 |
| X Search | `x_search` | Search X posts, user profiles, and threads | $5 / 1k posts, $10 / 1k profiles |
| Code Execution | `code_execution`, `code_interpreter`† | Run Python code in a sandboxed environment | $5 |
| Image Generation | `image_generation` | Generate and edit images | [Image API rates](/developers/pricing#imagine-api-pricing) |
| File Attachments | `attachment_search` | Search through files attached to messages | $5 |
| Collections Search | `collections_search`, `file_search`† | Query your uploaded document collections (RAG) | $2.50 |
| Image Understanding | `view_image` | Analyze images found during Web Search and X Search\* | Token-based |
| X Video Understanding | `view_x_video` | Analyze videos found during X Search\* | Token-based |
| Remote MCP Tools | Set by MCP server | Connect and use custom MCP tool servers | Token-based |
† All tool names work in the Responses API. In the gRPC API (Python xAI SDK), `code_interpreter` and `file_search` are not supported.
\* Only applies to images and videos found by search tools — not to images passed directly in messages.

X Search is billed per item fetched rather than per call: every post returned by a search or thread fetch, including parent and quoted posts, counts toward the post rate, and every profile returned by a user search counts toward the profile rate.

For the view image and view x video tools, you will not be charged for the tool invocation itself but will be charged for the image tokens used to process the image or video.

Image Search is part of Web Search and is billed at the standard Web Search rate.

For Remote MCP tools, you will not be charged for the tool invocation but will be charged for any tokens used.

For more information on using Tools, please visit [our guide on Tools](/developers/tools/overview).

## Batch API Pricing

The [Batch API](/developers/advanced-api-usage/batch-api) lets you process large volumes of requests asynchronously at a discount to standard pricing. The size of the discount varies by model. Batch requests are queued and processed in the background, with most completing within 24 hours.

| | Real-time API | Batch API |
|---|---|---|
| Token pricing | Standard rates | Discounted rates (varies by model) |
| Response time | Immediate (seconds) | Typically within 24 hours |
| Rate limits | Per-minute limits apply | Requests don't count towards rate limits |

The batch discount applies to all token types — input tokens, output tokens, cached tokens, and reasoning tokens. Batch discounts by model:

**20% off standard rates**

- grok-4.7
- grok-4.6
- grok-4.5
- grok-4.3
- grok-4.20-0309-reasoning
- grok-4.20-0309-non-reasoning
- grok-4.20-multi-agent-0309

Models not listed above have no batch discount.

To see a model's resulting batch prices, toggle **"Show batch API pricing"** on its detail page. Models that accept Batch with no discount show N/A.

> [!NOTE]
>
> The batch discount applies to text and language models only. Image and video generation are supported in the Batch API but are billed at standard rates. See [Batch API documentation](/developers/advanced-api-usage/batch-api) for full details.

## Priority Processing Pricing

[Priority Processing](/developers/advanced-api-usage/priority-processing) gives text requests higher scheduling priority for lower latency. Priority requests are billed at a **2x** premium over standard rates.

| | Standard | Priority |
|---|---|---|
| Token pricing | Standard rates | **2x** standard rates |
| Response time | Standard scheduling priority | Higher scheduling priority |

The 2x multiplier applies to all token types — input, output, cached, and reasoning. [Prompt caching](/developers/advanced-api-usage/prompt-caching) discounts are applied before the multiplier.

You are only billed at the priority rate when the response confirms `"service_tier": "priority"`. If the request is served at the default tier instead, standard rates apply.

> [!NOTE]
>
> Priority Processing is available for Chat Completions and Responses endpoints only. It is not supported for image generation, video generation, or [Batch API](/developers/advanced-api-usage/batch-api) requests. See [Priority Processing documentation](/developers/advanced-api-usage/priority-processing) for full details.

## Grok 4.7 Fast pricing (Cursor and Grok Build only)

Grok 4.7 Fast is the same Grok 4.7 model served on faster infrastructure. It costs 2x the standard token rates, or 1.5x for long-context requests. It's available only in [Cursor](https://cursor.com) and [Grok Build](/build/overview), and is billed through your plan there. It is not available on the public xAI API, and Grok Build's free tier does not include it.

| Prompt tokens | Input | Cached input | Output |
|---|---|---|---|
| Below 200k | $4.00 / 1M | $1.00 / 1M | $12.00 / 1M |
| Above 200k | $6.00 / 1M | $1.50 / 1M | $18.00 / 1M |

Long-context rates apply once a request's prompt exceeds 200k tokens. Cursor bills its own fast variant through your Cursor plan.

## US Regional Endpoint Pricing

Requests sent to the [US regional endpoint](/developers/advanced-api-usage/regions), `https://us.api.x.ai/v1`, run inference in the United States; their token usage is billed at **1.1x** the global token rates, a 10% premium.

| | Global endpoint | US regional endpoint |
|---|---|---|
| Base URL | `https://api.x.ai/v1` | `https://us.api.x.ai/v1` |
| Token pricing | Standard rates | **1.1x** standard rates |
| Models | All models available to your team | Currently `grok-4.7` and `grok-4.6` only |

For `grok-4.7` this is $2.20 / $0.55 / $6.60 per 1M tokens (input / cached input / output) below 200k prompt tokens, and $4.40 / $1.10 / $13.20 above. The 1.1x multiplier applies to input, output, and cached input tokens, including long-context rates. [Prompt caching](/developers/advanced-api-usage/prompt-caching) discounts are applied before the multiplier. See the [Regional Endpoints documentation](/developers/advanced-api-usage/regions) for the scope of the US processing and storage guarantee.

## Files and Collections Pricing

Files and collections stored on the SpaceXSI platform are billed based on the amount of storage used.

| Resource | Rate |
| --- | ---: |
| File storage | $0.025 / GiB / day |
| Collection storage | $0.10 / GiB / day |

### Download Costs

Downloading data from files and collections is charged at a flat rate based on the amount of data transferred:

| Resource | Rate |
| --- | ---: |
| File downloads | $0.20 / GiB downloaded |
| Collection downloads | $0.20 / GiB downloaded |

You can view and manage your [files](https://console.x.ai/team/default/files?utm_source=docs\&utm_medium=referral\&utm_campaign=developers-pricing\&utm_content=files) and [collections](https://console.x.ai/team/default/collections?utm_source=docs\&utm_medium=referral\&utm_campaign=developers-pricing\&utm_content=collections) through the xAI console or the [xAI API](/developers/files/managing-files).

## Usage Guidelines Violation Fee

When your request is deemed to be in violation of our usage guideline by our system, we will still charge for the generation of the request.

For violations that are caught before generation in the Responses API, we will charge a $0.05 usage guideline violation fee per request.

## Billing and Availability

Your model access might vary depending on various factors such as geographical location, account limitations, etc.

For how the **bills are charged**, visit [Manage Billing](/console/billing) for more information.

For the most up-to-date information on **your team's model availability**, visit [Models Page](https://console.x.ai/team/default/models?utm_source=docs\&utm_medium=referral\&utm_campaign=developers-pricing\&utm_content=models) on xAI Console.
