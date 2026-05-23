import { v } from '@mtsrc/validation';
import { Presenter } from '@metorial/presenter';
import { assistantType } from '../../types';

export let assistantModelProviderSchema = v.object({
  object: v.literal('assistant.model_provider'),
  id: v.string(),
  slug: v.string(),
  name: v.string(),
  image_url: v.string()
});

export let assistantModelSchema = v.object({
  object: v.literal('assistant.model'),
  id: v.string(),
  slug: v.string(),
  name: v.string(),
  context_window: v.number(),
  provider: assistantModelProviderSchema
});

export let presentAssistantModel = (model: {
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
    default_model: assistant.defaultModel
      ? presentAssistantModel(assistant.defaultModel)
      : null,
    available_models: assistant.availableModels.map(presentAssistantModel),
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
