import { Auth } from '../db/schema';
import { env } from '../env';

export let authPresenter = (auth: Auth) => ({
  object: 'sso.setup',

  id: auth._id.toString(),

  status: auth.status,
  state: auth.state,

  tenantId: auth.tenantId,
  connectionId: auth.connectionId,
  userId: auth.userId,
  userProfileId: auth.userProfileId,

  clientSecret: auth.clientSecret,
  redirectUri: auth.redirectUri,

  url: `${env.saml.SSO_SERVICE_HOST}/sso/auth?client_secret=${auth.clientSecret}`,

  createdAt: auth.createdAt,
  updatedAt: auth.updatedAt
});
