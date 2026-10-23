import {
  agentsLoader,
  callbacksLoader,
  chatConnectionsLoader,
  chatInstancesLoader,
  consumersLoader,
  identitiesLoader,
  identityActorsLoader,
  instanceProviderAuthConfigsLoader,
  integrationInstancesLoader,
  integrationsLoader,
  magicMcpGroupsLoader,
  magicMcpServersLoader,
  providerAuthCredentialsLoader,
  providerAuthMethodsLoader,
  providerConfigsLoader,
  providerConfigVaultsLoader,
  providerDeploymentsLoader,
  providerLoader,
  providerSpecificationsLoader,
  providerToolsLoader,
  providersLoader,
  providerVersionsLoader,
  sandboxImagesLoader,
  sandboxMachinesLoader,
  sessionsLoader,
  skillGroupsLoader,
  skillMarketplacesLoader,
  skillsLoader,
  useProviderAuthMethodsByIds,
  useProviderToolsByIds,
  useProviderVersionsByIds,
  webhookRegistrationsLoader
} from '@metorial/state';
import type { TableFilterPayloadMap } from '@metorial/ui-product';
import {
  defineEntityFilter,
  formatCreated,
  getFilterIds,
  shortId,
  useEntityList,
  type EntityFilterOptions,
  type EntityListQuery
} from './define';

export {
  defineEntityFilter,
  formatCreated,
  shortId,
  useEntityList,
  type EntityDefinition,
  type EntityFilterOptions,
  type EntityListQuery
} from './define';

type InstanceId = string | null | undefined;

let listParams = (instanceId: InstanceId, q: EntityListQuery | null) =>
  instanceId && q ? { instanceId, search: q.search, id: q.ids, limit: q.limit } : null;

let recentParams = (instanceId: InstanceId, q: EntityListQuery | null) =>
  instanceId && q ? { instanceId, id: q.ids, limit: q.limit, order: 'desc' as const } : null;

let named = (item: { id: string; name?: string | null }) => ({
  id: item.id,
  label: item.name || item.id
});

type ProviderScope = { providerField?: string; providerId?: string };

let getScopedProviderIds = (filters: TableFilterPayloadMap, scope: ProviderScope) =>
  scope.providerId
    ? [scope.providerId]
    : getFilterIds(filters, scope.providerField ?? 'providerId');

let selectedProviderId = (filters: TableFilterPayloadMap, scope: ProviderScope) => {
  let ids = getScopedProviderIds(filters, scope);
  return ids.length == 1 ? ids[0] : undefined;
};

let providerGate =
  (noun: string, scope: ProviderScope) => (filters: TableFilterPayloadMap) => {
    let ids = getScopedProviderIds(filters, scope);
    if (ids.length == 0) return `Select a provider to pick ${noun}.`;
    if (ids.length > 1) return `Select a single provider to pick ${noun}.`;
    return undefined;
  };

let useCurrentProviderVersionId = (
  instanceId: InstanceId,
  q: EntityListQuery | null,
  scope: ProviderScope
) => {
  let providerId = q && !q.ids ? selectedProviderId(q.filters, scope) : undefined;
  let provider = providerLoader.use(
    instanceId && providerId ? { instanceId, providerId } : null
  );
  return {
    providerVersionId: provider.data?.currentVersion?.id,
    isLoading: provider.isLoading
  };
};

