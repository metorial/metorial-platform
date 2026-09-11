import { Fabric, type FabricEvents } from '@metorial/fabric';
import { auditTrackerService } from '@metorial/module-audit-tracker';
import { recordAuditEventAfterCommit } from './record';

let magicMcpServerPayload = (
  magicMcpServer: FabricEvents['magic_mcp.server.created:after']['magicMcpServer']
) => ({
  id: magicMcpServer.id,
  status: magicMcpServer.status,
  source: magicMcpServer.source,
  ownerType: magicMcpServer.ownerType,
  name: magicMcpServer.name,
  description: magicMcpServer.description,
  providerTemplateId: magicMcpServer.providerTemplateId,
  subspaceIntegrationInstanceId: magicMcpServer.subspaceIntegrationInstanceId,
  hasSubspaceBacking: magicMcpServer.hasSubspaceBacking
});

let magicMcpEndpointPayload = (
  magicMcpEndpoint: FabricEvents['magic_mcp.endpoint.created:after']['magicMcpEndpoint']
) => ({
  id: magicMcpEndpoint.id,
  status: magicMcpEndpoint.status,
  name: magicMcpEndpoint.name,
  description: magicMcpEndpoint.description,
  slug: magicMcpEndpoint.slug,
  consumerProfileId: magicMcpEndpoint.consumerProfile?.id ?? null,
  skillPluginId: magicMcpEndpoint.skillPlugin?.id ?? null,
  serverCount: magicMcpEndpoint.servers.length
});

let magicMcpGroupPayload = (
  magicMcpGroup: FabricEvents['magic_mcp.group.created:after']['magicMcpGroup']
) => ({
  id: magicMcpGroup.id,
  status: magicMcpGroup.status,
  name: magicMcpGroup.name,
  description: magicMcpGroup.description,
  slug: magicMcpGroup.slug,
  serverCount: magicMcpGroup.servers.length
});

let magicMcpTokenPayload = (
  magicMcpToken: FabricEvents['magic_mcp.token.created:after']['magicMcpToken']
) => ({
  id: magicMcpToken.id,
  status: magicMcpToken.status,
  name: magicMcpToken.name,
  description: magicMcpToken.description,
  isGroupLocked: magicMcpToken.isGroupLocked,
  magicMcpServerId: magicMcpToken.magicMcpServer?.id ?? null,
  magicMcpEndpointId: magicMcpToken.magicMcpEndpoint?.id ?? null,
  skillPluginId: magicMcpToken.skillPlugin?.id ?? null,
  groupIds: magicMcpToken.groups.map(group => group.magicMcpGroup.id),
  expiresAt: magicMcpToken.expiresAt
});

let providerTemplatePayload = (
  providerTemplate: FabricEvents['magic_mcp.provider_template.created:after']['providerTemplate']
) => ({
  id: providerTemplate.id,
  status: providerTemplate.status,
  name: providerTemplate.name,
  description: providerTemplate.description,
  subspaceIntegrationId: providerTemplate.subspaceIntegrationId,
  hasSubspaceBacking: providerTemplate.hasSubspaceBacking
});

export let recordMagicMcpServerCreated = async (
  event: FabricEvents['magic_mcp.server.created:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'magic_mcp_server', 'create', {
      payload: magicMcpServerPayload(event.magicMcpServer),
      recordedAt
    });
  });
};

export let recordMagicMcpServerUpdated = async (
  event: FabricEvents['magic_mcp.server.updated:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'magic_mcp_server', 'update', {
      payload: magicMcpServerPayload(event.magicMcpServer),
      previousPayload: magicMcpServerPayload(event.previousMagicMcpServer),
      recordedAt
    });
  });
};

export let recordMagicMcpServerArchived = async (
  event: FabricEvents['magic_mcp.server.archived:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'magic_mcp_server', 'delete', {
      payload: magicMcpServerPayload(event.magicMcpServer),
      recordedAt
    });
  });
};

export let recordMagicMcpEndpointCreated = async (
  event: FabricEvents['magic_mcp.endpoint.created:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'magic_mcp_endpoint', 'create', {
      payload: magicMcpEndpointPayload(event.magicMcpEndpoint),
      recordedAt
    });
  });
};

export let recordMagicMcpEndpointUpdated = async (
  event: FabricEvents['magic_mcp.endpoint.updated:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'magic_mcp_endpoint', 'update', {
      payload: magicMcpEndpointPayload(event.magicMcpEndpoint),
      previousPayload: magicMcpEndpointPayload(event.previousMagicMcpEndpoint),
      recordedAt
    });
  });
};

export let recordMagicMcpEndpointArchived = async (
  event: FabricEvents['magic_mcp.endpoint.archived:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'magic_mcp_endpoint', 'delete', {
      payload: magicMcpEndpointPayload(event.magicMcpEndpoint),
      recordedAt
    });
  });
};

export let recordMagicMcpEndpointServersModified = async (
  event: FabricEvents['magic_mcp.endpoint.servers.modified:after']
) => {
  if (event.servers.length == 0) return;

  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(
      event.auditScope,
      'magic_mcp_endpoint_servers',
      'modify',
      {
        payload: {
          endpointId: event.magicMcpEndpoint.id,
          endpointSlug: event.magicMcpEndpoint.slug,
          operation: event.operation,
          servers: event.servers
        },
        recordedAt
      }
    );
  });
};

