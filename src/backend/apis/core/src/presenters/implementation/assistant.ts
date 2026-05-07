import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { assistantConversationType, assistantMessageType, assistantType } from '../types';

let assistantModelProviderSchema = v.object({
  object: v.literal('assistant.model_provider'),
  id: v.string(),
  slug: v.string(),
  name: v.string(),
  image_url: v.string()
});

let assistantModelSchema = v.object({
  object: v.literal('assistant.model'),
  id: v.string(),
  slug: v.string(),
  name: v.string(),
  context_window: v.number(),
  input_cost_per_million_tokens: v.number(),
  output_cost_per_million_tokens: v.number(),
  provider: assistantModelProviderSchema
});

let assistantImplementationSchema = v.object({
  object: v.literal('assistant.implementation'),
  id: v.string(),
  slug: v.string(),
  name: v.string(),
  created_at: v.date(),
  updated_at: v.date()
});

let presentModel = (model: {
  id: string;
  slug: string;
  name: string;
  contextWindow: number;
  inputCostPerMillionTokens: number;
  outputCostPerMillionTokens: number;
  provider: {
    id: string;
    slug: string;
    name: string;
    imageUrl: string;
  };
}) => ({
  object: 'assistant.model' as const,
  id: model.id,
  slug: model.slug,
  name: model.name,
  context_window: model.contextWindow,
  input_cost_per_million_tokens: model.inputCostPerMillionTokens,
  output_cost_per_million_tokens: model.outputCostPerMillionTokens,
  provider: {
    object: 'assistant.model_provider' as const,
    id: model.provider.id,
    slug: model.provider.slug,
    name: model.provider.name,
    image_url: model.provider.imageUrl
  }
});

export let v1AssistantPresenter = Presenter.create(assistantType)
  .presenter(async ({ assistant }) => ({
    object: 'assistant' as const,
    id: assistant.id,
    slug: assistant.slug,
    name: assistant.name,
    owner_type: assistant.ownerType,
    organization_id: assistant.organization?.id ?? null,
    implementation: {
      object: 'assistant.implementation' as const,
      id: assistant.implementation.id,
      slug: assistant.implementation.slug,
      name: assistant.implementation.name,
      created_at: assistant.implementation.createdAt,
      updated_at: assistant.implementation.updatedAt
    },
    default_model: assistant.defaultModel ? presentModel(assistant.defaultModel) : null,
    available_models: assistant.availableModels.map(presentModel),
    created_at: assistant.createdAt,
    updated_at: assistant.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('assistant'),
      id: v.string(),
      slug: v.string(),
      name: v.string(),
      owner_type: v.enumOf(['metorial', 'organization']),
      organization_id: v.nullable(v.string()),
      implementation: assistantImplementationSchema,
      default_model: v.nullable(assistantModelSchema),
      available_models: v.array(assistantModelSchema),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();

export let v1AssistantConversationPresenter = Presenter.create(assistantConversationType)
  .presenter(async ({ assistantConversation }, opts) => ({
    object: 'assistant.conversation' as const,
    id: assistantConversation.id,
    title: assistantConversation.title,
    assistant_id: assistantConversation.assistant.id,
    instance_id: assistantConversation.instance.id,
    organization_id: assistantConversation.organization.id,
    created_by_actor_id: assistantConversation.createdByActor.id,
    root_message_id: assistantConversation.rootMessage.id,
    assistant: await v1AssistantPresenter
      .present({ assistant: assistantConversation.availableAssistant }, opts)
      .run(),
    created_at: assistantConversation.createdAt,
    updated_at: assistantConversation.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('assistant.conversation'),
      id: v.string(),
      title: v.nullable(v.string()),
      assistant_id: v.string(),
      instance_id: v.string(),
      organization_id: v.string(),
      created_by_actor_id: v.string(),
      root_message_id: v.string(),
      assistant: v1AssistantPresenter.schema,
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();

export let v1AssistantMessagePresenter = Presenter.create(assistantMessageType)
  .presenter(async ({ assistantConversationItem }) => {
    let message = assistantConversationItem.message;

    return {
      object: 'assistant.message' as const,
      id: message.id,
      conversation_item_id: assistantConversationItem.id,
      type: message.type,
      assistant_id: message.assistant?.id ?? null,
      parent_message_id: message.parentMessage?.id ?? null,
      model: message.model ? presentModel(message.model) : null,
      request: {
        object: 'assistant.request' as const,
        id: message.request.id,
        status: message.request.status,
        actor_id: message.request.actor?.id ?? null,
        created_at: message.request.createdAt,
        updated_at: message.request.updatedAt
      },
      state: message.state as Record<string, any>,
      serialized: message.serialized as Record<string, any>,
      created_at: message.createdAt
    };
  })
  .schema(
    v.object({
      object: v.literal('assistant.message'),
      id: v.string(),
      conversation_item_id: v.string(),
      type: v.enumOf(['root', 'user', 'assistant']),
      assistant_id: v.nullable(v.string()),
      parent_message_id: v.nullable(v.string()),
      model: v.nullable(assistantModelSchema),
      request: v.object({
        object: v.literal('assistant.request'),
        id: v.string(),
        status: v.enumOf(['pending', 'completed', 'cancelled', 'failed']),
        actor_id: v.nullable(v.string()),
        created_at: v.date(),
        updated_at: v.date()
      }),
      state: v.record(v.any()),
      serialized: v.record(v.any()),
      created_at: v.date()
    })
  )
  .build();
