import { v } from '@lowerdeck/validation';
import type {
  AiGatewayConsumer,
  aiGatewayCatalogService,
  AiGatewayModelOffering,
  aiGatewayRoutingService,
  AiGatewayToken
} from '@metorial/module-ai-gateway';

type Pricing = NonNullable<AiGatewayModelOffering['pricing']>;
type TokenRates = NonNullable<Pricing['text']>;
type ModelRequest = Awaited<
  ReturnType<typeof aiGatewayCatalogService.resolveModel>
>['request'];
type RouteCandidate = Awaited<
  ReturnType<typeof aiGatewayRoutingService.preview>
>['candidates'][number];

export type AiGatewayLimit = AiGatewayToken['limits'][number];

let modalities = ['text', 'image', 'audio', 'video'] as const;

let presentTokenRates = (rates: TokenRates) => ({
  input: rates.input,
  output: rates.output,
  cache_read: rates.cacheRead,
  cache_write: rates.cacheWrite.map(rate => ({ ttl: rate.ttl, price: rate.price })),
  reasoning: rates.reasoning
});

let presentNullableTokenRates = (rates: TokenRates | null) =>
  rates ? presentTokenRates(rates) : null;

export let presentAiGatewayPricing = (pricing: Pricing) => ({
  currency: pricing.currency,
  text: presentNullableTokenRates(pricing.text),
  image: presentNullableTokenRates(pricing.image),
  audio: presentNullableTokenRates(pricing.audio),
  video: presentNullableTokenRates(pricing.video),
  context_tiers: pricing.contextTiers.map(tier => ({
    min_input_tokens: tier.minInputTokens,
    input: tier.input,
    output: tier.output,
    cache_read: tier.cacheRead
  })),
  units: pricing.units.map(unit => ({
    modality: unit.modality,
    direction: unit.direction,
    unit: unit.unit,
    price: unit.price
  })),
  web_search_per_1k: pricing.webSearchPer1k,
  conditions: (pricing.conditions ?? []).map(condition => ({
    label: condition.label,
    description: condition.description,
    modality: condition.modality,
    rates: presentTokenRates(condition.rates)
  }))
});

let rate = (description: string) => v.nullable(v.number({ description }));

let tokenRatesFields = {
  input: rate('USD per million input tokens'),
  output: rate('USD per million output tokens'),
  cache_read: rate('USD per million input tokens read from the prompt cache'),
  cache_write: v.array(
    v.object({
      ttl: v.nullable(
        v.string({ description: 'The cache lifetime this rate applies to, e.g. 5m or 1h' })
      ),
      price: v.number({ description: 'USD per million tokens written to the prompt cache' })
    }),
    { description: 'Prompt cache write rates, by cache lifetime' }
  ),
  reasoning: rate('USD per million reasoning tokens. Null when reasoning is billed as output.')
};

let tokenRatesSchema = v.object(tokenRatesFields);

let nullableTokenRates = (modality: string) =>
  v.nullable(
    v.object(tokenRatesFields, {
      description: `Token rates for ${modality}. Null when the modality is not priced per token.`
    })
  );

export let aiGatewayPricingSchema = v.object(
  {
    currency: v.literal('USD', { description: 'The currency of every price' }),
    text: nullableTokenRates('text'),
    image: nullableTokenRates('images'),
    audio: nullableTokenRates('audio'),
    video: nullableTokenRates('video'),
    context_tiers: v.array(
      v.object({
        min_input_tokens: v.number({
          description: 'The tier applies to requests with at least this many input tokens'
        }),
        input: rate('USD per million input tokens in this tier'),
        output: rate('USD per million output tokens in this tier'),
        cache_read: rate('USD per million cached input tokens in this tier')
      }),
      { description: 'Rates that replace the text rates for long prompts' }
    ),
    units: v.array(
      v.object({
        modality: v.enumOf(modalities),
        direction: v.enumOf(['input', 'output']),
        unit: v.string({ description: 'What is counted, e.g. image or second' }),
        price: v.number({ description: 'USD per unit' })
      }),
      { description: 'Prices charged per unit instead of per token' }
    ),
    web_search_per_1k: rate('USD per thousand web searches'),
    conditions: v.array(
      v.object({
        label: v.string({ description: 'A short name for the condition' }),
        description: v.string({ description: 'When the condition applies' }),
        modality: v.enumOf(modalities),
        rates: tokenRatesSchema
      }),
      { description: 'Rates that apply only under the described conditions' }
    )
  },
  { description: 'Prices in USD. Token rates are per million tokens.' }
);

