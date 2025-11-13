import { User } from '../db/schema';

export let userPresenter = (user: User) => ({
  object: 'sso.user',

  id: user._id.toString(),

  tenantId: user.tenantId,

  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,

  createdAt: user.createdAt,
  updatedAt: user.updatedAt
});
