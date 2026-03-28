import {
  DashboardInstanceProviderDeploymentsConfigVaultsListOutput,
  DashboardInstanceProviderDeploymentsConfigVaultsListQuery
} from '@metorial/dashboard-sdk';
import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderConfigVaults,
  useProviders
} from '@metorial/state';
import { RenderDate, Text } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { EmptyState } from '../../../../../components/emptyState';
import { Table as DashboardTable } from '../../../../../components/table';
import { FilterPayload } from '../../../../../components/table/filter';
import {
  TableStateProvider,
  TableStateProviderResult
} from '../../../../../components/table/type';
import {
  getDateRangeFilterValue,
  getStringFilterValue
} from '../../../../../lib/dataTableUtils';
import { showCreateProviderConfigVaultFlow } from './providerCreationFlows';

type ProviderConfigVault =
  DashboardInstanceProviderDeploymentsConfigVaultsListOutput['items'][number];

type ProviderConfigVaultRow = ProviderConfigVault & {
  providerName?: string | null;
};

type ProviderConfigVaultFilters = Omit<
  DashboardInstanceProviderDeploymentsConfigVaultsListQuery,
  'limit' | 'after' | 'before' | 'cursor'
>;

type ProviderConfigVaultsOverviewTableProps = {
  instanceId: string;
  organization: ReturnType<typeof useCurrentOrganization>;
  project: ReturnType<typeof useCurrentProject>;
  instance: ReturnType<typeof useCurrentInstance>;
  filters?: ProviderConfigVaultFilters;
};

let providerConfigVaultsOverviewState: TableStateProvider<
  ProviderConfigVaultsOverviewTableProps,
  ProviderConfigVaultRow,
  TableStateProviderResult<ProviderConfigVaultRow>
> = (
  props: ProviderConfigVaultsOverviewTableProps,
  opts: {
    filter: Record<string, FilterPayload>;
    search?: string;
  }
) => {
  let vaults = useProviderConfigVaults(props.instanceId, {
    order: 'desc',
    ...props.filters,
    id: getStringFilterValue(opts.filter.id) ?? props.filters?.id,
    providerId: getStringFilterValue(opts.filter.providerId) ?? props.filters?.providerId,
    providerDeploymentId:
      getStringFilterValue(opts.filter.providerDeploymentId) ??
      props.filters?.providerDeploymentId,
    providerConfigId:
      getStringFilterValue(opts.filter.providerConfigId) ?? props.filters?.providerConfigId,
    providerConfigVaultId:
      getStringFilterValue(opts.filter.providerConfigVaultId) ??
      props.filters?.providerConfigVaultId,
    search: opts.search ?? props.filters?.search,
    createdAt: getDateRangeFilterValue(opts.filter.createdAt) ?? props.filters?.createdAt,
    updatedAt: getDateRangeFilterValue(opts.filter.updatedAt) ?? props.filters?.updatedAt
  });

  let providerIds = [
    ...new Set((vaults.data?.items ?? []).map(item => item.providerId).filter(Boolean))
  ];
  let shouldLoadProviders = providerIds.length > 0;
  let providers = useProviders(
    props.instanceId,
    shouldLoadProviders ? { id: providerIds } : null
  );

  let providerNameMap = new Map<string, string>();
  for (let provider of providers.data?.items ?? []) {
    if (provider.id && provider.name) providerNameMap.set(provider.id, provider.name);
  }

  return {
    isLoading: vaults.isLoading || (shouldLoadProviders && providers.isLoading),
    error: vaults.error ?? (shouldLoadProviders ? providers.error : null),
    hasMoreAfter: vaults.data?.pagination.hasMoreAfter ?? false,
    hasMoreBefore: vaults.data?.pagination.hasMoreBefore ?? false,
    items: (vaults.data?.items ?? []).map(item => ({
      ...item,
      providerName: providerNameMap.get(item.providerId) ?? null
    })),
    loadNext: vaults.next,
    loadPrevious: vaults.previous
  };
};

