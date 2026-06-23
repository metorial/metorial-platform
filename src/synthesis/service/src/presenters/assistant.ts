import type {
  AssistantWithRelations,
  AvailableAssistant
} from '../services/assistant';
import { assistantModelPresenter } from './assistantModel';
import { implementationPresenter } from './implementation';
import { modelPresenter } from './model';

export let assistantPresenter = (assistant: AvailableAssistant | AssistantWithRelations) => ({
  object: 'synthesis#assistant',
  id: assistant.id,
  ownerType: assistant.ownerType,
  tenantId: assistant.tenant?.id ?? null,
  implementation: implementationPresenter(assistant.implementation),
  name: assistant.name,
  slug: assistant.slug,
  systemIdentifier: assistant.systemIdentifier,
  defaultModel:
    'defaultModel' in assistant ? assistantModelPresenter(assistant.defaultModel) : null,
  availableModels:
    'availableModels' in assistant ? assistant.availableModels.map(modelPresenter) : [],
  createdAt: assistant.createdAt,
  updatedAt: assistant.updatedAt
});
