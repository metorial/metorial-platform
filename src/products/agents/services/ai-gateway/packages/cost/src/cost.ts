import type {
  ContextTier,
  GatewayCost,
  GatewayCostComponent,
  GatewayUsage,
  Pricing
} from '@mtsrc/ai-gateway-spec';

let tokensPerPrice = 1_000_000;

let tierFor = (pricing: Pricing, inputTokens: number) => {
  let selected: ContextTier | undefined;

  for (let tier of pricing.contextTiers ?? []) {
    if (
      inputTokens >= tier.minInputTokens &&
      (!selected || tier.minInputTokens > selected.minInputTokens)
    ) {
      selected = tier;
    }
  }

  return selected;
};

let cacheWriteRate = (pricing: Pricing, ttl: string | null, fallback: number | null) => {
  let rates = pricing.text?.cacheWrite ?? [];

  return (
    rates.find(rate => rate.ttl == ttl)?.price ??
    rates.find(rate => rate.ttl === null)?.price ??
    rates[0]?.price ??
    fallback
  );
};

// Catalog prices are USD per million tokens. A component with tokens but no known rate makes the
// whole request unpriced rather than silently cheaper.
export let computeCost = (d: {
  pricing: Pricing | null;
  usage: GatewayUsage;
  cacheWriteTtl?: string | null;
}): GatewayCost => {
  let components: Record<GatewayCostComponent, number> = {
    input: 0,
    cacheRead: 0,
    cacheWrite: 0,
    output: 0,
    reasoning: 0
  };

  let rates = d.pricing?.text;
  if (!d.pricing || !rates) {
    return { currency: 'USD', priced: false, components, totalUsd: 0 };
  }

  let tier = tierFor(d.pricing, d.usage.input.total);

  let input = tier?.input ?? rates.input;
  let output = tier?.output ?? rates.output;
  let cacheRead = tier?.cacheRead ?? rates.cacheRead ?? input;
  let cacheWrite = cacheWriteRate(d.pricing, d.cacheWriteTtl ?? null, input);
  let reasoning = rates.reasoning ?? output;

  let parts: [GatewayCostComponent, number, number | null][] = [
    ['input', d.usage.input.noCache, input],
    ['cacheRead', d.usage.input.cacheRead, cacheRead],
    ['cacheWrite', d.usage.input.cacheWrite, cacheWrite],
    ['output', d.usage.output.text, output],
    ['reasoning', d.usage.output.reasoning, reasoning]
  ];

  let priced = true;

  for (let [component, tokens, rate] of parts) {
    if (!tokens) continue;
    if (rate === null) {
      priced = false;
      continue;
    }

    components[component] = (tokens * rate) / tokensPerPrice;
  }

  let totalUsd = Object.values(components).reduce((sum, value) => sum + value, 0);

  return { currency: 'USD', priced, components, totalUsd };
};
