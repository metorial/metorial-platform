import type { SessionMessage } from '@metorial-subspace/db';

export let sessionMessagePresenter = (sessionMessage: SessionMessage) => ({
  object: 'session.message',

  id: sessionMessage.id,
  status: sessionMessage.status,
  type: sessionMessage.type,

  toolKey: sessionMessage.methodOrToolKey,

  createdAt: sessionMessage.createdAt,
  completedAt: sessionMessage.completedAt
});
