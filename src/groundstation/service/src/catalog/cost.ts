import type { Pricing } from '@metorial/model-catalog/src/types';
import type { Tokens } from '../store/derivedModels';

let tokensPerPrice = 1_000_000;

export type RequestTokens = Tokens & { cacheWrite5m?: number; cacheWrite1h?: number };

let tierFor = (pricing: Pricing, contextTokens: number) => {
  let tiers = pricing.contextTiers ?? [];
  let selected: (typeof tiers)[number] | undefined;

  for (let tier of tiers) {
    if (
      contextTokens >= tier.minInputTokens &&
      (!selected || tier.minInputTokens > selected.minInputTokens)
    ) {
      selected = tier;
    }
  }

  return selected;
};

// Catalog prices are USD per million tokens. A component with tokens but no known rate makes the
// whole request unpriced rather than silently cheaper.
export let computeRequestCost = (d: {
  pricing: Pricing | null;
  tokens: RequestTokens;
  contextTokens: number;
}): number | undefined => {
  let rates = d.pricing?.text;
  if (!d.pricing || !rates) return undefined;

  let tier = tierFor(d.pricing, d.contextTokens);

  let input = tier?.input ?? rates.input;
  let output = tier?.output ?? rates.output;
  let cacheRead = tier?.cacheRead ?? rates.cacheRead ?? input;
  let reasoning = rates.reasoning ?? output;

  let writeRate = (ttl: string | null) =>
    rates.cacheWrite.find(rate => rate.ttl == ttl)?.price ??
    rates.cacheWrite.find(rate => rate.ttl === null)?.price ??
    rates.cacheWrite[0]?.price ??
    input;

  let split5m = d.tokens.cacheWrite5m ?? 0;
  let split1h = d.tokens.cacheWrite1h ?? 0;
  let unsplit = Math.max(0, d.tokens.cacheWrite - split5m - split1h);

  let components: [number, number | null][] = [
    [d.tokens.inputUncached, input],
    [d.tokens.cacheRead, cacheRead],
    [split5m, writeRate('5m')],
    [split1h, writeRate('1h')],
    [unsplit, writeRate(null)],
    [d.tokens.output, output],
    [d.tokens.reasoning, reasoning]
  ];

  let total = 0;

  for (let [count, rate] of components) {
    if (!count) continue;
    if (rate === null) return undefined;

    total += (count * rate) / tokensPerPrice;
  }

  return total;
};
