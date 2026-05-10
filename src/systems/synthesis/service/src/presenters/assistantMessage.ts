import type { AssistantConversationItemWithMessage } from '../services/message';
import { modelPresenter } from './model';

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
