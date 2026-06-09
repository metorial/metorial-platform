import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { db } from '../db';
import { assistantConversationPresenter } from '../presenters';
import { assistantConversationService } from '../services';
import { app } from './_app';
import { tenantActorApp, tenantActorOptionalApp, tenantApp } from './tenant';

export let conversationApp = tenantApp.use(async ctx => {
  let conversationId = ctx.body.conversationId;
  if (!conversationId) throw new Error('Conversation ID is required');

  let conversation = await db.assistantConversation.findFirst({
    where: {
      tenantOid: ctx.tenant.oid,
      environmentOid: ctx.environment.oid,
      id: conversationId
    }
  });
  if (!conversation) {
    throw new ServiceError(notFoundError('assistant_conversation', conversationId));
  }

  return { conversation };
});

export let conversationActorOptionalApp = conversationApp.use(async ctx => {
  let actorId = ctx.body.actorId;
  if (!actorId) return { actor: null };

  let actor = await db.tenantActor.findFirst({
    where: {
      tenantOid: ctx.tenant.oid,
      id: actorId
    }
  });
  if (!actor) {
    throw new ServiceError(notFoundError('tenant_actor', actorId));
  }

  return { actor };
});

export let conversationActorApp = conversationActorOptionalApp.use(async ctx => {
  if (!ctx.actor) {
    throw new ServiceError(
      badRequestError({
        message: 'actorId is required for this endpoint'
      })
    );
  }

  return { actor: ctx.actor };
});

export let conversationController = app.controller({
  list: tenantActorOptionalApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),
          actorId: v.optional(v.string()),
          assistantIds: v.optional(v.array(v.string()))
        })
      )
    )
    .do(async ctx => {
      let paginator = await assistantConversationService.listAssistantConversations({
        tenant: ctx.tenant,
        environment: ctx.environment,
        actor: ctx.actor,
        assistantIds: ctx.input.assistantIds
      });
      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, assistantConversationPresenter);
    }),

  get: tenantActorOptionalApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        conversationId: v.string(),
        actorId: v.optional(v.string())
      })
    )
    .do(async ctx =>
      assistantConversationPresenter(
        await assistantConversationService.getAssistantConversationById({
          tenant: ctx.tenant,
          environment: ctx.environment,
          actor: ctx.actor,
          conversationId: ctx.input.conversationId
        })
      )
    ),

  create: tenantActorApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        actorId: v.string(),
        assistantId: v.string(),
        title: v.optional(v.string()),
        input: v.optional(v.any())
      })
    )
    .do(async ctx =>
      assistantConversationPresenter(
        await assistantConversationService.createAssistantConversation({
          tenant: ctx.tenant,
          environment: ctx.environment,
          actor: ctx.actor,
          input: {
            assistantId: ctx.input.assistantId,
            title: ctx.input.title,
            input: ctx.input.input
          }
        })
      )
    ),

  update: conversationActorApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        conversationId: v.string(),
        actorId: v.string(),
        title: v.optional(v.string())
      })
    )
    .do(async ctx =>
      assistantConversationPresenter(
        await assistantConversationService.updateAssistantConversation({
          tenant: ctx.tenant,
          environment: ctx.environment,
          actor: ctx.actor,
          conversation: ctx.conversation,
          input: {
            title: ctx.input.title
          }
        })
      )
    )
});
