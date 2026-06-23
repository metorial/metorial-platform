import { v } from '@lowerdeck/validation';
import { emailService } from '../services';
import { app } from './_app';
import { senderApp } from './sender';

export let emailController = app.controller({
  send: senderApp
    .handler()
    .input(
      v.object({
        senderId: v.string(),
        emailIdentityId: v.string(),

        type: v.optional(v.enumOf(['email'])),
        to: v.array(v.string()),
        template: v.record(v.any()),
        content: v.object({
          subject: v.string(),
          html: v.string(),
          text: v.string()
        })
      })
    )
    .do(async ctx => {
      let emailIdentity = await emailService.getIdentityById({
        id: ctx.input.emailIdentityId,
        sender: ctx.sender
      });

      let email = await emailService.sendEmail({
        identity: emailIdentity,

        type: ctx.input.type || 'email',
        to: ctx.input.to,
        template: ctx.input.template,
        content: ctx.input.content
      });

      return { id: email.id };
    })
});
