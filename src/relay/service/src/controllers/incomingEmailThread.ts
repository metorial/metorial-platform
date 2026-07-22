import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { incomingEmailThreadPresenter } from '../presenters';
import { incomingEmailThreadService } from '../services';
import { app } from './_app';
import { senderApp } from './sender';

export let incomingEmailThreadController = app.controller({
  get: senderApp
    .handler()
    .input(
      v.object({
        senderId: v.string(),
        incomingEmailThreadId: v.string()
      })
    )
    .do(async ctx => {
      let thread = await incomingEmailThreadService.getIncomingEmailThreadById({
        sender: ctx.sender,
        id: ctx.input.incomingEmailThreadId
      });

      return incomingEmailThreadPresenter(thread);
    }),

  getMany: senderApp
    .handler()
    .input(
      v.object({
        senderId: v.string(),
        incomingEmailThreadIds: v.array(v.string())
      })
    )
    .do(async ctx => {
      let threads = await incomingEmailThreadService.getManyIncomingEmailThreadsByIds({
        sender: ctx.sender,
        ids: ctx.input.incomingEmailThreadIds
      });

      return threads.map(incomingEmailThreadPresenter);
    }),

  list: senderApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          senderId: v.string(),
          inboxIds: v.optional(v.array(v.string())),
          ids: v.optional(v.array(v.string()))
        })
      )
    )
    .do(async ctx => {
      let paginator = await incomingEmailThreadService.listIncomingEmailThreads({
        sender: ctx.sender,
        inboxIds: ctx.input.inboxIds,
        ids: ctx.input.ids
      });
      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, incomingEmailThreadPresenter);
    })
});
