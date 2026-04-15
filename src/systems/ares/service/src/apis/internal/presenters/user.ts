import type { User } from '../../../../prisma/generated/client';
import { getImageUrl } from '../../../lib/getImageUrl';

export let userPresenter = async (user: User) => ({
  object: 'ares#user' as const,

  id: user.id,

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
