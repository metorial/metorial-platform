import { Connection } from '../db/schema';

export let connectionPresenter = (connection: Connection) => ({
  object: 'sso.connection',

  id: connection._id.toString(),

  name: connection.name,
  metadata: connection.metadata,
  providerName: connection.providerName,
  providerType: connection.providerType,

  createdAt: connection.createdAt,
  updatedAt: connection.updatedAt
});
