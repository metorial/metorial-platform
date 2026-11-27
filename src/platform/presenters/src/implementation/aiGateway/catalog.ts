import { v } from '@lowerdeck/validation';
import type { AiGatewayModel } from '@metorial/module-ai-gateway';
import { Presenter } from '@metorial/presenter';
import {
  aiGatewayLabType,
  aiGatewayModelOfferingType,
  aiGatewayModelResolutionType,
  aiGatewayModelType,
  aiGatewayProviderType
} from '../../types';
import {
  aiGatewayModelRequestSchema,
  aiGatewayModelViaSchema,
  aiGatewayPricingSchema,
  presentAiGatewayModelRequest,
  presentAiGatewayPricing
} from './_shared';

type Capabilities = AiGatewayModel['capabilities'];

type Modalities = AiGatewayModel['modalities'];

let catalogEntryStatuses = ['active', 'retired'] as const;

let modelStatuses = ['preview', 'active', 'deprecated', 'retired'] as const;

let presentCapabilities = (capabilities: Capabilities) => ({
  tools: capabilities.tools,
  tool_choice: capabilities.toolChoice,
  structured_output: capabilities.structuredOutput,
  reasoning: capabilities.reasoning
    ? { toggle: capabilities.reasoning.toggle, effort: capabilities.reasoning.effort }
    : null,
  temperature: capabilities.temperature,
  prompt_caching: capabilities.promptCaching
    ? {
        implicit: capabilities.promptCaching.implicit,
        explicit: capabilities.promptCaching.explicit,
        ttls: capabilities.promptCaching.ttls
      }
    : null,
  attachments: capabilities.attachments
});

let capabilitiesSchema = v.object(
  {
    tools: v.boolean({ description: 'Whether the model can call tools' }),
    tool_choice: v.nullable(
      v.array(v.string(), {
        description:
          'The tool_choice values the model accepts, e.g. auto, required or none. Null when unknown.'
      })
    ),
    structured_output: v.boolean({
      description: 'Whether the model can be constrained to a JSON schema'
    }),
    reasoning: v.nullable(
      v.object(
        {
          toggle: v.boolean({ description: 'Whether reasoning can be turned on and off' }),
          effort: v.nullable(
            v.array(v.string(), {
              description:
                'The reasoning effort levels the model accepts, e.g. low, medium or high. Null when the effort cannot be set.'
            })
          )
        },
        { description: 'How the model reasons. Null when it does not reason.' }
      )
    ),
    temperature: v.boolean({ description: 'Whether the temperature can be set' }),
    prompt_caching: v.nullable(
      v.object(
        {
          implicit: v.boolean({
            description: 'Whether repeated prompt prefixes are cached automatically'
          }),
          explicit: v.boolean({
            description: 'Whether parts of the prompt can be marked for caching'
          }),
          ttls: v.array(v.string(), {
            description: 'The cache lifetimes that can be requested, e.g. 5m or 1h'
          })
        },
        { description: 'How prompts are cached. Null when the model has no prompt cache.' }
      )
    ),
    attachments: v.boolean({ description: 'Whether files can be attached to messages' })
  },
  { description: 'What the model supports' }
);

let presentModalities = (modalities: Modalities) => ({
  input: modalities.input,
  output: modalities.output
});

let modalitiesSchema = v.object(
  {
    input: v.array(v.string(), {
      description: 'What the model accepts: text, image, audio, video, pdf or file'
    }),
    output: v.array(v.string(), {
      description: 'What the model produces: text, image, audio or video'
    })
  },
  { description: 'The kinds of content the model works with' }
);

let contextWindowSchema = v.nullable(
  v.number({
    description:
      'The most tokens a request and its response can use together. Null when unknown.'
  })
);

let maxOutputTokensSchema = v.nullable(
  v.number({ description: 'The most tokens a single response can have. Null when unknown.' })
);

let presentModel = (model: AiGatewayModel) => ({
  object: 'ai_gateway.model' as const,

  id: model.id,
  slug: model.slug,
  name: model.name,
  description: model.description,
  kind: model.kind,
  status: model.status,

  lab: { id: model.lab.id, slug: model.lab.slug, name: model.lab.name },
  family_slug: model.familySlug,
  release_date: model.releaseDate,
  open_weights: model.openWeights,

  context_window: model.contextTokens,
  max_output_tokens: model.outputTokens,
  modalities: presentModalities(model.modalities),
  capabilities: presentCapabilities(model.capabilities)
});

