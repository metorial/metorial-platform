import { Paths } from '@metorial/frontend-config';
import {
  useConsumer,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useIntegrations,
  useMagicMcpServers,
  useProvidersByIds
} from '@metorial/state';
import { useMemo } from 'react';
import type { UsageGroupBy } from './query';
import { formatUsageLabel } from './series';

let mcpProtocolMethods = new Set(['initialize', 'ping']);
let mcpProtocolPrefixes = [
  'notifications/',
  'tools/',
  'resources/',
  'prompts/',
  'completion/',
  'logging/',
  'sampling/',
  'roots/',
  'elicitation/'
];

export let isMcpProtocolMethod = (key: string) =>
  mcpProtocolMethods.has(key) || mcpProtocolPrefixes.some(prefix => key.startsWith(prefix));

let unknownGroupNames: Partial<Record<UsageGroupBy, string>> = {
  provider: 'No provider',
  deployment: 'No deployment',
  consumer: 'Anonymous',
  magic_mcp_server: 'No Magic MCP server',
  integration: 'No integration',
  tool: 'Unknown tool',
  error_type: 'Unknown error'
};

export let getUnknownGroupName = (groupBy: UsageGroupBy | undefined) =>
  (groupBy && unknownGroupNames[groupBy]) ?? 'Unknown';

export let useUsageGroupNames = (groupBy: UsageGroupBy | undefined, ids: string[]) => {
  let instance = useCurrentInstance();
  let instanceId = instance.data?.id;

  let uniqueIds = useMemo(() => [...new Set(ids)].sort(), [ids.join(',')]);
  let idsFor = (target: UsageGroupBy) =>
    groupBy == target && uniqueIds.length ? uniqueIds : null;

  let providerIds = idsFor('provider');
  let magicMcpServerIds = idsFor('magic_mcp_server');
  let integrationIds = idsFor('integration');

  let providers = useProvidersByIds(instanceId, providerIds);
  let magicMcpServers = useMagicMcpServers(magicMcpServerIds ? instanceId : null, {
    id: magicMcpServerIds ?? undefined,
    limit: magicMcpServerIds?.length
  });
  let integrations = useIntegrations(integrationIds ? instanceId : null, {
    id: integrationIds ?? undefined,
    limit: integrationIds?.length
  });

  return useMemo(() => {
    let names = new Map<string, string>();

    if (groupBy == 'provider') {
      for (let provider of providers.data ?? []) names.set(provider.id, provider.name);
    } else if (groupBy == 'magic_mcp_server') {
      for (let server of magicMcpServers.data?.items ?? []) {
        if (server.name) names.set(server.id, server.name);
      }
    } else if (groupBy == 'integration') {
      for (let integration of integrations.data?.items ?? []) {
        names.set(integration.id, integration.name);
      }
    }

    return (id: string) => {
      if (groupBy == 'error_type' || groupBy == 'kind') return formatUsageLabel(id);
      return names.get(id);
    };
  }, [groupBy, providers.data, magicMcpServers.data, integrations.data]);
};

export let UsageConsumerName = ({ id }: { id: string }) => {
  let instance = useCurrentInstance();
  let consumer = useConsumer(instance.data?.id, id);

  return <>{consumer.data?.name || consumer.data?.email || id}</>;
};

export let useUsageGroupHref = () => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();

  return (groupBy: UsageGroupBy, id: string) => {
    let args = [organization.data, project.data, instance.data, id] as const;

    if (groupBy == 'provider') return Paths.instance.provider(...args);
    if (groupBy == 'consumer') return Paths.instance.identity.consumer(...args);
    if (groupBy == 'magic_mcp_server') return Paths.instance.magicMcp.server(...args);
    if (groupBy == 'integration') return Paths.instance.integration(...args);

    return undefined;
  };
};
