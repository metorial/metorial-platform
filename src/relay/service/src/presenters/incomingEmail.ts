import type {
  Inbox,
  IncomingEmail,
  IncomingEmailAttachment,
  IncomingEmailThread
} from '../../prisma/generated/client';

export let incomingEmailPresenter = (
  email: IncomingEmail & {
    inbox: Inbox;
    thread: IncomingEmailThread;
    attachments: IncomingEmailAttachment[];
  }
) => ({
  object: 'relay#incoming_email',

  id: email.id,
  inboxId: email.inbox.id,
  threadId: email.thread.id,

  from: email.from,
  to: email.to,
  subject: email.subject,
  text: email.text,
  html: email.html,
  messageId: email.messageId,
  headers: email.headers,
  attachments: email.attachments.map(attachment => ({
    filename: attachment.filename,
    contentType: attachment.contentType,
    disposition: attachment.disposition,
    contentId: attachment.contentId,
    size: attachment.size,
    content: Buffer.from(attachment.content).toString('base64')
  })),

  createdAt: email.createdAt
});
