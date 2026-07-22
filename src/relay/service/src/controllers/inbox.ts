import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { inboxPresenter } from '../presenters';
import { inboxService } from '../services';
import { app } from './_app';
import { senderApp } from './sender';

export let inboxController = app.controller({
  create: senderApp
    .handler()
    .input(
      v.object({
        senderId: v.string(),
        email: v.string()
      })
    )
    .do(async ctx => {
      let inbox = await inboxService.createInbox({
        sender: ctx.sender,
        input: {
          email: ctx.input.email
        }
      });

      return inboxPresenter(inbox);
    }),

  get: senderApp
    .handler()
    .input(
      v.object({
        senderId: v.string(),
        inboxId: v.string()
      })
    )
    .do(async ctx => {
      let inbox = await inboxService.getInboxById({
        sender: ctx.sender,
        id: ctx.input.inboxId
      });

      return inboxPresenter(inbox);
    }),

  getMany: senderApp
    .handler()
    .input(
      v.object({
        senderId: v.string(),
        inboxIds: v.array(v.string())
      })
    )
    .do(async ctx => {
      let inboxes = await inboxService.getManyInboxesByIds({
        sender: ctx.sender,
        ids: ctx.input.inboxIds
      });

      return inboxes.map(inboxPresenter);
    }),

  list: senderApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          senderId: v.string()
        })
      )
    )
    .do(async ctx => {
      let paginator = await inboxService.listInboxes({
        sender: ctx.sender
      });
      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, inboxPresenter);
    }),

  delete: senderApp
    .handler()
    .input(
      v.object({
        senderId: v.string(),
        inboxId: v.string()
      })
    )
    .do(async ctx => {
      let inbox = await inboxService.getInboxById({
        sender: ctx.sender,
        id: ctx.input.inboxId
      });

      inbox = await inboxService.deleteInbox({ inbox });

      return inboxPresenter(inbox);
    })
});
