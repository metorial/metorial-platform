import type { User } from '@mtsrc/auth-core-db';
import { getImageUrl } from '@mtsrc/auth-core-http';

export let userPresenter = async (user: User) => ({
  object: 'ares#user' as const,

  id: user.id,

  signupMethod: user.signupMethod,
  hasLoggedIn: user.hasLoggedIn,
  email: user.email,
  name: user.name,
  firstName: user.firstName,
  lastName: user.lastName,

  lastLoginAt: user.lastLoginAt,
  lastActiveAt: user.lastActiveAt,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,

  imageUrl: await getImageUrl(user)
});