export let presentAiGatewayLimit = (limit: AiGatewayLimit) => ({
  metric: limit.metric,
  amount: limit.amount,
  interval: limit.interval
});

export let aiGatewayLimitSchema = v.object({
  metric: v.enumOf(['requests', 'tokens', 'spend_usd'], {
    description: 'What the limit counts. spend_usd counts what Metorial bills for requests.'
  }),
  amount: v.number({ description: 'The most that can be used per interval' }),
  interval: v.enumOf(['1m', '1h', '1d', '1mo'], {
    description: 'The window the amount applies to'
  })
});

export let aiGatewayLimitsSchema = v.array(aiGatewayLimitSchema, {
  description:
    'Limits that reject requests once reached. Every limit is enforced independently.'
});

export let presentAiGatewayModelRequest = (request: ModelRequest) =>
  request.kind == 'pinned'
    ? {
        type: 'pinned' as const,
        provider: request.providerSlug,
        vendor_model_id: request.vendorModelId
      }
    : { type: request.kind, name: request.name };

export let aiGatewayModelRequestSchema = v.union(
  [
    v.object({
      type: v.literal('pinned', {
        description:
          'The model was requested as provider:vendor_model_id, which only routes to your connections for that provider'
      }),
      provider: v.string({ description: 'The slug of the pinned provider' }),
      vendor_model_id: v.string({ description: "The provider's id for the model" })
    }),
    v.object({
      type: v.enumOf(['metorial', 'unified'], {
        description:
          'unified: a plain model name, which routes to your connections first and then to the Metorial provider. metorial: the name was prefixed with metorial:, which only routes to the Metorial provider.'
      }),
      name: v.string({ description: 'The model name without any prefix' })
    })
  ],
  { description: 'How the requested model string was parsed' }
);

export let aiGatewayModelViaSchema = v.enumOf(['slug', 'alias', 'key', 'offering'], {
  description:
    "How the name was matched to a catalog model. slug: it is the model's slug. alias: it is a name a provider, SDK or Metorial uses for the model, e.g. a dated snapshot id. key: it matches such a name once case, separators and date formats are normalized. offering: it pinned a provider and is one of that provider's ids for the model."
});

export let presentAiGatewayRouteCandidate = (candidate: RouteCandidate) => {
  let pricing = candidate.pricing ? presentAiGatewayPricing(candidate.pricing) : null;

  if (candidate.connectionOwner == 'platform') {
    return { connection_owner: 'platform' as const, provider: candidate.provider, pricing };
  }

  return {
    connection_owner: 'customer' as const,
    provider: candidate.provider,
    connection_id: candidate.connectionId,
    vendor_model_id: candidate.vendorModelId,
    pricing,
    pricing_source: candidate.pricingSource
  };
};

export let aiGatewayRouteCandidateSchema = <Fields extends Record<string, any>>(
  fields: Fields
) =>
  v.union(
    [
      v.object({
        ...fields,
        connection_owner: v.literal('platform', {
          description:
            'The request is served by the Metorial provider and billed by Metorial at the listed pricing'
        }),
        provider: v.string({ description: 'Always metorial' }),
        pricing: v.nullable(aiGatewayPricingSchema)
      }),
      v.object({
        ...fields,
        connection_owner: v.literal('customer', {
          description:
            'The request is sent with one of your provider connections and billed by that provider. The listed pricing is used to calculate the cost of requests.'
        }),
        provider: v.string({ description: 'The slug of the provider, e.g. openai' }),
        connection_id: v.string({
          description: 'The ID of the provider connection the request is sent with'
        }),
        vendor_model_id: v.string({
          description: "The provider's id for the model that is requested"
        }),
        pricing: v.nullable(aiGatewayPricingSchema),
        pricing_source: v.enumOf(['offering', 'connection'], {
          description:
            "Where the pricing comes from. offering: the catalog price of the provider's offering. connection: the pricing override set on your provider connection."
        })
      })
    ],
    { description: 'A provider the gateway would try' }
  );

export let presentAiGatewayConsumer = (consumer: AiGatewayConsumer | null) =>
  consumer
    ? {
        object: 'consumer#preview' as const,
        id: consumer.id,
        name: consumer.name,
        email: consumer.email
      }
    : null;

export let aiGatewayConsumerSchema = (description: string) =>
  v.nullable(
    v.object(
      {
        object: v.literal('consumer#preview', {
          description: "String representing the object's type"
        }),
        id: v.string({ description: "The consumer's unique identifier" }),
        name: v.string({ description: "The consumer's name" }),
        email: v.string({ description: "The consumer's email address" })
      },
      { description }
    )
  );