let modelSchema = v.object({
  object: v.literal('ai_gateway.model', {
    description: "String representing the object's type"
  }),

  id: v.string({ description: "The model's unique identifier" }),
  slug: v.string({
    description:
      "The model's slug, made of the lab slug and the model name, e.g. anthropic/claude-sonnet-4. Use it as the model of AI gateway requests."
  }),
  name: v.string({ description: "The model's display name" }),
  description: v.nullable(v.string({ description: "The model's description" })),
  kind: v.string({
    description:
      'What the model does: chat, embedding, reranking, image, video, speech, transcription, realtime, audio, decision or other'
  }),
  status: v.enumOf(modelStatuses, {
    description:
      'Where the model is in its lifecycle. Deprecated models still work but will be retired by the lab.'
  }),

  lab: v.object(
    {
      id: v.string({ description: "The lab's unique identifier" }),
      slug: v.string({ description: "The lab's slug, e.g. anthropic" }),
      name: v.string({ description: "The lab's display name" })
    },
    { description: 'The lab that makes the model' }
  ),
  family_slug: v.nullable(
    v.string({
      description: 'The model family the model belongs to, e.g. claude-sonnet. Null if none.'
    })
  ),
  release_date: v.nullable(v.date({ description: 'When the model was released' })),
  open_weights: v.boolean({ description: "Whether the model's weights are published" }),

  context_window: contextWindowSchema,
  max_output_tokens: maxOutputTokensSchema,
  modalities: modalitiesSchema,
  capabilities: capabilitiesSchema
});

export let v1AiGatewayLabPresenter = Presenter.create(aiGatewayLabType)
  .presenter(async ({ lab }) => ({
    object: 'ai_gateway.lab' as const,

    id: lab.id,
    slug: lab.slug,
    name: lab.name,
    description: lab.description,
    website: lab.website,
    logo: lab.logo,
    status: lab.status
  }))
  .schema(
    v.object({
      object: v.literal('ai_gateway.lab', {
        description: "String representing the object's type"
      }),

      id: v.string({ description: "The lab's unique identifier" }),
      slug: v.string({ description: "The lab's slug, e.g. anthropic or openai" }),
      name: v.string({ description: "The lab's display name" }),
      description: v.nullable(v.string({ description: "The lab's description" })),
      website: v.nullable(v.string({ description: "The lab's website" })),
      logo: v.nullable(v.string({ description: "The URL of the lab's logo" })),
      status: v.enumOf(catalogEntryStatuses, {
        description: 'retired labs no longer release or serve models'
      })
    })
  )
  .build();

export let v1AiGatewayProviderPresenter = Presenter.create(aiGatewayProviderType)
  .presenter(async ({ provider }) => ({
    object: 'ai_gateway.provider' as const,

    id: provider.id,
    slug: provider.slug,
    name: provider.name,
    kind: provider.kind,
    website: provider.website,
    docs: provider.docs,
    logo: provider.logo,
    status: provider.status,

    supported: provider.supported,
    features: {
      zdr: provider.features.includes('zdr')
    }
  }))
  .schema(
    v.object({
      object: v.literal('ai_gateway.provider', {
        description: "String representing the object's type"
      }),

      id: v.string({ description: "The provider's unique identifier" }),
      slug: v.string({ description: "The provider's slug, e.g. openai or bedrock" }),
      name: v.string({ description: "The provider's display name" }),
      kind: v.enumOf(
        [
          'metorial',
          'first_party',
          'cloud',
          'inference',
          'aggregator',
          'subscription',
          'decision'
        ],
        {
          description:
            "What kind of provider it is. metorial: Metorial's own provider, billed by Metorial. first_party: a lab's own API. cloud: a cloud platform such as Bedrock or Vertex AI. inference: an inference host. aggregator: a service that resells other providers. subscription: a subscription plan. decision: a classifier used by virtual model rules."
        }
      ),
      website: v.nullable(v.string({ description: "The provider's website" })),
      docs: v.nullable(v.string({ description: "The URL of the provider's documentation" })),
      logo: v.nullable(v.string({ description: "The URL of the provider's logo" })),
      status: v.enumOf(catalogEntryStatuses, {
        description: 'retired providers no longer serve models'
      }),

      supported: v.boolean({
        description:
          'Whether the gateway can send requests to the provider, i.e. whether you can create a provider connection for it'
      }),
      features: v.object(
        {
          zdr: v.boolean({
            description: 'Whether connections to the provider can enable zero data retention'
          })
        },
        { description: 'Features a provider connection for the provider can enable' }
      )
    })
  )
  .build();

