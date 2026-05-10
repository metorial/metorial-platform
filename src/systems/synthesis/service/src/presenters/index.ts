import type {
  AssistantImplementation,
  AssistantInstance,
  Environment,
  Model,
  ModelProvider,
  Tenant,
  TenantActor
} from '../db';
import type {
  AssistantWithRelations,
  AssistantModelWithProvider,
  AvailableAssistant
} from '../services/assistant';
import type { AssistantConversationItemWithMessage } from '../services/message';
import type { AssistantConversationParticipantWithRelations } from '../services/participant';
import type { AssistantConversationWithAssistant } from '../services/conversation';
import type { AssistantRequestWithRelations } from '../services/request';

export let tenantPresenter = (tenant: Tenant) => ({
  object: 'synthesis#tenant',
  id: tenant.id,
  identifier: tenant.identifier,
  name: tenant.name,
  createdAt: tenant.createdAt
});

export let environmentPresenter = (environment: Environment) => ({
  object: 'synthesis#environment',
  id: environment.id,
  type: environment.type,
  identifier: environment.identifier,
  name: environment.name,
  createdAt: environment.createdAt
});

export let actorPresenter = (actor: TenantActor) => ({
  object: 'synthesis#actor',
  id: actor.id,
  type: actor.type,
  identifier: actor.identifier,
  name: actor.name,
  organizationActorId: actor.organizationActorId,
  consumerId: actor.consumerId,
  createdAt: actor.createdAt
});

export let modelProviderPresenter = (provider: ModelProvider) => ({
  object: 'synthesis#modelProvider',
  id: provider.id,
  slug: provider.slug,
  name: provider.name,
  imageUrl: provider.imageUrl,
  createdAt: provider.createdAt,
  updatedAt: provider.updatedAt
});

export let modelPresenter = (model: Model & { provider: ModelProvider }) => ({
  object: 'synthesis#model',
  id: model.id,
  name: model.name,
  slug: model.slug,
  contextWindow: model.contextWindow,
  inputCostPerMillionTokens: model.inputCostPerMillionTokens,
  outputCostPerMillionTokens: model.outputCostPerMillionTokens,
  provider: modelProviderPresenter(model.provider),
  createdAt: model.createdAt,
  updatedAt: model.updatedAt
});

export let implementationPresenter = (implementation: AssistantImplementation) => ({
  object: 'synthesis#assistantImplementation',
  id: implementation.id,
  name: implementation.name,
  slug: implementation.slug,
  createdAt: implementation.createdAt,
  updatedAt: implementation.updatedAt
});

export let assistantInstancePresenter = (instance: AssistantInstance) => ({
  object: 'synthesis#assistantInstance',
  id: instance.id,
  createdAt: instance.createdAt,
  updatedAt: instance.updatedAt
});

export let assistantModelPresenter = (model: AssistantModelWithProvider | null) =>
  model ? modelPresenter(model) : null;

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
    'availableModels' in assistant
      ? assistant.availableModels.map(modelPresenter)
      : [],
  createdAt: assistant.createdAt,
  updatedAt: assistant.updatedAt
});

export let assistantConversationParticipantPresenter = (
  participant: AssistantConversationParticipantWithRelations
) => ({
  object: 'synthesis#conversationParticipant',
  id: participant.id,
  conversationId: participant.conversation.id,
  actor: actorPresenter(participant.tenantActor),
  createdAt: participant.createdAt
});

export let assistantConversationPresenter = (conversation: AssistantConversationWithAssistant) => ({
  object: 'synthesis#conversation',
  id: conversation.id,
  title: conversation.title,
  assistantId: conversation.assistant.id,
  assistantInstanceId: conversation.assistantInstance.id,
  tenantId: conversation.tenant.id,
  environmentId: conversation.environment.id,
  createdByActorId: conversation.createdByTenantActor.id,
  rootMessageId: conversation.rootMessage.id,
  assistant: assistantPresenter(conversation.availableAssistant),
  assistantInstance: assistantInstancePresenter(conversation.assistantInstance),
  createdByActor: actorPresenter(conversation.createdByTenantActor),
  participants: conversation.assistantConversationParticipants.map(
    assistantConversationParticipantPresenter
  ),
  createdAt: conversation.createdAt,
  updatedAt: conversation.updatedAt
});

export let assistantMessagePresenter = (
  item: AssistantConversationItemWithMessage
) => ({
  object: 'synthesis#message',
  id: item.message.id,
  conversationItemId: item.id,
  conversationId: item.conversation.id,
  type: item.message.type,
  runId: item.message.run?.id ?? null,
  requestId: item.message.request?.id ?? null,
  request: item.message.request
    ? {
        object: 'synthesis#request',
        id: item.message.request.id,
        status: item.message.request.status,
        actorId: item.message.request.tenantActor?.id ?? null,
        organizationActorId: item.message.request.tenantActor?.organizationActorId ?? null,
        createdAt: item.message.request.createdAt,
        updatedAt: item.message.request.updatedAt
      }
    : null,
  assistantInstanceId: item.message.assistantInstance?.id ?? null,
  assistantId: item.message.assistant?.id ?? null,
  parentMessageId: item.message.parentMessage?.id ?? null,
  model: item.message.model ? modelPresenter(item.message.model) : null,
  state: item.message.state,
  serialized: item.message.serialized,
  createdAt: item.message.createdAt
});

export let assistantRequestPresenter = (request: AssistantRequestWithRelations) => ({
  object: 'synthesis#request',
  id: request.id,
  status: request.status,
  conversationId: request.conversation.id,
  assistantInstanceId: request.assistantInstance.id,
  assistantId: request.assistant.id,
  modelId: request.model?.id ?? null,
  messageId: request.message.id,
  historySize: request.historySize,
  actorId: request.tenantActor?.id ?? null,
  organizationActorId: request.tenantActor?.organizationActorId ?? null,
  latestRunId: request.runs[0]?.id ?? null,
  createdAt: request.createdAt,
  updatedAt: request.updatedAt
});
