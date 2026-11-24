import { v, type ValidationTypeValue } from '@lowerdeck/validation';
import type { AiGateway } from '@metorial/module-ai-gateway';

type GatewayPricingOverride = NonNullable<
  Parameters<AiGateway['providerConnection']['create']>[0]['pricingOverride']
>;

type GatewayPricing = NonNullable<GatewayPricingOverride['models']>[string];

type GatewayTokenRates = NonNullable<GatewayPricing['text']>;

let modalities = ['text', 'image', 'audio', 'video'] as const;

let rate = (description: string) =>
  v.optional(v.nullable(v.number({ description, modifiers: [v.minValue(0)] })));

let tokenRatesFields = {
  input: rate('USD per million input tokens'),
  output: rate('USD per million output tokens'),
  cache_read: rate('USD per million input tokens read from the prompt cache'),
  cache_write: v.optional(
    v.array(
      v.object({
        ttl: v.optional(
          v.nullable(
            v.string({
              description: 'The cache lifetime this rate applies to, e.g. 5m or 1h',
              modifiers: [v.maxLength(20)]
            })
          )
        ),
        price: v.number({
          description: 'USD per million tokens written to the prompt cache',
          modifiers: [v.minValue(0)]
        })
      }),
      {
        description: 'Prompt cache write rates, by cache lifetime',
        modifiers: [v.maxLength(10)]
      }
    )
  ),
  reasoning: rate(
    'USD per million reasoning tokens. Omit or pass null to bill reasoning as output.'
  )
};

let tokenRatesValidator = (modality: string) =>
  v.optional(
    v.nullable(
      v.object(tokenRatesFields, {
        description: `Token rates for ${modality}. Omit or pass null when the modality is not priced per token.`
      })
    )
  );

let pricingValidator = v.object(
  {
    currency: v.literal('USD', { description: 'The currency of every price' }),
    text: tokenRatesValidator('text'),
    image: tokenRatesValidator('images'),
    audio: tokenRatesValidator('audio'),
    video: tokenRatesValidator('video'),
    context_tiers: v.optional(
      v.array(
        v.object({
          min_input_tokens: v.number({
            description: 'The tier applies to requests with at least this many input tokens',
            modifiers: [v.integer(), v.minValue(0)]
          }),
          input: rate('USD per million input tokens in this tier'),
          output: rate('USD per million output tokens in this tier'),
          cache_read: rate('USD per million cached input tokens in this tier')
        }),
        {
          description: 'Rates that replace the text rates for long prompts',
          modifiers: [v.maxLength(20)]
        }
      )
    ),
    units: v.optional(
      v.array(
        v.object({
          modality: v.enumOf(modalities, { description: 'The modality the price applies to' }),
          direction: v.enumOf(['input', 'output'], {
            description: 'Whether the price applies to input or output'
          }),
          unit: v.string({
            description: 'What is counted, e.g. image or second',
            modifiers: [v.minLength(1), v.maxLength(50)]
          }),
          price: v.number({ description: 'USD per unit', modifiers: [v.minValue(0)] })
        }),
        {
          description: 'Prices charged per unit instead of per token',
          modifiers: [v.maxLength(20)]
        }
      )
    ),
    web_search_per_1k: rate('USD per thousand web searches')
  },
  { description: 'Prices in USD. Token rates are per million tokens.' }
);

export let pricingOverrideValidator = v.nullable(
  v.object(
    {
      multiplier: v.optional(
        v.number({
          description:
            'Factor applied to the catalog price of every model without its own price in models, e.g. 0.8 for a 20% discount',
          modifiers: [v.minValue(0), v.maxValue(100)]
        })
      ),
      models: v.optional(
        v.record(pricingValidator, {
          description:
            "Prices that replace the catalog price of a model, keyed by model slug. Every model must be offered by the connection's provider."
        })
      )
    },
    {
      description:
        'Prices you pay this provider when they differ from the catalog, e.g. because of a negotiated discount. Used to calculate the cost of requests routed through the connection. Replaces the existing override when updated; pass null to use catalog prices.'
    }
  )
);

type TokenRatesInput = NonNullable<
  ValidationTypeValue<ReturnType<typeof tokenRatesValidator>>
>;

type PricingInput = ValidationTypeValue<typeof pricingValidator>;

type PricingOverrideInput = NonNullable<ValidationTypeValue<typeof pricingOverrideValidator>>;

let toGatewayTokenRates = (
  rates: TokenRatesInput | null | undefined
): GatewayTokenRates | null =>
  rates
    ? {
        input: rates.input ?? null,
        output: rates.output ?? null,
        cacheRead: rates.cache_read ?? null,
        cacheWrite: (rates.cache_write ?? []).map(cacheRate => ({
          ttl: cacheRate.ttl ?? null,
          price: cacheRate.price
        })),
        reasoning: rates.reasoning ?? null
      }
    : null;

let toGatewayPricing = (pricing: PricingInput): GatewayPricing => ({
  currency: pricing.currency,
  text: toGatewayTokenRates(pricing.text),
  image: toGatewayTokenRates(pricing.image),
  audio: toGatewayTokenRates(pricing.audio),
  video: toGatewayTokenRates(pricing.video),
  contextTiers: (pricing.context_tiers ?? []).map(tier => ({
    minInputTokens: tier.min_input_tokens,
    input: tier.input ?? null,
    output: tier.output ?? null,
    cacheRead: tier.cache_read ?? null
  })),
  units: (pricing.units ?? []).map(unit => ({
    modality: unit.modality,
    direction: unit.direction,
    unit: unit.unit,
    price: unit.price
  })),
  webSearchPer1k: pricing.web_search_per_1k ?? null
});

export let toGatewayPricingOverride = (
  override: PricingOverrideInput | null | undefined
): GatewayPricingOverride | null | undefined => {
  if (!override) return override;

  return {
    multiplier: override.multiplier,
    models: override.models
      ? Object.fromEntries(
          Object.entries(override.models).map(([modelSlug, pricing]) => [
            modelSlug,
            toGatewayPricing(pricing)
          ])
        )
      : undefined
  };
};
