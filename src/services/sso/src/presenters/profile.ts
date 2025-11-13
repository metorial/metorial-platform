import { UserProfile } from '../db/schema';

export let profilePresenter = (profile: UserProfile) => ({
  object: 'sso.profile',

  id: profile._id.toString(),

  tenantId: profile.tenantId,
  connectionId: profile.connectionId,
  userId: profile.userId,

  email: profile.email,
  uid: profile.uid,
  uidHash: profile.uidHash,
  sub: profile.sub,
  firstName: profile.firstName,
  lastName: profile.lastName,
  roles: profile.roles,
  groups: profile.groups,

  metadata: profile.metadata,

  createdAt: profile.createdAt,
  updatedAt: profile.updatedAt
});
