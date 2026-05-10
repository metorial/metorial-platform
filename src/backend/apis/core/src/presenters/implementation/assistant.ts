import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { assistantConversationType, assistantMessageType, assistantType } from '../types';
import {
  documentParticipantActorSchema,
  presentDocumentParticipantActor
} from './documentParticipant';

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
  provider: assistantModelProviderSchema
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
  provider: {
    object: 'assistant.model_provider' as const,
    id: model.provider.id,
    slug: model.provider.slug,
    name: model.provider.name,
    image_url: model.provider.imageUrl
  }
});

export let v1AssistantPresenter = Presenter.create(assistantType)
  .presenter(async ({ assistant, organization }) => ({
    object: 'assistant' as const,
    id: assistant.id,
    slug: assistant.slug,
    name: assistant.name,
    owner_type: assistant.ownerType == 'tenant' ? 'organization' : assistant.ownerType,
    organization_id: assistant.ownerType == 'tenant' ? organization.id : null,
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
      default_model: v.nullable(assistantModelSchema),
      available_models: v.array(assistantModelSchema),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();

export let v1AssistantConversationPresenter = Presenter.create(assistantConversationType)
  .presenter(async ({ assistantConversation, organization, instance }, opts) => ({
    object: 'assistant.conversation' as const,
    id: assistantConversation.id,
    title: assistantConversation.title,
    assistant_id: assistantConversation.assistantId,
    instance_id: instance.id,
    organization_id: organization.id,
    created_by_actor: await presentDocumentParticipantActor(
      assistantConversation.createdByActor,
      opts
    ),
    root_message_id: assistantConversation.rootMessageId,
    assistant: await v1AssistantPresenter
      .present({ assistant: assistantConversation.assistant, organization }, opts)
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
      created_by_actor: documentParticipantActorSchema,
      root_message_id: v.string(),
      assistant: v1AssistantPresenter.schema,
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();

export let v1AssistantMessagePresenter = Presenter.create(assistantMessageType)
  .presenter(async ({ assistantConversationItem }, opts) => {
    if (!assistantConversationItem.request) {
      throw new Error(
        `Assistant message ${assistantConversationItem.id} is missing a request`
      );
    }

    return {
      object: 'assistant.message' as const,
      id: assistantConversationItem.id,
      conversation_item_id: assistantConversationItem.conversationItemId,
      type: assistantConversationItem.type,
      assistant_id: assistantConversationItem.assistantId ?? null,
      parent_message_id: assistantConversationItem.parentMessageId ?? null,
      model: assistantConversationItem.model
        ? presentModel(assistantConversationItem.model)
        : null,
      request: {
        object: 'assistant.request' as const,
        id: assistantConversationItem.request.id,
        status: assistantConversationItem.request.status,
        actor_id:
          assistantConversationItem.request.organizationActorId ??
          assistantConversationItem.request.actorId ??
          null,
        actor: assistantConversationItem.request.actor
          ? await presentDocumentParticipantActor(
              assistantConversationItem.request.actor,
              opts
            )
          : null,
        created_at: assistantConversationItem.request.createdAt,
        updated_at: assistantConversationItem.request.updatedAt
      },
      state: assistantConversationItem.state as Record<string, any>,
      created_at: assistantConversationItem.createdAt
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
        actor: v.nullable(documentParticipantActorSchema),
        created_at: v.date(),
        updated_at: v.date()
      }),
      state: v.record(v.any()),
      created_at: v.date()
    })
  )
  .build();
