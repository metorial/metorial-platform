import { Server, ServerConfigSchema, ServerVariant, ServerVersion } from '@metorial/db';

export let serverVersionPresenter = (
  serverVersion: ServerVersion & {
    server: Server;
    serverVariant: ServerVariant;
    schema: ServerConfigSchema;
  }
) => ({
  object: 'marketplace*server.server_version',

  id: serverVersion.id,
  identifier: serverVersion.identifier,

  serverId: serverVersion.server.id,
  serverVariantId: serverVersion.serverVariant.id,

  getLaunchParams: serverVersion.getLaunchParams,

  schema: {
    id: serverVersion.schema.id,
    fingerprint: serverVersion.schema.fingerprint,
    schema:
      typeof serverVersion.schema.schema == 'string'
        ? JSON.parse(serverVersion.schema.schema)
        : serverVersion.schema.schema,

    serverId: serverVersion.server.id,
    serverVariantId: serverVersion.serverVariant.id,
    serverVersionId: serverVersion.id,

    createdAt: serverVersion.schema.createdAt
  },

  createdAt: serverVersion.createdAt
});
