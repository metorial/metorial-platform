import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { assistantMessageType } from '../../types';
import {
  documentParticipantActorSchema,
  presentDocumentParticipantActor
} from '../files/documentParticipant';
import { assistantModelSchema, presentAssistantModel } from './assistant';

let presentRequestContext = (input: unknown) => {
  if (!input || typeof input != 'object') return null;

  let { mode, requestedMode, canWrite } = input as {
    mode?: unknown;
    requestedMode?: unknown;
    canWrite?: unknown;
  };
  if (typeof mode != 'string') return null;

  return {
    mode,
    requested_mode: typeof requestedMode == 'string' ? requestedMode : mode,
    can_write: canWrite === true
  };
};

export let v1AssistantMessagePresenter = Presenter.create(assistantMessageType)
  .presenter(async ({ assistantConversationItem }, opts) => {
    let message = assistantConversationItem.message;
    if (!message.request) {
      throw new Error(`Assistant message ${message.id} is missing a request`);
    }

    return {
      object: 'assistant.message' as const,
      id: message.id,
      conversation_item_id: assistantConversationItem.id,
      type: message.type,
      status: message.status,
      assistant_id: message.assistant?.id ?? null,
      parent_message_id: message.parentMessage?.id ?? null,
      model: message.model ? presentAssistantModel(message.model) : null,
      request: {
        object: 'assistant.request' as const,
        id: message.request.id,
        status: message.request.status,
        actor: message.request.resourceActor
          ? await presentDocumentParticipantActor(message.request.resourceActor, opts)
          : null,
        context: presentRequestContext(message.request.input),
        created_at: message.request.createdAt,
        updated_at: message.request.updatedAt
      },
      items: message.state.items as Record<string, any>[],
      created_at: message.createdAt
    };
  })
  .schema(
    v.object({
      object: v.literal('assistant.message'),
      id: v.string(),
      conversation_item_id: v.string(),
      type: v.enumOf(['root', 'user', 'assistant']),
      status: v.enumOf(['pending', 'waiting_for_user', 'completed']),
      assistant_id: v.nullable(v.string()),
      parent_message_id: v.nullable(v.string()),
      model: v.nullable(assistantModelSchema),
      request: v.object({
        object: v.literal('assistant.request'),
        id: v.string(),
        status: v.enumOf(['pending', 'waiting_for_user', 'completed', 'cancelled', 'failed']),
        actor: v.nullable(documentParticipantActorSchema),
        context: v.nullable(
          v.object({
            mode: v.string({
              description: 'The mode the assistant ran in after permission checks'
            }),
            requested_mode: v.string({ description: 'The mode requested by the client' }),
            can_write: v.boolean({
              description: 'Whether the assistant could change the underlying resource'
            })
          })
        ),
        created_at: v.date(),
        updated_at: v.date()
      }),
      items: v.array(v.record(v.any())),
      created_at: v.date()
    })
  )
  .build();
