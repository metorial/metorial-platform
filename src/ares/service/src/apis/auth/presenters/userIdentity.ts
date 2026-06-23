import type {
  AppOAuthProvider,
  SsoTenant,
  SsoUser,
  SsoUserProfile,
  User,
  UserIdentity,
  UserIdentityProvider
} from '../../../../prisma/generated/client';
import { ssoUserProfilePresenter } from './ssoUserProfile';
import { userIdentityProviderPresenter } from './userIdentityProvider';

export let userIdentityPresenter = (
  userIdentity: UserIdentity & {
    provider: UserIdentityProvider & {
      oauthProvider?: AppOAuthProvider | null;
      ssoTenant?: SsoTenant | null;
    };
    user: User | null;
    ssoUserProfile?: (SsoUserProfile & { user: SsoUser }) | null;
  }
) => ({
  object: 'ares#user.identity',

  id: userIdentity.id,
  userId: userIdentity.user?.id ?? null,

  provider: userIdentityProviderPresenter(userIdentity.provider),

  providerInfo: {
    id: userIdentity.uid,
    name: userIdentity.name,
    firstName: userIdentity.firstName,
    lastName: userIdentity.lastName,
    email: userIdentity.email,
    photoUrl: userIdentity.photoUrl
  },

  ssoProfile: userIdentity.ssoUserProfile
    ? ssoUserProfilePresenter(userIdentity.ssoUserProfile)
    : null,

  createdAt: userIdentity.createdAt,
  updatedAt: userIdentity.updatedAt
});
