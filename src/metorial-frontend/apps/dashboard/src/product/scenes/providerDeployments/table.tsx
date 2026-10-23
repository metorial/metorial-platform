import {
  DashboardInstanceProviderDeploymentsListOutput,
  DashboardInstanceProviderDeploymentsListQuery
} from '@metorial/dashboard-sdk';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useDeleteProviderDeployment,
  useProviderDeployments,
  useProviders
} from '@metorial/state';
import {
  Table as DashboardTable,
  FilterPayload,
  TableFilter,
  TableStateProvider,
  TableStateProviderResult,
  getDateRangeFilterValue,
  getEnumListFilterValue,
  getListFilterValue
} from '@metorial/table';
import { Badge, RenderDate, Text, confirm } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { RiDeleteBinLine } from '@remixicon/react';
import { useMemo, useState } from 'react';
import { entityFilters } from '../entityFilters';

type ProviderDeployment = DashboardInstanceProviderDeploymentsListOutput['items'][number];

type ProviderDeploymentRow = ProviderDeployment & {
  providerName?: string | null;
};

type ProviderDeploymentFilters = Omit<
  DashboardInstanceProviderDeploymentsListQuery,
  'limit' | 'after' | 'before' | 'cursor'
>;

type ProviderDeploymentsTableProps = {
  instanceId: string;
  providerId?: string;
  providerName?: string;
  filters?: ProviderDeploymentFilters;
  organization: ReturnType<typeof useCurrentOrganization>;
  project: ReturnType<typeof useCurrentProject>;
  instance: ReturnType<typeof useCurrentInstance>;
};

let getProviderDeploymentStatusFilterValue = (
  value: FilterPayload | undefined
): DashboardInstanceProviderDeploymentsListQuery['status'] => {
  return getEnumListFilterValue(value, ['active', 'archived']);
};

export let useProviderDeploymentFilters = (
  instanceId: string | null | undefined,
  providerId?: string
) =>
  useMemo<TableFilter<ProviderDeploymentRow>[]>(
    () => [
      {
        id: 'status',
        fields: ['status'],
        label: 'Status',
        description: 'Filter by status',
        type: 'select',
        options: [
          { id: 'active', label: 'Active' },
          { id: 'archived', label: 'Archived' }
        ]
      },
      entityFilters.provider(instanceId),
      entityFilters.providerVersion(instanceId, { providerId }),
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
    ],
    [instanceId, providerId]
  );

let getProviderDeploymentStatusColor = (status: ProviderDeployment['status']) => {
  if (status === 'active') return 'green';
  if (status === 'archived') return 'orange';
  return 'gray';
};

let useProviderDeploymentsTableState: TableStateProvider<
  ProviderDeploymentsTableProps,
  ProviderDeploymentRow,
  TableStateProviderResult<ProviderDeploymentRow>
> = (
  props: ProviderDeploymentsTableProps,
  opts: {
    filter: Record<string, FilterPayload>;
    search?: string;
  }
) => {
  let deployments = useProviderDeployments(props.instanceId, {
    order: 'desc',
    providerId:
      getListFilterValue(opts.filter.providerId) ??
      props.providerId ??
      props.filters?.providerId,
    providerVersionId:
      getListFilterValue(opts.filter.providerVersionId) ?? props.filters?.providerVersionId,
    status:
      getProviderDeploymentStatusFilterValue(opts.filter.status) ?? props.filters?.status,
    id: props.filters?.id,
    search: opts.search ?? props.filters?.search,
    createdAt: getDateRangeFilterValue(opts.filter.createdAt) ?? props.filters?.createdAt,
    updatedAt: getDateRangeFilterValue(opts.filter.updatedAt) ?? props.filters?.updatedAt
  });

  let providerIds = [...new Set((deployments.data?.items ?? []).map(item => item.providerId))];
  let shouldLoadProviders =
    providerIds.length > 0 &&
    !(
      props.providerId &&
      props.providerName &&
      providerIds.length === 1 &&
      providerIds[0] === props.providerId
    );

  let providers = useProviders(
    props.instanceId,
    shouldLoadProviders ? { id: providerIds } : null
  );

  let providerNameMap = new Map<string, string>();
  if (props.providerId && props.providerName) {
    providerNameMap.set(props.providerId, props.providerName);
  }

  for (let provider of providers.data?.items ?? []) {
    if (provider.id && provider.name) {
      providerNameMap.set(provider.id, provider.name);
    }
  }

  return {
    isLoading: deployments.isLoading || (shouldLoadProviders && providers.isLoading),
    error: deployments.error ?? (shouldLoadProviders ? providers.error : null),
    hasMoreAfter: deployments.data?.pagination.hasMoreAfter ?? false,
    hasMoreBefore: deployments.data?.pagination.hasMoreBefore ?? false,
    items: (deployments.data?.items ?? []).map(item => ({
      ...item,
      providerName: providerNameMap.get(item.providerId) ?? null
    })),
    loadNext: deployments.next,
    loadPrevious: deployments.previous
  };
};

let useProviderDeploymentsTableHookState = (
  _: ReturnType<typeof useProviderDeploymentsTableState>,
  props: ProviderDeploymentsTableProps
) => {
  let deleteDeployment = useDeleteProviderDeployment();
  let [loadingIds, setLoadingIds] = useState<string[]>([]);

  return {
    deleteDeployment,
    instanceId: props.instanceId,
    loadingIds,
    setLoadingIds
  };
};

