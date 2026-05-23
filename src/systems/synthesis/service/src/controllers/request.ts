import { notFoundError, ServiceError } from '@mtsrc/error';
import { v } from '@mtsrc/validation';
import { db } from '../db';
import {
  assistantMessagePresenter,
  assistantRequestPresenter,
  environmentPresenter,
  tenantPresenter
} from '../presenters';
import { assistantConversationParticipantService, assistantRequestService } from '../services';
import { app } from './_app';
import { conversationActorApp } from './conversation';
import { tenantActorOptionalApp } from './tenant';

let messagePartSchema = v.union([
  v.object({
    type: v.literal('text'),
    text: v.string()
  }),
  v.object({
    type: v.literal('file'),
    data: v.string(),
    encoding: v.enumOf(['base64', 'utf-8']),
    filename: v.optional(v.string()),
    mediaType: v.string()
  })
]);

export let requestController = app.controller({
  lookup: app
    .handler()
    .input(
      v.object({
        requestId: v.string()
      })
    )
    .do(async ctx => {
      let request = await assistantRequestService.getAssistantRequestById({
        requestId: ctx.input.requestId
      });

      let conversation = await db.assistantConversation.findUnique({
        where: {
          oid: request.conversationOid
        },
        include: {
          tenant: true,
          environment: true
        }
      });
      if (!conversation) {
        throw new ServiceError(
          notFoundError('assistant_conversation', String(request.conversationOid))
        );
      }

      return {
        request: assistantRequestPresenter(request),
        tenant: tenantPresenter(conversation.tenant),
        environment: environmentPresenter(conversation.environment)
      };
    }),

  get: tenantActorOptionalApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        requestId: v.string(),
        actorId: v.optional(v.string())
      })
    )
    .do(async ctx => {
      let request = await assistantRequestService.getAssistantRequestById({
        requestId: ctx.input.requestId
      });

      let conversation = await db.assistantConversation.findUnique({
        where: {
          oid: request.conversationOid
        }
      });
      if (!conversation) {
        throw new ServiceError(
          notFoundError('assistant_conversation', String(request.conversationOid))
        );
      }

      await assistantConversationParticipantService.assertConversationAccess({
        tenant: ctx.tenant,
        environment: ctx.environment,
        conversation,
        actor: ctx.actor
      });

      return assistantRequestPresenter(request);
    }),

  create: conversationActorApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        conversationId: v.string(),
        actorId: v.string(),
        message: v.object({
          parts: v.array(messagePartSchema)
        }),
        parentMessageId: v.optional(v.string()),
        modelId: v.optional(v.string()),
        allowAllActors: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let result = await assistantRequestService.createAssistantRequest({
        tenant: ctx.tenant,
        environment: ctx.environment,
        actor: ctx.actor,
        conversation: ctx.conversation,
        input: {
          message: ctx.input.message,
          parentMessageId: ctx.input.parentMessageId,
          modelId: ctx.input.modelId,
          allowAllActors: ctx.input.allowAllActors
        }
      });

      let request = await assistantRequestService.getAssistantRequestById({
        requestId: result.request.id
      });

      return {
        request: assistantRequestPresenter(request),
        message: assistantMessagePresenter(result.item)
      };
    })
});
