import type { AssistantConversationWithAssistant } from '../services/conversation';
import { actorPresenter } from './actor';
import { assistantConversationParticipantPresenter } from './assistantConversationParticipant';
import { assistantInstancePresenter } from './assistantInstance';
import { assistantPresenter } from './assistant';

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
