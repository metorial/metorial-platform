import type { SsoUser } from '../../../../prisma/generated/client';

export let ssoUserPresenter = (user: SsoUser) => ({
  object: 'ares#user.sso_user',

  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
});
