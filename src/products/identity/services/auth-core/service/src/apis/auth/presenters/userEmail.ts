import type { User, UserEmail } from '../../../../prisma/generated/client';

export let userEmailPresenter = (userEmail: UserEmail & { user: User }) => ({
  object: 'ares#user.email',

  id: userEmail.id,
  userId: userEmail.user.id,

  email: userEmail.email,
  normalizedEmail: userEmail.normalizedEmail,

  isPrimary: userEmail.isPrimary,

  createdAt: userEmail.createdAt,
  verifiedAt: userEmail.verifiedAt,
  updatedAt: userEmail.updatedAt
});
