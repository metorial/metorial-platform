import type { Inbox, IncomingEmailThread } from '../../prisma/generated/client';

export let incomingEmailThreadPresenter = (
  thread: IncomingEmailThread & {
    inbox: Inbox;
  }
) => ({
  object: 'relay#incoming_email_thread',

  id: thread.id,
  inboxId: thread.inbox.id,
  subject: thread.subject,

  createdAt: thread.createdAt
});
