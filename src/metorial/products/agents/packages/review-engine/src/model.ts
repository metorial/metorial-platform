import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import {
  createGateway,
  defaultSettingsMiddleware,
  wrapLanguageModel,
  type LanguageModel,
  type LanguageModelUsage
} from 'ai';

export type ReviewModelPricing = {
  inputPerMillion: number;
  outputPerMillion: number;
  cacheReadPerMillion: number;
  cacheWritePerMillion: number;
};

export type ReviewModel = {
  slug: string;
  model: LanguageModel;
  pricing: ReviewModelPricing;
  contextWindow?: number;
  requestsPerMinute?: number;
  fallback?: ReviewModel;
};

export type ReviewModelProvider = 'cloudflare' | 'vercel';

export type ReviewModelProviderConfig = {
  cloudflare?: { accountId: string; apiToken: string };
  vercel?: { apiKey: string };
};

export type ReviewModelSet = {
  provider: ReviewModelProvider;
  fast: ReviewModel;
  balanced: ReviewModel;
};

export let selectReviewModelProvider = (
  config: ReviewModelProviderConfig
): ReviewModelProvider | null =>
  config.cloudflare ? 'cloudflare' : config.vercel ? 'vercel' : null;

let GATED_MODEL_REQUESTS_PER_MINUTE = 18;

// Deliberately conservative: compaction only ever shrinks history early, while overestimating a
// window means a request fails.
let LARGE_CLOUDFLARE_CONTEXT_WINDOW = 256_000;
let GATEWAY_CONTEXT_WINDOW = 200_000;

// Reasoning models spend most of their time thinking, so the effort is pinned per model.
let withReasoningEffort = (
  model: LanguageModel,
  effort: 'low' | 'medium' | 'high'
): LanguageModel =>
  wrapLanguageModel({
    model: model as Parameters<typeof wrapLanguageModel>[0]['model'],
    middleware: defaultSettingsMiddleware({
      settings: { providerOptions: { 'cloudflare-workers-ai': { reasoningEffort: effort } } }
    })
  });

let createCloudflareModels = (
  config: NonNullable<ReviewModelProviderConfig['cloudflare']>
): ReviewModelSet => {
  let workersAi = createOpenAICompatible({
    name: 'cloudflare-workers-ai',
    baseURL: `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/v1`,
    apiKey: config.apiToken,
    includeUsage: true
  });

  let fallback: ReviewModel = {
    slug: 'nemotron-3-120b',
    model: withReasoningEffort(
      workersAi.chatModel('@cf/nvidia/nemotron-3-120b-a12b'),
      'medium'
    ),
    contextWindow: LARGE_CLOUDFLARE_CONTEXT_WINDOW,
    pricing: {
      inputPerMillion: 0.5,
      outputPerMillion: 1.5,
      cacheReadPerMillion: 0.5,
      cacheWritePerMillion: 0
    }
  };

  let deepseek: ReviewModel = {
    slug: 'deepseek-v4-1-flash',
    model: withReasoningEffort(
      workersAi.chatModel('@cf/deepseek-ai/deepseek-v4.1-flash-1017'),
      'medium'
    ),
    pricing: {
      inputPerMillion: 0.3,
      outputPerMillion: 1.2,
      cacheReadPerMillion: 0.006,
      cacheWritePerMillion: 0
    },
    contextWindow: LARGE_CLOUDFLARE_CONTEXT_WINDOW,
    requestsPerMinute: GATED_MODEL_REQUESTS_PER_MINUTE,
    fallback
  };

  // Both tiers share one model, and with it one rate-limit slot, since the limit is per model.
  return { provider: 'cloudflare', fast: deepseek, balanced: deepseek };
};

let createVercelModels = (
  config: NonNullable<ReviewModelProviderConfig['vercel']>
): ReviewModelSet => {
  let gateway = createGateway({ apiKey: config.apiKey });

  return {
    provider: 'vercel',
    fast: {
      slug: 'claude-haiku-5-5',
      model: gateway('anthropic/claude-haiku-5.5'),
      contextWindow: GATEWAY_CONTEXT_WINDOW,
      pricing: {
        inputPerMillion: 0.1,
        outputPerMillion: 0.5,
        cacheReadPerMillion: 0.01,
        cacheWritePerMillion: 0.125
      }
    },
    balanced: {
      slug: 'claude-sonnet-5-5',
      model: gateway('anthropic/claude-sonnet-5.5'),
      contextWindow: GATEWAY_CONTEXT_WINDOW,
      pricing: {
        inputPerMillion: 2,
        outputPerMillion: 10,
        cacheReadPerMillion: 0.2,
        cacheWritePerMillion: 2.5
      }
    }
  };
};

export let createReviewModels = (config: ReviewModelProviderConfig): ReviewModelSet | null => {
  let provider = selectReviewModelProvider(config);

  if (provider == 'cloudflare') return createCloudflareModels(config.cloudflare!);
  if (provider == 'vercel') return createVercelModels(config.vercel!);

  return null;
};

export type ReviewUsage = {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  costMicros: number;
};

export let emptyUsage = (): ReviewUsage => ({
  inputTokens: 0,
  outputTokens: 0,
  cachedInputTokens: 0,
  costMicros: 0
});

export let addUsage = (
  total: ReviewUsage,
  usage: LanguageModelUsage,
  pricing: ReviewModelPricing
): ReviewUsage => {
  let cacheRead = usage.inputTokenDetails?.cacheReadTokens ?? 0;
  let cacheWrite = usage.inputTokenDetails?.cacheWriteTokens ?? 0;
  let input = usage.inputTokens ?? 0;
  let uncached =
    usage.inputTokenDetails?.noCacheTokens ?? Math.max(input - cacheRead - cacheWrite, 0);
  let output = usage.outputTokens ?? 0;

  let costMicros =
    uncached * pricing.inputPerMillion +
    cacheRead * pricing.cacheReadPerMillion +
    cacheWrite * pricing.cacheWritePerMillion +
    output * pricing.outputPerMillion;

  return {
    inputTokens: total.inputTokens + input,
    outputTokens: total.outputTokens + output,
    cachedInputTokens: total.cachedInputTokens + cacheRead,
    costMicros: total.costMicros + Math.ceil(costMicros)
  };
};
