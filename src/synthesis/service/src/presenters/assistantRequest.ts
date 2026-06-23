import type { AssistantRequestWithRelations } from '../services/request';

export let assistantRequestPresenter = (request: AssistantRequestWithRelations) => ({
  object: 'synthesis#request',
  id: request.id,
  status: request.status,
  conversationId: request.conversation.id,
  assistantInstanceId: request.assistantInstance.id,
  assistantId: request.assistant.id,
  modelId: request.model?.id ?? null,
  messageId: request.message.id,
  actorId: request.tenantActor?.id ?? null,
  organizationActorId: request.tenantActor?.organizationActorId ?? null,
  latestRunId: request.runs[0]?.id ?? null,
  createdAt: request.createdAt,
  updatedAt: request.updatedAt
});
