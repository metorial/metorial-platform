import type { SessionConnection } from '@metorial-subspace/db';

export let connectionPresenter = (connection: SessionConnection) => ({
  object: 'session.connection',

  id: connection.id,
  token: connection.token,

  createdAt: connection.createdAt
});
