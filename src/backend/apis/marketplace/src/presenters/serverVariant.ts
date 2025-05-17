import { Server, ServerConfigSchema, ServerVariant, ServerVersion } from '@metorial/db';
import { serverVersionPresenter } from './serverVersion';

export let serverVariantPresenter = (
  serverVariant: ServerVariant & {
    currentVersion: (ServerVersion & { schema: ServerConfigSchema }) | null;
    server: Server;
  }
) => ({
  object: 'marketplace*server.server_variant',

  id: serverVariant.id,
  identifier: serverVariant.identifier,

  serverId: serverVariant.server.id,

  currentVersion: serverVariant.currentVersion
    ? serverVersionPresenter({
        ...serverVariant.currentVersion,
        server: serverVariant.server,
        serverVariant: serverVariant
      })
    : null,

  createdAt: serverVariant.createdAt
});
