import { ConnectionSetup } from '../db/schema';

export let setupPresenter = (setup: ConnectionSetup) => ({
  object: 'sso.setup',

  id: setup._id.toString(),

  status: setup.status,

  tenantId: setup.tenantId,
  connectionId: setup.connectionId,

  clientSecret: setup.clientSecret,
  redirectUri: setup.redirectUri,

  createdAt: setup.createdAt,
  updatedAt: setup.updatedAt
});
