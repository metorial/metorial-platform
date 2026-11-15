import {
  Fabric,
  type AuditSubspacePublicMcpServer,
  type AuditSubspacePublicMcpServerGrant,
  type FabricEvents
} from '@metorial/fabric';
import { auditTrackerService } from '@metorial/module-audit-tracker';
import { getSubspaceAuditScope, recordSubspaceAuditEvent } from './_shared';

let publicMcpServerPayload = (server: AuditSubspacePublicMcpServer) => ({
  id: server.id,
  status: server.status,
  slug: server.slug,
  name: server.name,
  description: server.description,
  provider: { id: server.provider.id, name: server.provider.name },
  deploymentId: server.deployment.id,
  toolFilter: server.toolFilter,
  redirectUriFilters: server.redirectUriFilters,
  maxActiveGrants: server.maxActiveGrants,
  accessTokenTtlSeconds: server.accessTokenTtlSeconds,
  refreshTokenTtlSeconds: server.refreshTokenTtlSeconds,
  grantIdleExpirySeconds: server.grantIdleExpirySeconds,
  disabledAt: server.disabledAt,
  archivedAt: server.archivedAt
});

let publicMcpServerGrantPayload = (grant: AuditSubspacePublicMcpServerGrant) => ({
  id: grant.id,
  status: grant.status,
  revokedReason: grant.revokedReason,
  publicMcpServer: { id: grant.publicMcpServer.id, slug: grant.publicMcpServer.slug },
  client: {
    id: grant.client.id,
    clientId: grant.client.clientId,
    clientName: grant.client.clientName
  },
  revokedAt: grant.revokedAt
});

export let recordPublicMcpServerCreated = async (
  event: FabricEvents['provider.public_mcp_server.created:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'public_mcp_server', 'create', {
      payload: publicMcpServerPayload(event.publicMcpServer)
    })
  );
};

export let recordPublicMcpServerUpdated = async (
  event: FabricEvents['provider.public_mcp_server.updated:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'public_mcp_server', 'update', {
      payload: publicMcpServerPayload(event.publicMcpServer),
      previousPayload: publicMcpServerPayload(event.previousPublicMcpServer)
    })
  );
};

export let recordPublicMcpServerArchived = async (
  event: FabricEvents['provider.public_mcp_server.archived:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'public_mcp_server', 'delete', {
      payload: publicMcpServerPayload(event.publicMcpServer)
    })
  );
};

export let recordPublicMcpServerGrantCreated = async (
  event: FabricEvents['provider.public_mcp_grant.created:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'public_mcp_server_grant', 'create', {
      payload: publicMcpServerGrantPayload(event.grant)
    })
  );
};

export let recordPublicMcpServerGrantRevoked = async (
  event: FabricEvents['provider.public_mcp_grant.revoked:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'public_mcp_server_grant', 'revoke', {
      payload: publicMcpServerGrantPayload(event.grant)
    })
  );
};

Fabric.listen('provider.public_mcp_server.created:after', recordPublicMcpServerCreated);
Fabric.listen('provider.public_mcp_server.updated:after', recordPublicMcpServerUpdated);
Fabric.listen('provider.public_mcp_server.archived:after', recordPublicMcpServerArchived);

Fabric.listen('provider.public_mcp_grant.created:after', recordPublicMcpServerGrantCreated);
Fabric.listen('provider.public_mcp_grant.revoked:after', recordPublicMcpServerGrantRevoked);
