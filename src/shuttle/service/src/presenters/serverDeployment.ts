import type {
  Server,
  ServerDeployment,
  ServerVersion,
  Tenant
} from '../../prisma/generated/client';

export let serverDeploymentPresenter = (
  serverDeployment: ServerDeployment & {
    server: Server;
    tenant: Tenant | null;
    serverVersion: ServerVersion | null;
  }
) => ({
  object: 'shuttle#server_deployment',

  id: serverDeployment.id,
  status: serverDeployment.status,

  serverId: serverDeployment.server.id,
  tenantId: serverDeployment.tenant?.id || null,
  serverVersionId: serverDeployment.serverVersion?.id || null,

  createdAt: serverDeployment.createdAt,
  updatedAt: serverDeployment.updatedAt,
  startedAt: serverDeployment.startedAt,
  endedAt: serverDeployment.endedAt
});
