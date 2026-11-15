import {
  DashboardInstanceProviderDeploymentsConfigsListOutput,
  DashboardInstanceProviderDeploymentsConfigsListQuery
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
import { useDeleteProviderConfig, useProviderConfigs } from '@metorial/state';
import { Badge, Text } from '@metorial/ui';
import { useInstanceContext, withProviderNames } from '../../lib/dataList';
import { entityFilters } from '../entityFilters';

type ProviderConfig = DashboardInstanceProviderDeploymentsConfigsListOutput['items'][number];

export type ProviderConfigFilters = Omit<
  DashboardInstanceProviderDeploymentsConfigsListQuery,
  'limit' | 'after' | 'before' | 'cursor'
>;

let getProviderId = (config: ProviderConfig) =>
  config.deployment?.providerId ??
  config.fromVault?.deployment?.providerId ??
  config.providerId;

let getDeploymentName = (config: ProviderConfig) =>
  config.deployment?.name ?? config.fromVault?.deployment?.name;

export let ProviderConfigsOverviewTable = createDataList<{
  instanceId?: string;
  filters?: ProviderConfigFilters;
}>('provider-configs-overview')
  .context(useInstanceContext)
  .filters((props, ctx) => {
    let instanceId = props.instanceId ?? ctx.instanceId;

    return {
      status: f.status(lifecycleStatus, { only: ['active', 'archived'] }),
      providerId: f.entity(entityFilters.provider(instanceId)),
      providerSpecificationId: f.entity(entityFilters.providerSpecification(instanceId)),
      providerDeploymentId: f.entity(entityFilters.providerDeployment(instanceId)),
      providerConfigVaultId: f.entity(entityFilters.providerConfigVault(instanceId)),
      createdAt: f.createdAt(),
      updatedAt: f.updatedAt()
    };
  })
  .search('Search configs…')
  .paginated(({ props, ctx, filters, search }) =>
    useProviderConfigs(
      props.instanceId ?? ctx.instanceId,
      withDefaults(props.filters, {
        ownership: 'all' as const,
        order: 'desc' as const,
        ...filters,
        search: search ?? props.filters?.search
      })
    )
  )
  .enrich(withProviderNames(getProviderId))
  .columns([
    col.name({ header: 'Config Name', description: false }),
    col.text({
      id: 'provider',
      header: 'Provider',
      get: row => row.providerName ?? row.providerId
    }),
    col.text({
      id: 'deployment',
      header: 'Deployment',
      get: getDeploymentName,
      fallback: 'Provider-level'
    }),
    col.createdAt(),
    col.id({ isDefault: true }),
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
    col.refId('vault', row => row.fromVault?.id, { header: 'Vault' }),
    col.refId('specificationId', row => row.specificationId, { header: 'Specification ID' }),
    col.updatedAt()
  ])
  .link((row, _props, ctx) =>
    Paths.instance.providerConfig(ctx.organization, ctx.project, ctx.instance, row.id)
  )
  .itemActions([
    deleteAction({
      noun: 'Config',
      name: row => row.name,
      disabled: row => row.status !== 'active',
      useMutate: () => useDeleteProviderConfig(),
      input: (row, { props, ctx }) => ({
        instanceId: props.instanceId ?? ctx.instanceId,
        providerConfigId: row.id
      })
    })
  ])
  .build();
