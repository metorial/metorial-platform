import type { Server, ServerConfig, Tenant } from '../../prisma/generated/client';

export let serverConfigPresenter = (
  serverConfig: ServerConfig & {
    server: Server;
    tenant: Tenant;
  }
) => ({
  object: 'shuttle#server_config',

  id: serverConfig.id,

  serverId: serverConfig.server.id,
  tenantId: serverConfig.tenant.id,

  createdAt: serverConfig.createdAt,
  updatedAt: serverConfig.updatedAt
});
