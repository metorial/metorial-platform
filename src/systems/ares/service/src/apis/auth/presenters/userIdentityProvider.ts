import type {
  AppOAuthProvider,
  SsoTenant,
  UserIdentityProvider
} from '../../../../prisma/generated/client';
import { oauthProviderPresenter } from './oauthProvider';
import { ssoTenantPresenter } from './ssoTenant';

export let userIdentityProviderPresenter = (
  provider: UserIdentityProvider & {
    oauthProvider?: AppOAuthProvider | null;
    ssoTenant?: SsoTenant | null;
  }
) => ({
  object: 'ares#user.identity.provider',

  id: provider.id,

  name: provider.name,

  oauthProvider: provider.oauthProvider
    ? oauthProviderPresenter(provider.oauthProvider)
    : null,
  ssoTenant: provider.ssoTenant ? ssoTenantPresenter(provider.ssoTenant) : null,

  createdAt: provider.createdAt
});