export let entityFilters = {
  provider: (instanceId: InstanceId, opts?: EntityFilterOptions) =>
    defineEntityFilter({
      id: 'providerId',
      label: 'Provider',
      noun: 'providers',
      mode: 'search',
      useList: q =>
        useEntityList(providersLoader.use(listParams(instanceId, q)), item => ({
          id: item.id,
          label: item.name,
          slug: item.slug
        }))
    })(opts),

  providerDeployment: (instanceId: InstanceId, opts?: EntityFilterOptions) =>
    defineEntityFilter({
      id: 'providerDeploymentId',
      label: 'Deployment',
      noun: 'deployments',
      mode: 'search',
      useList: q =>
        useEntityList(providerDeploymentsLoader.use(listParams(instanceId, q)), named)
    })(opts),

  providerConfig: (instanceId: InstanceId, opts?: EntityFilterOptions) =>
    defineEntityFilter({
      id: 'providerConfigId',
      label: 'Config',
      noun: 'configs',
      mode: 'search',
      useList: q => useEntityList(providerConfigsLoader.use(listParams(instanceId, q)), named)
    })(opts),

  providerAuthConfig: (instanceId: InstanceId, opts?: EntityFilterOptions) =>
    defineEntityFilter({
      id: 'providerAuthConfigId',
      label: 'Auth Config',
      noun: 'auth configs',
      mode: 'search',
      useList: q =>
        useEntityList(instanceProviderAuthConfigsLoader.use(listParams(instanceId, q)), named)
    })(opts),

  providerAuthCredentials: (instanceId: InstanceId, opts?: EntityFilterOptions) =>
    defineEntityFilter({
      id: 'providerAuthCredentialsId',
      label: 'Credentials',
      noun: 'credentials',
      mode: 'search',
      useList: q =>
        useEntityList(providerAuthCredentialsLoader.use(listParams(instanceId, q)), named)
    })(opts),

  providerConfigVault: (instanceId: InstanceId, opts?: EntityFilterOptions) =>
    defineEntityFilter({
      id: 'providerConfigVaultId',
      label: 'Config Vault',
      noun: 'config vaults',
      mode: 'search',
      useList: q =>
        useEntityList(providerConfigVaultsLoader.use(listParams(instanceId, q)), named)
    })(opts),

  providerVersion: (instanceId: InstanceId, opts?: EntityFilterOptions & ProviderScope) => {
    let scope: ProviderScope = opts ?? {};
    let toOption = (item: { id: string; name?: string | null; createdAt: Date }) => ({
      id: item.id,
      label: item.name || shortId(item.id),
      description: formatCreated(item.createdAt)
    });

    return defineEntityFilter({
      id: 'providerVersionId',
      label: 'Version',
      noun: 'versions',
      mode: 'recent',
      blockedMessage: providerGate('versions', scope),
      useList: q => {
        let providerId = q && !q.ids ? selectedProviderId(q.filters, scope) : undefined;
        let list = useEntityList(
          providerVersionsLoader.use(
            instanceId && q && providerId
              ? { instanceId, providerId, limit: q.limit, order: 'desc' as const }
              : null
          ),
          toOption
        );
        let byIds = useEntityList(
          useProviderVersionsByIds(instanceId, q?.ids ?? null),
          toOption
        );

        return q?.ids ? byIds : list;
      }
    })(opts);
  },

  providerSpecification: (instanceId: InstanceId, opts?: EntityFilterOptions) =>
    defineEntityFilter({
      id: 'providerSpecificationId',
      label: 'Specification',
      noun: 'specifications',
      mode: 'recent',
      useList: q =>
        useEntityList(providerSpecificationsLoader.use(recentParams(instanceId, q)), item => ({
          id: item.id,
          label: item.name || shortId(item.id),
          description: formatCreated(item.createdAt)
        }))
    })(opts),

  tool: (instanceId: InstanceId, opts?: EntityFilterOptions & ProviderScope) => {
    let scope: ProviderScope = opts ?? {};
    return defineEntityFilter({
      id: 'toolId',
      label: 'Tool',
      noun: 'tools',
      mode: 'recent',
      blockedMessage: providerGate('tools', scope),
      useList: q => {
        let version = useCurrentProviderVersionId(instanceId, q, scope);
        let list = useEntityList(
          providerToolsLoader.use(
            instanceId && version.providerVersionId
              ? { instanceId, providerVersionId: version.providerVersionId }
              : null
          ),
          item => ({ id: item.id, label: item.name || item.key, slug: item.key })
        );
        let byIds = useEntityList(useProviderToolsByIds(instanceId, q?.ids ?? null), item => ({
          id: item.id,
          label: item.name || item.key,
          slug: item.key
        }));

        if (q?.ids) return byIds;
        return { items: list.items, isLoading: list.isLoading || version.isLoading };
      }
    })(opts);
  },

  providerAuthMethod: (instanceId: InstanceId, opts?: EntityFilterOptions & ProviderScope) => {
    let scope: ProviderScope = opts ?? {};
    return defineEntityFilter({
      id: 'providerAuthMethodId',
      label: 'Auth Method',
      noun: 'auth methods',
      mode: 'recent',
      blockedMessage: providerGate('auth methods', scope),
      useList: q => {
        let version = useCurrentProviderVersionId(instanceId, q, scope);
        let list = useEntityList(
          providerAuthMethodsLoader.use(
            instanceId && version.providerVersionId
              ? { instanceId, providerVersionId: version.providerVersionId, limit: 100 }
              : null
          ),
          item => ({ id: item.id, label: item.name || item.key, slug: item.key })
        );
        let byIds = useEntityList(
          useProviderAuthMethodsByIds(instanceId, q?.ids ?? null),
          item => ({ id: item.id, label: item.name || item.key, slug: item.key })
        );

        if (q?.ids) return byIds;
        return { items: list.items, isLoading: list.isLoading || version.isLoading };
      }
    })(opts);
  },

  agent: (instanceId: InstanceId, opts?: EntityFilterOptions) =>
    defineEntityFilter({
      id: 'agentId',
      label: 'Agent',
      noun: 'agents',
      mode: 'search',
      useList: q =>
        useEntityList(agentsLoader.use(listParams(instanceId, q)), item => ({
          id: item.id,
          label: item.name,
          slug: item.slug
        }))
    })(opts),

  actor: (instanceId: InstanceId, opts?: EntityFilterOptions) =>
    defineEntityFilter({
      id: 'actorId',
      label: 'Actor',
      noun: 'actors',
      mode: 'search',
      useList: q => useEntityList(identityActorsLoader.use(listParams(instanceId, q)), named)
    })(opts),

  identity: (instanceId: InstanceId, opts?: EntityFilterOptions) =>
    defineEntityFilter({
      id: 'identityId',
      label: 'Identity',
      noun: 'identities',
      mode: 'search',
      useList: q => useEntityList(identitiesLoader.use(listParams(instanceId, q)), named)
    })(opts),

  consumer: (instanceId: InstanceId, opts?: EntityFilterOptions) =>
    defineEntityFilter({
      id: 'consumerId',
      label: 'Consumer',
      noun: 'consumers',
      mode: 'search',
      useList: q =>
        useEntityList(consumersLoader.use(listParams(instanceId, q)), item => ({
          id: item.id,
          label: item.name || item.email || item.id,
          description: item.name && item.email ? item.email : undefined,
          slug: item.email ?? undefined
        }))
    })(opts),

  session: (instanceId: InstanceId, opts?: EntityFilterOptions) =>
    defineEntityFilter({
      id: 'sessionId',
      label: 'Session',
      noun: 'sessions',
      mode: 'recent',
      useList: q =>
        useEntityList(sessionsLoader.use(recentParams(instanceId, q)), item => ({
          id: item.id,
          label: shortId(item.id),
          description: formatCreated(item.createdAt)
        }))
    })(opts),

  integration: (instanceId: InstanceId, opts?: EntityFilterOptions) =>
    defineEntityFilter({
      id: 'integrationId',
      label: 'Integration',
      noun: 'integrations',
      mode: 'search',
      useList: q =>
        useEntityList(integrationsLoader.use(listParams(instanceId, q)), item => ({
          id: item.id,
          label: item.name,
          slug: item.slug
        }))
    })(opts),

  integrationInstance: (instanceId: InstanceId, opts?: EntityFilterOptions) =>
    defineEntityFilter({
      id: 'integrationInstanceId',
      label: 'Integration Instance',
      noun: 'integration instances',
      mode: 'search',
      useList: q =>
        useEntityList(integrationInstancesLoader.use(listParams(instanceId, q)), named)
    })(opts),

  magicMcpServer: (instanceId: InstanceId, opts?: EntityFilterOptions) =>
    defineEntityFilter({
      id: 'magicMcpServerId',
      label: 'Magic MCP Server',
      noun: 'servers',
      mode: 'search',
      useList: q => useEntityList(magicMcpServersLoader.use(listParams(instanceId, q)), named)
    })(opts),

  magicMcpGroup: (instanceId: InstanceId, opts?: EntityFilterOptions) =>
    defineEntityFilter({
      id: 'magicMcpGroupId',
      label: 'Group',
      noun: 'groups',
      mode: 'search',
      useList: q =>
        useEntityList(magicMcpGroupsLoader.use(listParams(instanceId, q)), item => ({
          id: item.id,
          label: item.name || item.id,
          slug: item.slug ?? undefined
        }))
    })(opts),

  skill: (instanceId: InstanceId, opts?: EntityFilterOptions) =>
    defineEntityFilter({
      id: 'skillId',
      label: 'Skill',
      noun: 'skills',
      mode: 'search',
      useList: q =>
        useEntityList(skillsLoader.use(listParams(instanceId, q)), item => ({
          id: item.id,
          label: item.name,
          slug: item.slug
        }))
    })(opts),

  skillGroup: (instanceId: InstanceId, opts?: EntityFilterOptions) =>
    defineEntityFilter({
      id: 'skillGroupId',
      label: 'Skill Group',
      noun: 'skill groups',
      mode: 'search',
      useList: q => useEntityList(skillGroupsLoader.use(listParams(instanceId, q)), named)
    })(opts),

  skillMarketplace: (instanceId: InstanceId, opts?: EntityFilterOptions) =>
    defineEntityFilter({
      id: 'skillMarketplaceId',
      label: 'Marketplace',
      noun: 'marketplaces',
      mode: 'search',
      useList: q =>
        useEntityList(skillMarketplacesLoader.use(listParams(instanceId, q)), item => ({
          id: item.id,
          label: item.name,
          slug: item.slug
        }))
    })(opts),

  callback: (instanceId: InstanceId, opts?: EntityFilterOptions) =>
    defineEntityFilter({
      id: 'callbackId',
      label: 'Callback',
      noun: 'callbacks',
      mode: 'search',
      useList: q => useEntityList(callbacksLoader.use(listParams(instanceId, q)), named)
    })(opts),

  webhookRegistration: (instanceId: InstanceId, opts?: EntityFilterOptions) =>
    defineEntityFilter({
      id: 'webhookRegistrationId',
      label: 'Webhook Registration',
      noun: 'webhook registrations',
      mode: 'recent',
      useList: q =>
        useEntityList(webhookRegistrationsLoader.use(recentParams(instanceId, q)), item => ({
          id: item.id,
          label: shortId(item.id),
          description: formatCreated(item.createdAt)
        }))
    })(opts),

  chatConnection: (instanceId: InstanceId, opts?: EntityFilterOptions) =>
    defineEntityFilter({
      id: 'chatConnectionId',
      label: 'Chat Connection',
      noun: 'chat connections',
      mode: 'search',
      useList: q =>
        useEntityList(chatConnectionsLoader.use(listParams(instanceId, q)), item => ({
          id: item.id,
          label: item.name,
          slug: item.slug
        }))
    })(opts),

  chatInstance: (instanceId: InstanceId, opts?: EntityFilterOptions) =>
    defineEntityFilter({
      id: 'chatInstanceId',
      label: 'Chat Instance',
      noun: 'chat instances',
      mode: 'search',
      useList: q => useEntityList(chatInstancesLoader.use(listParams(instanceId, q)), named)
    })(opts),

  sandboxMachine: (instanceId: InstanceId, opts?: EntityFilterOptions) =>
    defineEntityFilter({
      id: 'machineId',
      label: 'Machine',
      noun: 'machines',
      mode: 'search',
      useList: q =>
        useEntityList(sandboxMachinesLoader.use(listParams(instanceId, q)), item => ({
          id: item.id,
          label: item.name || item.slug || item.id,
          slug: item.slug ?? undefined
        }))
    })(opts),

  sandboxImage: (instanceId: InstanceId, opts?: EntityFilterOptions) =>
    defineEntityFilter({
      id: 'imageId',
      label: 'Image',
      noun: 'images',
      mode: 'search',
      useList: q =>
        useEntityList(sandboxImagesLoader.use(listParams(instanceId, q)), item => ({
          id: item.id,
          label: item.name || item.identifier || item.id,
          slug: item.identifier ?? undefined
        }))
    })(opts)
};
