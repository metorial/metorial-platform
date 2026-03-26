import {
  DashboardInstanceProviderDeploymentsConfigsListOutput,
  DashboardInstanceProviderDeploymentsConfigsListQuery
} from '@metorial/dashboard-sdk';
import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useInstanceProviderConfigs,
  useProviders
} from '@metorial/state';
import { Badge, RenderDate, Text } from '@metorial/ui';
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
import { showCreateProviderConfigFlow } from './providerCreationFlows';

type ProviderConfig = DashboardInstanceProviderDeploymentsConfigsListOutput['items'][number];

type ProviderConfigRow = ProviderConfig & {
  providerName?: string | null;
  providerDeploymentId?: string;
  providerDeploymentName?: string | null;
};

type ProviderConfigFilters = Omit<
  DashboardInstanceProviderDeploymentsConfigsListQuery,
  'limit' | 'after' | 'before' | 'cursor'
>;

type ProviderConfigsOverviewTableProps = {
  instanceId: string;
  organization: ReturnType<typeof useCurrentOrganization>;
  project: ReturnType<typeof useCurrentProject>;
  instance: ReturnType<typeof useCurrentInstance>;
  filters?: ProviderConfigFilters;
};

let providerConfigsOverviewTableState: TableStateProvider<
  ProviderConfigsOverviewTableProps,
  ProviderConfigRow,
  TableStateProviderResult<ProviderConfigRow>
> = (
  props: ProviderConfigsOverviewTableProps,
  opts: {
    filter: Record<string, FilterPayload>;
    search?: string;
  }
) => {
  let configs = useInstanceProviderConfigs(props.instanceId, {
    order: 'desc',
    ...props.filters,
    id: getStringFilterValue(opts.filter.id) ?? props.filters?.id,
    providerId: getStringFilterValue(opts.filter.providerId) ?? props.filters?.providerId,
    providerSpecificationId:
      getStringFilterValue(opts.filter.providerSpecificationId) ??
      props.filters?.providerSpecificationId,
    providerDeploymentId:
      getStringFilterValue(opts.filter.providerDeploymentId) ??
      props.filters?.providerDeploymentId,
    providerConfigVaultId:
      getStringFilterValue(opts.filter.providerConfigVaultId) ??
      props.filters?.providerConfigVaultId,
    search: opts.search ?? props.filters?.search,
    createdAt: getDateRangeFilterValue(opts.filter.createdAt) ?? props.filters?.createdAt,
    updatedAt: getDateRangeFilterValue(opts.filter.updatedAt) ?? props.filters?.updatedAt
  });

  let providerIds = [
    ...new Set(
      (configs.data?.items ?? [])
        .map(item => item.deployment?.providerId ?? item.fromVault?.deployment?.providerId ?? item.providerId)
        .filter(Boolean)
    )
  ];
  let providers = useProviders(props.instanceId, providerIds.length > 0 ? { id: providerIds } : null);

  let providerNameMap = new Map<string, string>();
  for (let provider of providers.data?.items ?? []) {
    if (provider.id && provider.name) providerNameMap.set(provider.id, provider.name);
  }

  return {
    isLoading: configs.isLoading || providers.isLoading,
    error: configs.error ?? providers.error,
    hasMoreAfter: configs.data?.pagination.hasMoreAfter ?? false,
    hasMoreBefore: configs.data?.pagination.hasMoreBefore ?? false,
    items: (configs.data?.items ?? []).map(config => ({
      ...config,
      providerName:
        providerNameMap.get(
          config.deployment?.providerId ?? config.fromVault?.deployment?.providerId ?? config.providerId
        ) ?? null,
      providerDeploymentId: config.deployment?.id ?? config.fromVault?.deployment?.id,
      providerDeploymentName: config.deployment?.name ?? config.fromVault?.deployment?.name
    })),
    loadNext: configs.next,
    loadPrevious: configs.previous
  };
};

let providerConfigsOverviewTable = new DashboardTable<
  ProviderConfigsOverviewTableProps,
  ProviderConfigRow
>('provider-configs-overview')
  .state(providerConfigsOverviewTableState)
  .columns([
    {
      id: 'name',
      isDefault: true,
      header: 'Config Name',
      render: row => <Text size="2" weight="strong">{row.name ?? 'Unnamed'}</Text>
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
      render: row => <Text size="2">{row.providerName ?? row.providerId}</Text>
    },
    {
      id: 'deployment',
      isDefault: true,
      header: 'Deployment',
      render: row =>
        row.providerDeploymentName ? (
          <Text size="2">{row.providerDeploymentName}</Text>
        ) : (
          <Text size="2" color="gray600">
            Provider-level
          </Text>
        )
    },
    {
      id: 'createdAt',
      isDefault: true,
      header: 'Created',
      render: row => <RenderDate date={row.createdAt} />
    },
    {
      id: 'default',
      isDefault: false,
      header: 'Default',
      render: row =>
        row.isDefault ? (
          <Badge color="blue">Default</Badge>
        ) : (
          <Text size="2" color="gray600">
            No
          </Text>
        )
    },
    {
      id: 'vault',
      isDefault: false,
      header: 'Vault',
      render: row =>
        row.fromVault?.id ? (
          <ID id={row.fromVault.id} />
        ) : (
          <Text size="2" color="gray600">
            -
          </Text>
        )
    },
    {
      id: 'specificationId',
      isDefault: false,
      header: 'Specification ID',
      render: row => <ID id={row.specificationId} />
    },
    {
      id: 'updatedAt',
      isDefault: false,
      header: 'Updated',
      render: row => <RenderDate date={row.updatedAt} />
    }
  ])
  .filters([
    {
      id: 'id',
      fields: ['id'],
      label: 'Config ID',
      description: 'Filter by config ID',
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
      id: 'providerSpecificationId',
      fields: ['providerSpecificationId'],
      label: 'Specification ID',
      description: 'Filter by specification ID',
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
      id: 'providerConfigVaultId',
      fields: ['providerConfigVaultId'],
      label: 'Vault ID',
      description: 'Filter by vault ID',
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
  .search('Search configs...')
  .link((row, props) =>
    row.providerDeploymentId
      ? Paths.instance.providerConfig(
          props.organization.data,
          props.project.data,
          props.instance.data,
          row.providerDeploymentId,
          row.id
        )
      : ''
  )
  .build();

export let ProviderConfigsOverviewPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  return renderWithLoader({ organization, project, instance })(() =>
    providerConfigsOverviewTable({
      instanceId: instance.data!.id,
      organization,
      project,
      instance,
      emptyState: () => (
        <EmptyState
          title="Create your first config"
          description="Configs let you save reusable provider settings for this instance."
          action={{
            label: 'Create Config',
            onClick: () => {
              if (instance.data?.id) {
                showCreateProviderConfigFlow(instance.data.id);
              }
            }
          }}
        />
      )
    })
  );
};