let deleteProviderDeploymentImmediately = async (
  deployment: ProviderDeploymentRow,
  state: ReturnType<typeof useProviderDeploymentsTableHookState>
) => {
  state.setLoadingIds((current: string[]) => [...new Set([...current, deployment.id])]);

  try {
    await state.deleteDeployment.mutate({
      instanceId: state.instanceId,
      providerDeploymentId: deployment.id
    });
  } finally {
    state.setLoadingIds((current: string[]) => current.filter(id => id != deployment.id));
  }
};

let providerDeploymentsTable = new DashboardTable<
  ProviderDeploymentsTableProps,
  ProviderDeploymentRow
>('provider-deployments')
  .state(useProviderDeploymentsTableState)
  .hookState(useProviderDeploymentsTableHookState)
  .columns([
    {
      id: 'name',
      isDefault: true,
      header: 'Name',
      render: deployment => (
        <div>
          <Text size="2" weight="strong">
            {deployment.name ?? 'Unnamed'}
          </Text>
          {deployment.description && (
            <Text size="1" color="gray600">
              {deployment.description}
            </Text>
          )}
        </div>
      )
    },
    {
      id: 'provider',
      isDefault: true,
      header: 'Provider',
      render: deployment => (
        <Text size="2">{deployment.providerName ?? deployment.providerId}</Text>
      )
    },
    {
      id: 'version',
      isDefault: false,
      header: 'Version',
      render: deployment =>
        deployment.lockedVersion ? (
          <Badge color="purple">{deployment.lockedVersion.version}</Badge>
        ) : (
          <Badge color="gray">Default</Badge>
        )
    },
    {
      id: 'createdAt',
      isDefault: false,
      header: 'Created',
      render: deployment => <RenderDate date={deployment.createdAt} />
    },
    {
      id: 'status',
      isDefault: false,
      header: 'Status',
      render: deployment => (
        <Badge color={getProviderDeploymentStatusColor(deployment.status)}>
          {deployment.status}
        </Badge>
      )
    },
    {
      id: 'default',
      isDefault: false,
      header: 'Default',
      render: deployment =>
        deployment.isDefault ? (
          <Badge color="blue">Default</Badge>
        ) : (
          <Text size="2" color="gray600">
            No
          </Text>
        )
    },
    {
      id: 'updatedAt',
      isDefault: false,
      header: 'Updated',
      render: deployment => <RenderDate date={deployment.updatedAt} />
    },
    {
      id: 'providerId',
      isDefault: false,
      header: 'Provider ID',
      render: deployment => <ID id={deployment.providerId} />
    },
    {
      id: 'providerVersionId',
      isDefault: false,
      header: 'Locked Version ID',
      render: deployment =>
        deployment.lockedVersion?.id ? (
          <ID id={deployment.lockedVersion.id} />
        ) : (
          <Text size="2" color="gray600">
            -
          </Text>
        )
    },
    {
      id: 'defaultConfig',
      isDefault: false,
      header: 'Default Config',
      render: deployment =>
        deployment.defaultConfig?.id ? (
          <ID id={deployment.defaultConfig.id} />
        ) : (
          <Text size="2" color="gray600">
            -
          </Text>
        )
    },
    {
      id: 'id',
      isDefault: true,
      header: 'Deployment ID',
      render: deployment => <ID id={deployment.id} />
    }
  ])
  .search('Search deployments...')
  .link((deployment, props) =>
    Paths.instance.providerDeployment(
      props.organization.data,
      props.project.data,
      props.instance.data,
      deployment.id
    )
  )
  .actions({
    deleteImmediate: async (deployments, state) => {
      let deployment = deployments[0];
      if (!deployment) return;

      await deleteProviderDeploymentImmediately(deployment, state);
    },
    delete: async (deployments, state) => {
      let deployment = deployments[0];
      if (!deployment) return;

      confirm({
        title: 'Delete deployment',
        description: `Are you sure you want to delete ${deployment.name ?? 'this deployment'}?`,
        confirmText: 'Delete',
        onConfirm: async () => {
          await deleteProviderDeploymentImmediately(deployment, state);
        }
      });
    }
  })
  .rowActions([
    {
      id: 'delete',
      label: 'Delete',
      icon: <RiDeleteBinLine />,
      disabled: deployment => deployment.status !== 'active',
      action: 'delete'
    }
  ])
  .bulkActions([
    {
      id: 'delete-selected',
      label: 'Delete',
      icon: <RiDeleteBinLine />,
      disabled: deployment => deployment.status !== 'active',
      action: 'deleteImmediate',
      bulkExecution: {
        mode: 'per-row',
        batchSize: 10
      }
    }
  ])
  .build();

export let ProviderDeploymentsTable = ({
  instanceId,
  providerId,
  providerName,
  status,
  search
}: {
  instanceId: string;
  providerId?: string;
  providerName?: string;
  status?: string;
  search?: string;
}) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let tableFilters = useProviderDeploymentFilters(instanceId, providerId);

  return providerDeploymentsTable({
    instanceId,
    providerId,
    providerName,
    filters: { status: status as any, search },
    tableFilters,
    instance,
    organization,
    project,
    emptyState: 'No deployments found.'
  });
};
