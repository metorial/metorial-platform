import {
  DashboardInstanceIdentitiesDelegationConfigsListOutput,
  DashboardInstanceIdentitiesDelegationConfigsListQuery
} from '@metorial/dashboard-sdk';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useDeleteIdentityDelegationConfig,
  useIdentityDelegationConfigs
} from '@metorial/state';
import { Badge, RenderDate, Text, confirm } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { RiDeleteBinLine } from '@remixicon/react';
import { useState } from 'react';
import { Table as DashboardTable } from '../../../../components/table';
import { FilterPayload } from '../../../../components/table/filter';
import {
  getEnumListFilterValue,
  getStringFilterValue
} from '../../../../lib/dataTableUtils';

type IdentityDelegationConfig =
  DashboardInstanceIdentitiesDelegationConfigsListOutput['items'][number];

type IdentityDelegationConfigFilters = Omit<
  DashboardInstanceIdentitiesDelegationConfigsListQuery,
  'limit' | 'after' | 'before' | 'cursor'
>;

type IdentityDelegationConfigsTableProps = {
  instanceId: string;
  filters?: IdentityDelegationConfigFilters;
  organization: ReturnType<typeof useCurrentOrganization>;
  project: ReturnType<typeof useCurrentProject>;
  instance: ReturnType<typeof useCurrentInstance>;
};

let getDelegationConfigStatusColor = (status: IdentityDelegationConfig['status']) => {
  if (status === 'active') return 'green';
  if (status === 'archived') return 'orange';
  return 'gray';
};

let getDelegationBehaviorLabel = (
  behavior: IdentityDelegationConfig['subDelegationBehavior']
) => {
  if (behavior === 'require_consent') return 'Require Consent';
  if (behavior === 'allow') return 'Allow';
  return 'Deny';
};

let getStatusFilterValue = (
  value: FilterPayload | undefined
): DashboardInstanceIdentitiesDelegationConfigsListQuery['status'] => {
  return getEnumListFilterValue(value, ['active', 'archived', 'deleted']);
};

let useIdentityDelegationConfigsTableState = (
  props: IdentityDelegationConfigsTableProps,
  opts: {
    filter: Record<string, FilterPayload>;
    search?: string;
  }
) => {
  let configs = useIdentityDelegationConfigs(props.instanceId, {
    order: 'desc',
    ...props.filters,
    status: getStatusFilterValue(opts.filter.status) ?? props.filters?.status,
    id: getStringFilterValue(opts.filter.id) ?? props.filters?.id,
    search: opts.search ?? props.filters?.search
  });

  return {
    isLoading: configs.isLoading,
    error: configs.error,
    hasMoreAfter: configs.data?.pagination.hasMoreAfter ?? false,
    hasMoreBefore: configs.data?.pagination.hasMoreBefore ?? false,
    items: configs.data?.items ?? [],
    loadNext: configs.next,
    loadPrevious: configs.previous
  };
};

let useIdentityDelegationConfigsTableHookState = (
  _: ReturnType<typeof useIdentityDelegationConfigsTableState>,
  props: IdentityDelegationConfigsTableProps
) => {
  let deleteConfig = useDeleteIdentityDelegationConfig();
  let [loadingIds, setLoadingIds] = useState<string[]>([]);

  return {
    deleteConfig,
    instanceId: props.instanceId,
    loadingIds,
    setLoadingIds
  };
};

let deleteIdentityDelegationConfigImmediately = async (
  config: IdentityDelegationConfig,
  state: ReturnType<typeof useIdentityDelegationConfigsTableHookState>
) => {
  state.setLoadingIds((current: string[]) => [...new Set([...current, config.id])]);

  try {
    await state.deleteConfig.mutate({
      instanceId: state.instanceId,
      identityDelegationConfigId: config.id
    });
  } finally {
    state.setLoadingIds((current: string[]) => current.filter(id => id != config.id));
  }
};

let identityDelegationConfigsTable = new DashboardTable<
  IdentityDelegationConfigsTableProps,
  IdentityDelegationConfig
