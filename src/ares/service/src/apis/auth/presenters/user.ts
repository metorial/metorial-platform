import type { User, UserEmail } from '../../../../prisma/generated/client';
import { deletedEmail } from '../../../lib/deletedEmail';
import { getImageUrl } from '../../../lib/getImageUrl';
import { userEmailPresenter } from './userEmail';

export let userPresenter = async (user: User & { userEmails: UserEmail[] }) => ({
  object: 'ares#user',

  status: user.deletedAt ? 'deleted' : 'active',

  id: user.id,

  email: user.deletedAt ? deletedEmail.restoreAnonymized(user.email) : user.email,
  name: user.name,
  firstName: user.firstName,
  lastName: user.lastName,

  lastLoginAt: user.lastLoginAt,
  lastActiveAt: user.lastActiveAt,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,

  emails: user.userEmails.map(e => userEmailPresenter({ ...e, user })),

  imageUrl: await getImageUrl(user),
  image: user.image
});
