import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import { assistantMessagePresenter } from '../presenters';
import { assistantMessageService } from '../services';
import { app } from './_app';
import { conversationActorOptionalApp } from './conversation';

export let messageController = app.controller({
  list: conversationActorOptionalApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),
          conversationId: v.string(),
          actorId: v.optional(v.string())
        })
      )
    )
    .do(async ctx => {
      let paginator = await assistantMessageService.listAssistantMessages({
        tenant: ctx.tenant,
        environment: ctx.environment,
        actor: ctx.actor,
        conversation: ctx.conversation
      });
      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, assistantMessagePresenter);
    }),

  get: conversationActorOptionalApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        conversationId: v.string(),
        messageId: v.string(),
        actorId: v.optional(v.string())
      })
    )
    .do(async ctx =>
      assistantMessagePresenter(
        await assistantMessageService.getAssistantMessageById({
          tenant: ctx.tenant,
          environment: ctx.environment,
          actor: ctx.actor,
          conversation: ctx.conversation,
          messageId: ctx.input.messageId
        })
      )
    )
});
