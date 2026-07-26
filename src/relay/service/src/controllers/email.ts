import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { incomingEmailPresenter, outgoingEmailPresenter } from '../presenters';
import { emailService, incomingEmailService } from '../services';
import { app } from './_app';
import { senderApp } from './sender';

let attachmentInput = v.object({
  filename: v.string(),
  contentType: v.string(),
  content: v.string(),
  disposition: v.optional(v.string()),
  contentId: v.optional(v.string())
});

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
        fromName: v.optional(v.string()),
        replyTo: v.optional(v.string()),
        idempotencyKey: v.optional(v.string()),
        attachments: v.optional(v.array(attachmentInput)),
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
        fromName: ctx.input.fromName,
        replyTo: ctx.input.replyTo,
        idempotencyKey: ctx.input.idempotencyKey,
        attachments: ctx.input.attachments,
        content: ctx.input.content
      });

      return { id: email.id };
    }),

  receive: senderApp
    .handler()
    .input(
      v.object({
        senderId: v.string(),
        raw: v.string()
      })
    )
    .do(async ctx => {
      let email = await incomingEmailService.receiveEmail({
        sender: ctx.sender,
        raw: ctx.input.raw
      });

      return incomingEmailPresenter(email);
    }),

  getOutgoing: senderApp
    .handler()
    .input(
      v.object({
        senderId: v.string(),
        outgoingEmailId: v.string()
      })
    )
    .do(async ctx => {
      let email = await emailService.getOutgoingEmailById({
        sender: ctx.sender,
        id: ctx.input.outgoingEmailId
      });

      return outgoingEmailPresenter(email);
    }),

  status: senderApp
    .handler()
    .input(
      v.object({
        senderId: v.string(),
        outgoingEmailId: v.string()
      })
    )
    .do(async ctx => {
      let email = await emailService.getOutgoingEmailById({
        sender: ctx.sender,
        id: ctx.input.outgoingEmailId
      });

      return outgoingEmailPresenter(email);
    }),

  get: senderApp
    .handler()
    .input(
      v.object({
        senderId: v.string(),
        incomingEmailId: v.string()
      })
    )
    .do(async ctx => {
      let email = await incomingEmailService.getIncomingEmailById({
        sender: ctx.sender,
        id: ctx.input.incomingEmailId
      });

      return incomingEmailPresenter(email);
    }),

  getMany: senderApp
    .handler()
    .input(
      v.object({
        senderId: v.string(),
        ids: v.array(v.string())
      })
    )
    .do(async ctx => {
      let emails = await incomingEmailService.getManyIncomingEmailsByIds({
        sender: ctx.sender,
        ids: ctx.input.ids
      });

      return emails.map(incomingEmailPresenter);
    }),

  list: senderApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          senderId: v.string(),
          inboxIds: v.optional(v.array(v.string())),
          threadIds: v.optional(v.array(v.string())),
          ids: v.optional(v.array(v.string())),
          messageIds: v.optional(v.array(v.string()))
        })
      )
    )
    .do(async ctx => {
      let paginator = await incomingEmailService.listIncomingEmails({
        sender: ctx.sender,
        inboxIds: ctx.input.inboxIds,
        threadIds: ctx.input.threadIds,
        ids: ctx.input.ids,
        messageIds: ctx.input.messageIds
      });
      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, incomingEmailPresenter);
    }),

  reply: senderApp
    .handler()
    .input(
      v.object({
        senderId: v.string(),
        incomingEmailId: v.string(),
        emailIdentityId: v.string(),
        to: v.optional(v.array(v.string())),
        template: v.optional(v.record(v.any())),
        fromName: v.optional(v.string()),
        replyTo: v.optional(v.string()),
        idempotencyKey: v.optional(v.string()),
        attachments: v.optional(v.array(attachmentInput)),
        content: v.object({
          subject: v.optional(v.string()),
          html: v.string(),
          text: v.string()
        })
      })
    )
    .do(async ctx => {
      let email = await incomingEmailService.replyToIncomingEmail({
        sender: ctx.sender,
        incomingEmailId: ctx.input.incomingEmailId,
        emailIdentityId: ctx.input.emailIdentityId,
        input: {
          to: ctx.input.to,
          template: ctx.input.template,
          fromName: ctx.input.fromName,
          replyTo: ctx.input.replyTo,
          idempotencyKey: ctx.input.idempotencyKey,
          attachments: ctx.input.attachments,
          content: ctx.input.content
        }
      });

      return { id: email.id };
    })
});
