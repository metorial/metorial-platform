import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { assistantConversationType } from '../../types';
import {
  documentParticipantActorSchema,
  presentDocumentParticipantActor
} from '../files/documentParticipant';
import { v1AssistantPresenter } from './assistant';

export let v1AssistantConversationPresenter = Presenter.create(assistantConversationType)
  .presenter(async ({ assistantConversation, organization, instance }, opts) => ({
    object: 'assistant.conversation' as const,
    id: assistantConversation.id,
    title: assistantConversation.title,
    assistant_id: assistantConversation.assistant.id,
    instance_id: instance.id,
    organization_id: organization.id,
    created_by_actor: await presentDocumentParticipantActor(
      assistantConversation.createdByResourceActor,
      opts
    ),
    root_message_id: assistantConversation.rootMessage.id,
    assistant: await v1AssistantPresenter
      .present({ assistant: assistantConversation.availableAssistant, organization }, opts)
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