let providerConfigVaultsOverviewTable = new DashboardTable<
  ProviderConfigVaultsOverviewTableProps,
  ProviderConfigVaultRow
>('provider-config-vaults-overview')
  .state(providerConfigVaultsOverviewState)
  .columns([
    {
      id: 'name',
      isDefault: true,
      header: 'Name',
      render: row => (
        <div>
          <Text size="2" weight="strong">
            {row.name}
          </Text>
          {row.description && (
            <Text size="1" color="gray600">
              {row.description}
            </Text>
          )}
        </div>
      )
    },
    {
      id: 'id',
      isDefault: true,
      header: 'ID',
      render: row => <ID id={row.id} />
    },
    {
      id: 'provider',
      isDefault: true,
      header: 'Provider',
      render: row => <Text size="2">{row.providerName ?? row.providerId ?? '\u2014'}</Text>
    },
    {
      id: 'deployment',
      isDefault: true,
      header: 'Deployment',
      render: row => <Text size="2">{row.deployment?.name ?? '\u2014'}</Text>
    },
    {
      id: 'createdAt',
      isDefault: true,
      header: 'Created',
      render: row => <RenderDate date={row.createdAt} />
    },
    {
      id: 'updatedAt',
      isDefault: false,
      header: 'Updated',
      render: row => <RenderDate date={row.updatedAt} />
    },
    {
      id: 'providerId',
      isDefault: false,
      header: 'Provider ID',
      render: row => <ID id={row.providerId} />
    },
    {
      id: 'deploymentId',
      isDefault: false,
      header: 'Deployment ID',
      render: row =>
        row.deployment?.id ? (
          <ID id={row.deployment.id} />
        ) : (
          <Text size="2" color="gray600">
            -
          </Text>
        )
    }
  ])
  .filters([
    {
      id: 'id',
      fields: ['id'],
      label: 'Vault ID',
      description: 'Filter by vault ID',
      type: 'string'
    },
    {
      id: 'providerId',
      fields: ['providerId'],
      label: 'Provider ID',
      description: 'Filter by provider ID',
      type: 'string'
    },
    {
      id: 'providerDeploymentId',
      fields: ['providerDeploymentId'],
      label: 'Deployment ID',
      description: 'Filter by deployment ID',
      type: 'string'
    },
    {
      id: 'providerConfigId',
      fields: ['providerConfigId'],
      label: 'Config ID',
      description: 'Filter by config ID',
      type: 'string'
    },
    {
      id: 'providerConfigVaultId',
      fields: ['providerConfigVaultId'],
      label: 'Vault Ref ID',
      description: 'Filter by vault ref ID',
      type: 'string'
    },
    {
      id: 'createdAt',
      fields: ['createdAt'],
      label: 'Created',
      description: 'Filter by created date',
      type: 'date'
    },
    {
      id: 'updatedAt',
      fields: ['updatedAt'],
      label: 'Updated',
      description: 'Filter by updated date',
      type: 'date'
    }
  ])
  .search('Search config vaults...')
  .link((row, props) =>
    Paths.instance.providerConfigVault(
      props.organization.data,
      props.project.data,
      props.instance.data,
      row.id
    )
  )
  .build();

export let ProviderConfigVaultsOverviewPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  return renderWithLoader({ organization, project, instance })(() =>
    providerConfigVaultsOverviewTable({
      instanceId: instance.data!.id,
      organization,
      project,
      instance,
      emptyState: () => (
        <EmptyState
          title="Create your first config vault"
          description="Vaults store reusable secret or shared provider values for this instance."
          action={{
            label: 'Create Config Vault',
            onClick: () => {
              if (instance.data?.id) {
                showCreateProviderConfigVaultFlow(instance.data.id);
              }
            }
          }}
        />
      )
    })
  );
};
