import { ConsumerSession } from '@metorial/db';

export let authSessionPresenter = (session: ConsumerSession) => ({
  object: 'portal#auth_session',

  id: session.id,
  createdAt: session.createdAt
});