export let v1AiGatewayModelPresenter = Presenter.create(aiGatewayModelType)
  .presenter(async ({ model }) => presentModel(model))
  .schema(modelSchema)
  .build();

export let v1AiGatewayModelOfferingPresenter = Presenter.create(aiGatewayModelOfferingType)
  .presenter(async ({ offering }) => ({
    object: 'ai_gateway.model.offering' as const,

    id: offering.id,
    pinned_model: offering.name,
    vendor_model_id: offering.vendorModelId,
    display_name: offering.displayName,
    status: offering.status,

    provider: { id: offering.provider.id, slug: offering.provider.slug },
    model: offering.model ? { id: offering.model.id, slug: offering.model.slug } : null,

    apis: offering.apis,
    pricing: offering.pricing ? presentAiGatewayPricing(offering.pricing) : null,

    context_window: offering.contextTokens,
    max_output_tokens: offering.outputTokens,
    modalities: presentModalities(offering.modalities),
    capabilities: presentCapabilities(offering.capabilities),
    variant: {
      serving: offering.variant.serving,
      reasoning: offering.variant.reasoning,
      quantization: offering.variant.quantization,
      free: offering.variant.free,
      region: offering.variant.region
    }
  }))
  .schema(
    v.object({
      object: v.literal('ai_gateway.model.offering', {
        description: "String representing the object's type"
      }),

      id: v.string({ description: "The offering's unique identifier" }),
      pinned_model: v.string({
        description:
          'The model name that pins requests to this provider and vendor model id, e.g. openai:gpt-4o. Pinned requests only route to your connections for the provider, so this works for supported providers only.'
      }),
      vendor_model_id: v.string({
        description: "The provider's id for the model, e.g. gpt-4o-2024-08-06"
      }),
      display_name: v.string({ description: 'The name the provider lists the model under' }),
      status: v.enumOf(modelStatuses, {
        description: 'Where the offering is in its lifecycle at this provider'
      }),

      provider: v.object(
        {
          id: v.string({ description: "The provider's unique identifier" }),
          slug: v.string({ description: "The provider's slug, e.g. openai" })
        },
        { description: 'The provider that serves the model' }
      ),
      model: v.nullable(
        v.object(
          {
            id: v.string({ description: "The model's unique identifier" }),
            slug: v.string({ description: "The model's slug, e.g. openai/gpt-4o" })
          },
          {
            description:
              'The catalog model the offering serves. Null when it has not been matched to one.'
          }
        )
      ),

      apis: v.array(v.string(), {
        description:
          'The APIs the provider serves the model through, e.g. chat-completions or responses'
      }),
      pricing: v.nullable(aiGatewayPricingSchema),

      context_window: contextWindowSchema,
      max_output_tokens: maxOutputTokensSchema,
      modalities: modalitiesSchema,
      capabilities: capabilitiesSchema,
      variant: v.object(
        {
          serving: v.nullable(
            v.string({
              description:
                'A special serving mode, e.g. batch, priority or highspeed. Null for standard serving.'
            })
          ),
          reasoning: v.nullable(
            v.enumOf(['on', 'off'], {
              description:
                'Whether this variant always or never reasons. Null when reasoning is not fixed.'
            })
          ),
          quantization: v.nullable(
            v.string({
              description:
                'The quantization the model is served at, e.g. fp8. Null if unknown.'
            })
          ),
          free: v.boolean({
            description: 'Whether the provider serves this variant for free'
          }),
          region: v.nullable(
            v.string({ description: 'The region the variant is served from. Null if global.' })
          )
        },
        {
          description: 'How this offering differs from the standard serving of the model'
        }
      )
    })
  )
  .build();

export let v1AiGatewayModelResolutionPresenter = Presenter.create(aiGatewayModelResolutionType)
  .presenter(async ({ resolution }) => ({
    object: 'ai_gateway.model.resolution' as const,

    requested: resolution.requested,
    request: presentAiGatewayModelRequest(resolution.request),
    via: resolution.via,
    model: presentModel(resolution.model)
  }))
  .schema(
    v.object({
      object: v.literal('ai_gateway.model.resolution', {
        description: "String representing the object's type"
      }),

      requested: v.string({ description: 'The model string that was resolved' }),
      request: aiGatewayModelRequestSchema,
      via: aiGatewayModelViaSchema,
      model: modelSchema
    })
  )
  .build();
