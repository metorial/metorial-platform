import { v } from '@lowerdeck/validation';

let rate = v.nullable(v.number());

let tokenRates = v.nullable(
  v.object({
    input: rate,
    output: rate,
    cacheRead: rate,
    cacheWrite: v.array(v.object({ ttl: v.nullable(v.string()), price: v.number() })),
    reasoning: rate
  })
);

export let pricingInput = v.object({
  currency: v.literal('USD'),
  text: tokenRates,
  image: tokenRates,
  audio: tokenRates,
  video: tokenRates,
  contextTiers: v.array(
    v.object({
      minInputTokens: v.number(),
      input: rate,
      output: rate,
      cacheRead: rate
    })
  ),
  units: v.array(
    v.object({
      modality: v.enumOf(['text', 'image', 'audio', 'video']),
      direction: v.enumOf(['input', 'output']),
      unit: v.string(),
      price: v.number()
    })
  ),
  webSearchPer1k: rate
});
