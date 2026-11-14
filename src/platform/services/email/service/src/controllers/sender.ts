import { v } from '@lowerdeck/validation';
import { senderPresenter } from '../presenters/sender';
import { senderService } from '../services';
import { app } from './_app';

export let senderApp = app.use(async ctx => {
  let senderId = ctx.body.senderId;
  if (!senderId) throw new Error('Sender ID is required');

  let sender = await senderService.getSenderById({ id: senderId });

  return { sender };
});

export let senderController = app.controller({
  upsert: app
    .handler()
    .input(
      v.object({
        name: v.string(),
        identifier: v.string()
      })
    )
    .do(async ctx => {
      let sender = await senderService.upsertSender({
        input: {
          name: ctx.input.name,
          identifier: ctx.input.identifier
        }
      });
      return senderPresenter(sender);
    }),

  get: senderApp
    .handler()
    .input(
      v.object({
        senderId: v.string()
      })
    )
    .do(async ctx => senderPresenter(ctx.sender))
});
