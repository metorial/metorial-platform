import { ConsumerSession } from '@metorial/db';

export let authSessionPresenter = (session: ConsumerSession) => ({
  object: 'consumer#auth_session',

  id: session.id,
  createdAt: session.createdAt
});
