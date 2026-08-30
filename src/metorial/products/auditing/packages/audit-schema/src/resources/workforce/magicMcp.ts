import { v } from '@lowerdeck/validation';
import { resource } from '../../_lib/resource';

export let magicMcpServerAuditResource = resource({
  name: 'magic_mcp_server',
  payload: v.typedAny<{
    id: string;
    status: string;
    source: string;
    ownerType: string;
    name: string | null;
    description: string | null;
    providerTemplateId: string | null;
    subspaceIntegrationInstanceId: string | null;
    hasSubspaceBacking: boolean;
  }>('magic_mcp_server'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    delete: true
  }
});

export let magicMcpEndpointAuditResource = resource({
  name: 'magic_mcp_endpoint',
  payload: v.typedAny<{
    id: string;
    status: string;
    name: string | null;
    description: string | null;
    slug: string;
    consumerProfileId: string | null;
    skillPluginId: string | null;
    serverCount: number;
  }>('magic_mcp_endpoint'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    delete: true
  }
});

export type MagicMcpServerMembershipChange = {
  operation: 'add' | 'remove';
  servers: { id: string; name: string | null }[];
};

export let magicMcpEndpointServersAuditResource = resource({
  name: 'magic_mcp_endpoint_servers',
  payload: v.typedAny<
    {
      endpointId: string;
      endpointSlug: string;
    } & MagicMcpServerMembershipChange
  >('magic_mcp_endpoint_servers'),
  presenter: undefined,
  actions: {
    modify: true
  }
});

export let magicMcpGroupAuditResource = resource({
  name: 'magic_mcp_group',
  payload: v.typedAny<{
    id: string;
    status: string;
    name: string | null;
    description: string | null;
    slug: string;
    serverCount: number;
  }>('magic_mcp_group'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    delete: true
  }
});

export let magicMcpGroupServersAuditResource = resource({
  name: 'magic_mcp_group_servers',
  payload: v.typedAny<
    {
      groupId: string;
      groupSlug: string;
    } & MagicMcpServerMembershipChange
  >('magic_mcp_group_servers'),
  presenter: undefined,
  actions: {
    modify: true
  }
});

export let magicMcpTokenAuditResource = resource({
  name: 'magic_mcp_token',
  payload: v.typedAny<{
    id: string;
    status: string;
    name: string | null;
    description: string | null;
    isGroupLocked: boolean;
    magicMcpServerId: string | null;
    magicMcpEndpointId: string | null;
    skillPluginId: string | null;
    groupIds: string[];
    expiresAt: Date | null;
  }>('magic_mcp_token'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    rotate: true,
    delete: true
  }
});

export let providerTemplateAuditResource = resource({
  name: 'provider_template',
  payload: v.typedAny<{
    id: string;
    status: string;
    name: string;
    description: string | null;
    subspaceIntegrationId: string | null;
    hasSubspaceBacking: boolean;
  }>('provider_template'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    delete: true
  }
});
