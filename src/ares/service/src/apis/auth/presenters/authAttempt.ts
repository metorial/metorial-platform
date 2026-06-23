import type { AuthAttempt } from '../../../../prisma/generated/client';

export let authAttemptPresenter = (authAttempt: AuthAttempt) => ({
  object: 'ares#auth.attempt',

  id: authAttempt.id,
  clientSecret: authAttempt.clientSecret,

  redirectUrl: authAttempt.redirectUrl,

  createdAt: authAttempt.createdAt
});