>('identity-delegation-configs')
  .state(useIdentityDelegationConfigsTableState)
  .hookState(useIdentityDelegationConfigsTableHookState)
  .columns([
    {
      id: 'name',
      isDefault: true,
      header: 'Name',
      render: (config: IdentityDelegationConfig) => (
        <div>
          <Text size="2" weight="strong">
            {config.name ?? 'Unnamed'}
          </Text>
          {config.description && (
            <Text size="1" color="gray600">
              {config.description}
            </Text>
          )}
        </div>
      )
    },
    {
      id: 'behavior',
      isDefault: true,
      header: 'Behavior',
      render: (config: IdentityDelegationConfig) => (
        <Text size="2">{getDelegationBehaviorLabel(config.subDelegationBehavior)}</Text>
      )
    },
    {
      id: 'default',
      isDefault: true,
      header: 'Default',
      render: (config: IdentityDelegationConfig) =>
        config.isDefault ? <Badge color="blue">Default</Badge> : <Text size="2">-</Text>
    },
    {
      id: 'status',
      isDefault: false,
      header: 'Status',
      render: (config: IdentityDelegationConfig) => (
        <Badge color={getDelegationConfigStatusColor(config.status)}>{config.status}</Badge>
      )
    },
    {
      id: 'depth',
      isDefault: false,
      header: 'Depth',
      render: (config: IdentityDelegationConfig) => (
        <Text size="2">{config.subDelegationDepth}</Text>
      )
    },
    {
      id: 'createdAt',
      isDefault: true,
      header: 'Created',
      render: (config: IdentityDelegationConfig) => <RenderDate date={config.createdAt} />
    },
    {
      id: 'updatedAt',
      isDefault: false,
      header: 'Updated',
      render: (config: IdentityDelegationConfig) => <RenderDate date={config.updatedAt} />
    },
    {
      id: 'id',
      isDefault: false,
      header: 'Config ID',
      render: (config: IdentityDelegationConfig) => <ID id={config.id} />
    }
  ] as any)
  .filters([
    {
      id: 'status',
      fields: ['status'],
      label: 'Status',
      description: 'Filter by status',
      type: 'select',
      options: [
        { id: 'active', label: 'Active' },
        { id: 'archived', label: 'Archived' },
        { id: 'deleted', label: 'Deleted' }
      ]
    },
    {
      id: 'id',
      fields: ['id'],
      label: 'Config ID',
      description: 'Filter by config ID',
      type: 'string'
    }
  ])
  .search('Search delegation configs...')
  .actions({
    deleteImmediate: async (configs, state) => {
      let config = configs[0];
      if (!config) return;

      await deleteIdentityDelegationConfigImmediately(config, state);
    },
    delete: async (configs, state) => {
      let config = configs[0];
      if (!config) return;

      confirm({
        title: 'Delete delegation config',
        description: `Are you sure you want to delete ${config.name ?? 'this delegation config'}?`,
        confirmText: 'Delete',
        onConfirm: async () => {
          await deleteIdentityDelegationConfigImmediately(config, state);
        }
      });
    }
  })
  .rowActions([
    {
      id: 'delete',
      label: 'Delete',
      icon: <RiDeleteBinLine />,
      disabled: config => config.status !== 'active',
      action: 'delete'
    }
  ])
  .bulkActions([
    {
      id: 'delete-selected',
      label: 'Delete',
      icon: <RiDeleteBinLine />,
      disabled: config => config.status !== 'active',
      action: 'deleteImmediate',
      bulkExecution: {
        mode: 'per-row',
        batchSize: 10
      }
    }
  ])
  .link(((config: IdentityDelegationConfig, props: IdentityDelegationConfigsTableProps) =>
    Paths.instance.identity.delegationConfig(
      props.organization.data,
      props.project.data,
      props.instance.data,
      config.id
    )) as any)
  .build();

export let IdentityDelegationConfigsTable = ({
  instanceId,
  filters
}: {
  instanceId: string;
  filters?: IdentityDelegationConfigFilters;
}) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  return identityDelegationConfigsTable({
    instanceId,
    filters,
    instance,
    organization,
    project,
    emptyState: 'No delegation configs found.'
  });
};
