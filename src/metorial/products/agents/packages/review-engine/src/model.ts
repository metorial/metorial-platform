import { gateway, type LanguageModel, type LanguageModelUsage } from 'ai';

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
};

let reviewModel = (d: { slug: string; gatewayId: string; pricing: ReviewModelPricing }) => ({
  slug: d.slug,
  model: gateway(d.gatewayId),
  pricing: d.pricing
});

export let reviewModels = {
  fast: reviewModel({
    slug: 'claude-haiku-5-5',
    gatewayId: 'anthropic/claude-haiku-5.5',
    pricing: {
      inputPerMillion: 0.1,
      outputPerMillion: 0.5,
      cacheReadPerMillion: 0.01,
      cacheWritePerMillion: 0.125
    }
  }),

  balanced: reviewModel({
    slug: 'claude-sonnet-5-5',
    gatewayId: 'anthropic/claude-sonnet-5.5',
    pricing: {
      inputPerMillion: 2,
      outputPerMillion: 10,
      cacheReadPerMillion: 0.2,
      cacheWritePerMillion: 2.5
    }
  })
} satisfies Record<string, ReviewModel>;

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
