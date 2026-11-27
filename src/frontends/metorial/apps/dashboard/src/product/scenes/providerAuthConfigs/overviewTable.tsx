import {
  DashboardInstanceProviderDeploymentsAuthConfigsListOutput,
  DashboardInstanceProviderDeploymentsAuthConfigsListQuery
} from '@metorial/dashboard-sdk';
import {
  col,
  createDataList,
  deleteAction,
  f,
  lifecycleStatus,
  withDefaults
} from '@metorial/data-list';
import { Paths } from '@metorial/frontend-config';
import { useDeleteProviderAuthConfig, useProviderAuthConfigs } from '@metorial/state';
import { Badge, Text } from '@metorial/ui';
import { entityFilters } from '../entityFilters';
import { useInstanceContext, withProviderNames } from '../../lib/dataList';

type AuthConfigItem =
  DashboardInstanceProviderDeploymentsAuthConfigsListOutput['items'][number];

export type AuthConfigFilters = Omit<
  DashboardInstanceProviderDeploymentsAuthConfigsListQuery,
  'limit' | 'after' | 'before' | 'cursor'
>;

let formatType = (type: string | null | undefined) => {
  if (type === 'oauth_automated') return 'OAuth (Automated)';
  if (type === 'oauth_manual') return 'OAuth (Manual)';
  if (type === 'manual') return 'Manual';
  return undefined;
};

let formatSource = (source: AuthConfigItem['source'] | null | undefined) => {
  if (source === 'manual') return 'Manual';
  if (source === 'setup_session') return 'Setup Session';
  if (source === 'system') return 'System';
  return undefined;
};

export let ProviderAuthConfigsOverviewTable = createDataList<{
  instanceId?: string;
  filters?: AuthConfigFilters;
}>('provider-auth-configs-overview')
  .context(useInstanceContext)
  .filters((props, ctx) => {
    let instanceId = props.instanceId ?? ctx.instanceId;
    let providerId =
      typeof props.filters?.providerId == 'string' ? props.filters.providerId : undefined;

    return {
      status: f.status(lifecycleStatus, { only: ['active', 'archived'] }),
      providerId: f.entity(entityFilters.provider(instanceId)),
      providerDeploymentId: f.entity(entityFilters.providerDeployment(instanceId)),
      providerAuthCredentialsId: f.entity(entityFilters.providerAuthCredentials(instanceId)),
      providerAuthMethodId: f.entity(
        entityFilters.providerAuthMethod(instanceId, { providerId })
      ),
      createdAt: f.createdAt(),
      updatedAt: f.updatedAt()
    };
  })
  .search('Search auth configs…')
  .paginated(({ props, ctx, filters, search }) =>
    useProviderAuthConfigs(
      props.instanceId ?? ctx.instanceId,
      withDefaults(props.filters, {
        ownership: 'all' as const,
        order: 'desc' as const,
        ...filters,
        search: search ?? props.filters?.search
      })
    )
  )
  .enrich(withProviderNames(row => row.providerId))
  .columns([
    col.name(),
    col.text({
      id: 'provider',
      header: 'Provider',
      get: row => row.providerName ?? row.providerId
    }),
    col.text({ id: 'deployment', header: 'Deployment', get: row => row.deployment?.name }),
    col.text({
      id: 'authMethod',
      header: 'Auth Method',
      get: row => row.authMethod?.name ?? row.authMethod?.key
    }),
    col.createdAt(),
    col.id({ isDefault: true }),
    col.text({
      id: 'type',
      header: 'Type',
      isDefault: false,
      get: row => formatType(row.type)
    }),
    col.text({
      id: 'source',
      header: 'Source',
      isDefault: false,
      get: row => formatSource(row.source)
    }),
    col.status(lifecycleStatus, { isDefault: false }),
    col.custom({
      id: 'default',
      header: 'Default',
      isDefault: false,
      render: row =>
        row.isDefault ? (
          <Badge color="blue">Default</Badge>
        ) : (
          <Text size="2" color="gray600">
            No
          </Text>
        )
    }),
    col.refId('credentials', row => row.credentials?.id, { header: 'Credentials' }),
    col.updatedAt()
  ])
  .link((row, _props, ctx) =>
    Paths.instance.providerAuthConfig(ctx.organization, ctx.project, ctx.instance, row.id)
  )
  .itemActions([
    deleteAction({
      noun: 'Auth Config',
      name: row => row.name,
      disabled: row => row.status !== 'active',
      useMutate: () => useDeleteProviderAuthConfig(),
      input: (row, { props, ctx }) => ({
        instanceId: props.instanceId ?? ctx.instanceId,
        providerAuthConfigId: row.id
      })
    })
  ])
  .build();
