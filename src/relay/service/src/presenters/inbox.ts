import type { Inbox } from '../../prisma/generated/client';

export let inboxPresenter = (inbox: Inbox) => ({
  object: 'relay#inbox',

  id: inbox.id,
  email: inbox.email,
  senderOid: inbox.senderOid,

  createdAt: inbox.createdAt
});
