import {
  DashboardInstanceProviderDeploymentsConfigVaultsListOutput,
  DashboardInstanceProviderDeploymentsConfigVaultsListQuery
} from '@metorial/dashboard-sdk';
import {
  col,
  createDataList,
  deleteAction,
  f,
  lifecycleStatus,
  withDefaults
} from '@metorial/data-list';
import { useDeleteProviderConfigVault, useProviderConfigVaults } from '@metorial/state';
import { useInstanceContext, withProviderNames } from '../../lib/dataList';
import { entityFilters } from '../entityFilters';

type ProviderConfigVault =
  DashboardInstanceProviderDeploymentsConfigVaultsListOutput['items'][number];

export type ProviderConfigVaultFilters = Omit<
  DashboardInstanceProviderDeploymentsConfigVaultsListQuery,
  'limit' | 'after' | 'before' | 'cursor'
>;

export let ProviderConfigVaultsOverviewTable = createDataList<{
  instanceId?: string;
  filters?: ProviderConfigVaultFilters;
}>('provider-config-vaults-overview')
  .context(useInstanceContext)
  .filters((props, ctx) => {
    let instanceId = props.instanceId ?? ctx.instanceId;

    return {
      status: f.status(lifecycleStatus, { only: ['active', 'archived'] }),
      providerId: f.entity(entityFilters.provider(instanceId)),
      providerDeploymentId: f.entity(entityFilters.providerDeployment(instanceId)),
      providerConfigId: f.entity(entityFilters.providerConfig(instanceId)),
      createdAt: f.createdAt(),
      updatedAt: f.updatedAt()
    };
  })
  .search('Search config vaults…')
  .paginated(({ props, ctx, filters, search }) =>
    useProviderConfigVaults(
      props.instanceId ?? ctx.instanceId,
      withDefaults(props.filters, {
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
    col.status(lifecycleStatus),
    col.createdAt(),
    col.id({ isDefault: true }),
    col.updatedAt(),
    col.refId('providerId', row => row.providerId, { header: 'Provider ID' }),
    col.refId('deploymentId', row => row.deployment?.id, { header: 'Deployment ID' })
  ])
  .itemActions([
    deleteAction<ProviderConfigVault>({
      noun: 'Config Vault',
      name: row => row.name,
      disabled: row => row.status !== 'active',
      useMutate: () => useDeleteProviderConfigVault(),
      input: (row, { props, ctx }) => ({
        instanceId: props.instanceId ?? ctx.instanceId,
        providerConfigVaultId: row.id
      })
    })
  ])
  .build();
