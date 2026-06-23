import type { AssistantConversationParticipantWithRelations } from '../services/participant';
import { actorPresenter } from './actor';

export let assistantConversationParticipantPresenter = (
  participant: AssistantConversationParticipantWithRelations
) => ({
  object: 'synthesis#conversationParticipant',
  id: participant.id,
  conversationId: participant.conversation.id,
  actor: actorPresenter(participant.tenantActor),
  createdAt: participant.createdAt
});
