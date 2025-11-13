import { ConnectionSetup } from '../db/schema';
import { env } from '../env';

export let setupPresenter = (setup: ConnectionSetup) => ({
  object: 'sso.setup',

  id: setup._id.toString(),

  status: setup.status,

  tenantId: setup.tenantId,
  connectionId: setup.connectionId,

  clientSecret: setup.clientSecret,
  redirectUri: setup.redirectUri,

  url: `${env.saml.SSO_SERVICE_HOST}/sso/setup?client_secret=${setup.clientSecret}`,

  createdAt: setup.createdAt,
  updatedAt: setup.updatedAt
});
