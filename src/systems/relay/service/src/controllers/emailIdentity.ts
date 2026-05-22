import { v } from '@lowerdeck/validation';
import { emailIdentityPresenter } from '../presenters';
import { emailService } from '../services';
import { app } from './_app';
import { senderApp } from './sender';

export let emailIdentityApp = senderApp.use(async ctx => {
  let emailIdentityId = ctx.body.emailIdentityId;
  if (!emailIdentityId) throw new Error('Tenant ID is required');

  let emailIdentity = await emailService.getIdentityById({
    id: emailIdentityId,
    sender: ctx.sender
  });

  return { emailIdentity };
});

export let emailIdentityController = app.controller({
  upsert: senderApp
    .handler()
    .input(
      v.object({
        senderId: v.string(),

        name: v.string(),
        email: v.string()
      })
    )
    .do(async ctx => {
      let emailIdentity = await emailService.ensureCustomIdentity({
        sender: ctx.sender,
        email: ctx.input.email,
        name: ctx.input.name
      });

      return emailIdentityPresenter(emailIdentity);
    }),

  get: emailIdentityApp
    .handler()
    .input(
      v.object({
        senderId: v.string(),
        emailIdentityId: v.string()
      })
    )
    .do(async ctx => emailIdentityPresenter(ctx.emailIdentity))
});
