import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { assistantMessageType } from '../../types';
import {
  documentParticipantActorSchema,
  presentDocumentParticipantActor
} from '../files/documentParticipant';
import { assistantModelSchema, presentAssistantModel } from './assistant';

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
        ? presentAssistantModel(assistantConversationItem.model)
        : null,
      request: {
        object: 'assistant.request' as const,
        id: assistantConversationItem.request.id,
        status: assistantConversationItem.request.status,
        actor: assistantConversationItem.request.actor
          ? await presentDocumentParticipantActor(
              assistantConversationItem.request.actor,
              opts
            )
          : null,
        created_at: assistantConversationItem.request.createdAt,
        updated_at: assistantConversationItem.request.updatedAt
      },
      items: assistantConversationItem.state.items,
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
        actor: v.nullable(documentParticipantActorSchema),
        created_at: v.date(),
        updated_at: v.date()
      }),
      items: v.array(v.record(v.any())),
      created_at: v.date()
    })
  )
  .build();
