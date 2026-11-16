import type { SsoUser } from '@mtsrc/auth-core-db';

export let ssoUserPresenter = (user: SsoUser) => ({
  object: 'ares#user.sso_user',

  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
});