export let recordMagicMcpGroupCreated = async (
  event: FabricEvents['magic_mcp.group.created:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'magic_mcp_group', 'create', {
      payload: magicMcpGroupPayload(event.magicMcpGroup),
      recordedAt
    });
  });
};

export let recordMagicMcpGroupUpdated = async (
  event: FabricEvents['magic_mcp.group.updated:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'magic_mcp_group', 'update', {
      payload: magicMcpGroupPayload(event.magicMcpGroup),
      previousPayload: magicMcpGroupPayload(event.previousMagicMcpGroup),
      recordedAt
    });
  });
};

export let recordMagicMcpGroupDeleted = async (
  event: FabricEvents['magic_mcp.group.deleted:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'magic_mcp_group', 'delete', {
      payload: magicMcpGroupPayload(event.magicMcpGroup),
      recordedAt
    });
  });
};

export let recordMagicMcpGroupServersModified = async (
  event: FabricEvents['magic_mcp.group.servers.modified:after']
) => {
  if (event.servers.length == 0) return;

  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(
      event.auditScope,
      'magic_mcp_group_servers',
      'modify',
      {
        payload: {
          groupId: event.magicMcpGroup.id,
          groupSlug: event.magicMcpGroup.slug,
          operation: event.operation,
          servers: event.servers
        },
        recordedAt
      }
    );
  });
};

export let recordMagicMcpTokenCreated = async (
  event: FabricEvents['magic_mcp.token.created:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'magic_mcp_token', 'create', {
      payload: magicMcpTokenPayload(event.magicMcpToken),
      recordedAt
    });
  });
};

export let recordMagicMcpTokenUpdated = async (
  event: FabricEvents['magic_mcp.token.updated:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'magic_mcp_token', 'update', {
      payload: magicMcpTokenPayload(event.magicMcpToken),
      previousPayload: magicMcpTokenPayload(event.previousMagicMcpToken),
      recordedAt
    });
  });
};

export let recordMagicMcpTokenRotated = async (
  event: FabricEvents['magic_mcp.token.rotated:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'magic_mcp_token', 'rotate', {
      payload: magicMcpTokenPayload(event.magicMcpToken),
      recordedAt
    });
  });
};

export let recordMagicMcpTokenDeleted = async (
  event: FabricEvents['magic_mcp.token.deleted:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'magic_mcp_token', 'delete', {
      payload: magicMcpTokenPayload(event.magicMcpToken),
      recordedAt
    });
  });
};

export let recordProviderTemplateCreated = async (
  event: FabricEvents['magic_mcp.provider_template.created:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'provider_template', 'create', {
      payload: providerTemplatePayload(event.providerTemplate),
      recordedAt
    });
  });
};

export let recordProviderTemplateUpdated = async (
  event: FabricEvents['magic_mcp.provider_template.updated:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'provider_template', 'update', {
      payload: providerTemplatePayload(event.providerTemplate),
      previousPayload: providerTemplatePayload(event.previousProviderTemplate),
      recordedAt
    });
  });
};

export let recordProviderTemplateArchived = async (
  event: FabricEvents['magic_mcp.provider_template.archived:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'provider_template', 'delete', {
      payload: providerTemplatePayload(event.providerTemplate),
      recordedAt
    });
  });
};

Fabric.listen('magic_mcp.server.created:after', recordMagicMcpServerCreated);
Fabric.listen('magic_mcp.server.updated:after', recordMagicMcpServerUpdated);
Fabric.listen('magic_mcp.server.archived:after', recordMagicMcpServerArchived);
Fabric.listen('magic_mcp.endpoint.created:after', recordMagicMcpEndpointCreated);
Fabric.listen('magic_mcp.endpoint.updated:after', recordMagicMcpEndpointUpdated);
Fabric.listen('magic_mcp.endpoint.archived:after', recordMagicMcpEndpointArchived);
Fabric.listen(
  'magic_mcp.endpoint.servers.modified:after',
  recordMagicMcpEndpointServersModified
);
Fabric.listen('magic_mcp.group.created:after', recordMagicMcpGroupCreated);
Fabric.listen('magic_mcp.group.updated:after', recordMagicMcpGroupUpdated);
Fabric.listen('magic_mcp.group.deleted:after', recordMagicMcpGroupDeleted);
Fabric.listen('magic_mcp.group.servers.modified:after', recordMagicMcpGroupServersModified);
Fabric.listen('magic_mcp.token.created:after', recordMagicMcpTokenCreated);
Fabric.listen('magic_mcp.token.updated:after', recordMagicMcpTokenUpdated);
Fabric.listen('magic_mcp.token.rotated:after', recordMagicMcpTokenRotated);
Fabric.listen('magic_mcp.token.deleted:after', recordMagicMcpTokenDeleted);
Fabric.listen('magic_mcp.provider_template.created:after', recordProviderTemplateCreated);
Fabric.listen('magic_mcp.provider_template.updated:after', recordProviderTemplateUpdated);
Fabric.listen('magic_mcp.provider_template.archived:after', recordProviderTemplateArchived);
