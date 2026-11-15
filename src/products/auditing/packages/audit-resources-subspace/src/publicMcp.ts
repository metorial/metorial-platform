import { v } from '@lowerdeck/validation';
import { resource } from '@metorial/audit-stash';
import type { SubspaceProviderSummary } from './_shared';

export let publicMcpServerAuditResource = resource({
  name: 'public_mcp_server',
  payload: v.typedAny<{
    id: string;
    status: string;
    slug: string;
    name: string;
    description: string | null;
    provider: SubspaceProviderSummary;
    deploymentId: string;
    toolFilter: unknown;
    redirectUriFilters: string[];
    maxActiveGrants: number | null;
    accessTokenTtlSeconds: number;
    refreshTokenTtlSeconds: number;
    grantIdleExpirySeconds: number;
    disabledAt: Date | null;
    archivedAt: Date | null;
  }>('public_mcp_server'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    delete: true
  }
});

/**
 * One end user's access to a public MCP server. The payload deliberately carries no
 * credential material -- only which client was authorized and why access ended.
 */
export let publicMcpServerGrantAuditResource = resource({
  name: 'public_mcp_server_grant',
  payload: v.typedAny<{
    id: string;
    status: string;
    revokedReason: string | null;
    publicMcpServer: { id: string; slug: string };
    client: { id: string; clientId: string; clientName: string | null };
    revokedAt: Date | null;
  }>('public_mcp_server_grant'),
  presenter: undefined,
  actions: {
    create: true,
    revoke: true
  }
});
