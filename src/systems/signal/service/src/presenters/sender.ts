import type { Sender } from '../../prisma/generated/client';

export let senderPresenter = (sender: Sender) => ({
  object: 'signal#sender',

  id: sender.id,
  identifier: sender.identifier,
  name: sender.name,

  createdAt: sender.createdAt
});
