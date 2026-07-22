import type { Inbox, IncomingEmail, IncomingEmailThread } from '../../prisma/generated/client';

export let incomingEmailPresenter = (
  email: IncomingEmail & {
    inbox: Inbox;
    thread: IncomingEmailThread;
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
  messageId: email.messageId,
  headers: email.headers,

  createdAt: email.createdAt
});
