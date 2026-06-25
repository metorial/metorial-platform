import type { SsoUser, SsoUserProfile } from '../../../../prisma/generated/client';
import { ssoUserPresenter } from './ssoUser';

export let ssoUserProfilePresenter = (profile: SsoUserProfile & { user: SsoUser }) => ({
  object: 'ares#user.sso_profile',

  id: profile.id,
  email: profile.email,
  uid: profile.uid,
  sub: profile.sub,
  firstName: profile.firstName,
  lastName: profile.lastName,
  roles: profile.roles,
  groups: profile.groups,
  raw: profile.raw,
  metadata: profile.metadata,

  user: ssoUserPresenter(profile.user),

  createdAt: profile.createdAt,
  updatedAt: profile.updatedAt
});
