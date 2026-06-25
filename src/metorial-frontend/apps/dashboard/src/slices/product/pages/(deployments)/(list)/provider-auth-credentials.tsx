import {
  DashboardInstanceProviderDeploymentsAuthCredentialsListOutput,
  DashboardInstanceProviderDeploymentsAuthCredentialsListQuery
} from '@metorial/dashboard-sdk';
import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useDeleteProviderAuthCredentials,
  useProviderAuthCredentials,
  useProviders
} from '@metorial/state';
import { Badge, RenderDate, Text, confirm } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { RiDeleteBinLine } from '@remixicon/react';
import { useState } from 'react';
import { EmptyState } from '../../../../../components/emptyState';
import { Table as DashboardTable } from '../../../../../components/table';
import { FilterPayload } from '../../../../../components/table/filter';
import {
  TableStateProvider,
  TableStateProviderResult
} from '../../../../../components/table/type';
import {
  getDateRangeFilterValue,
  getEnumListFilterValue,
  getStringFilterValue
} from '../../../../../lib/dataTableUtils';
import { showCreateProviderAuthCredentialsFlow } from './providerCreationFlows';

type ProviderAuthCredential =
  DashboardInstanceProviderDeploymentsAuthCredentialsListOutput['items'][number];

type ProviderAuthCredentialRow = ProviderAuthCredential & {
  providerName?: string | null;
  origin: 'custom' | 'managed';
};

type ProviderAuthCredentialFilters = Omit<
  DashboardInstanceProviderDeploymentsAuthCredentialsListQuery,
  'limit' | 'after' | 'before' | 'cursor'
>;

type ProviderAuthCredentialsTableProps = {
  instanceId: string;
  filters?: ProviderAuthCredentialFilters;
  organization: ReturnType<typeof useCurrentOrganization>;
  project: ReturnType<typeof useCurrentProject>;
  instance: ReturnType<typeof useCurrentInstance>;
};

let getOriginFilterValue = (
  value: FilterPayload | undefined
): DashboardInstanceProviderDeploymentsAuthCredentialsListQuery['origin'] => {
  return getEnumListFilterValue(value, ['custom', 'managed']);
};

let getStatusFilterValue = (
  value: FilterPayload | undefined
): DashboardInstanceProviderDeploymentsAuthCredentialsListQuery['status'] => {
  return getEnumListFilterValue(value, ['active', 'archived']);
};

let getAuthCredentialsStatusColor = (status: ProviderAuthCredential['status']) => {
  if (status === 'active') return 'green';
  if (status === 'archived') return 'orange';
  return 'gray';
};

let providerAuthCredentialsTableState: TableStateProvider<
  ProviderAuthCredentialsTableProps,
  ProviderAuthCredentialRow,
  TableStateProviderResult<ProviderAuthCredentialRow>
> = (
  props: ProviderAuthCredentialsTableProps,
  opts: {
    filter: Record<string, FilterPayload>;
    search?: string;
  }
) => {
  let authCredentials = useProviderAuthCredentials(props.instanceId, {
    order: 'desc',
    ...props.filters,
    status: getStatusFilterValue(opts.filter.status) ?? props.filters?.status,
    id: getStringFilterValue(opts.filter.id) ?? props.filters?.id,
    providerId: getStringFilterValue(opts.filter.providerId) ?? props.filters?.providerId,
    origin: getOriginFilterValue(opts.filter.origin) ?? props.filters?.origin,
    search: opts.search ?? props.filters?.search,
    createdAt: getDateRangeFilterValue(opts.filter.createdAt) ?? props.filters?.createdAt,
    updatedAt: getDateRangeFilterValue(opts.filter.updatedAt) ?? props.filters?.updatedAt
  });

  let providerIds = [
    ...new Set(
      (authCredentials.data?.items ?? []).map(item => item.providerId).filter(Boolean)
    )
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
    isLoading: authCredentials.isLoading || (shouldLoadProviders && providers.isLoading),
    error: authCredentials.error ?? (shouldLoadProviders ? providers.error : null),
    hasMoreAfter: authCredentials.data?.pagination.hasMoreAfter ?? false,
    hasMoreBefore: authCredentials.data?.pagination.hasMoreBefore ?? false,
    items: (authCredentials.data?.items ?? []).map(item => ({
      ...item,
      providerName: providerNameMap.get(item.providerId) ?? null,
      origin: item.isManaged ? 'managed' : 'custom'
    })),
    loadNext: authCredentials.next,
    loadPrevious: authCredentials.previous
  };
};

let useProviderAuthCredentialsTableHookState = (
  _: ReturnType<typeof providerAuthCredentialsTableState>,
  props: ProviderAuthCredentialsTableProps
) => {
  let deleteAuthCredentials = useDeleteProviderAuthCredentials();
  let [loadingIds, setLoadingIds] = useState<string[]>([]);

  return {
    deleteAuthCredentials,
    instanceId: props.instanceId,
    loadingIds,
    setLoadingIds
  };
};

let deleteProviderAuthCredentialsImmediately = async (
  authCredentials: ProviderAuthCredentialRow,
  state: ReturnType<typeof useProviderAuthCredentialsTableHookState>
) => {
  state.setLoadingIds((current: string[]) => [...new Set([...current, authCredentials.id])]);

  try {
    await state.deleteAuthCredentials.mutate({
      instanceId: state.instanceId,
      providerAuthCredentialsId: authCredentials.id
    });
  } finally {
    state.setLoadingIds((current: string[]) => current.filter(id => id != authCredentials.id));
  }
};

export let providerAuthCredentialsTable = new DashboardTable<
  ProviderAuthCredentialsTableProps,
  ProviderAuthCredentialRow
>('provider-auth-credentials-overview')
  .state(providerAuthCredentialsTableState)
  .hookState(useProviderAuthCredentialsTableHookState)
  .columns([
    {
      id: 'name',
      isDefault: true,
      header: 'Name',
      render: row => (
        <Text
          size="2"
          weight="strong"
          style={{ display: 'inline-flex', alignItems: 'center' }}
        >
          {row.isManaged && (
            <div style={{ marginRight: 5, display: 'inline-flex', verticalAlign: 'middle' }}>
              <Badge color="blue" size="1">
                Managed
              </Badge>
            </div>
          )}
          {row.name || '—'}
        </Text>
      )
    },
    {
      id: 'provider',
      isDefault: true,
      header: 'Provider',
      render: row => <Text size="2">{row.providerName ?? row.providerId}</Text>
    },
    {
      id: 'type',
      isDefault: true,
      header: 'Type',
      render: row => <Text size="2">{row.type}</Text>
    },
    {
      id: 'createdAt',
      isDefault: true,
      header: 'Created',
      render: row => <RenderDate date={row.createdAt} />
    },
    {
      id: 'id',
      isDefault: true,
      header: 'ID',
      render: row => <ID id={row.id} />
    },
    {
      id: 'status',
      isDefault: false,
      header: 'Status',
      render: row => (
        <Badge color={getAuthCredentialsStatusColor(row.status)}>{row.status}</Badge>
      )
    },
    {
      id: 'origin',
      isDefault: false,
      header: 'Origin',
      render: row => <Text size="2">{row.origin}</Text>
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
    }
  ])
  .filters([
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
    {
      id: 'id',
      fields: ['id'],
      label: 'Credential ID',
      description: 'Filter by credential ID',
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
      id: 'origin',
      fields: ['origin'],
      label: 'Origin',
      description: 'Filter by origin',
      type: 'select',
      options: [
        { id: 'custom', label: 'Custom' },
        { id: 'managed', label: 'Managed' }
      ]
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
  .link((row, props) =>
    Paths.instance.providerAuthCredential(
      props.organization.data,
      props.project.data,
      props.instance.data,
      row.id
    )
  )
  .search('Search auth credentials...')
  .actions({
    deleteImmediate: async (credentials, state) => {
      let authCredentials = credentials[0];
      if (!authCredentials) return;

      await deleteProviderAuthCredentialsImmediately(authCredentials, state);
    },
    delete: async (credentials, state) => {
      let authCredentials = credentials[0];
      if (!authCredentials) return;

      confirm({
        title: 'Delete auth credentials',
        description: `Are you sure you want to delete ${authCredentials.name ?? 'these auth credentials'}?`,
        confirmText: 'Delete',
        onConfirm: async () => {
          await deleteProviderAuthCredentialsImmediately(authCredentials, state);
        }
      });
    }
  })
  .rowActions([
    {
      id: 'delete',
      label: 'Delete',
      icon: <RiDeleteBinLine />,
      disabled: row => row.status !== 'active' || row.isManaged,
      action: 'delete'
    }
  ])
  .bulkActions([
    {
      id: 'delete-selected',
      label: 'Delete',
      icon: <RiDeleteBinLine />,
      disabled: row => row.status !== 'active' || row.isManaged,
      action: 'deleteImmediate',
      bulkExecution: {
        mode: 'per-row',
        batchSize: 10
      }
    }
  ])
  .build();

export let ProviderAuthCredentialsOverviewPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  return renderWithLoader({ organization, project, instance })(() =>
    providerAuthCredentialsTable({
      instanceId: instance.data!.id,
      organization,
      project,
      instance,
      emptyState: () => (
        <EmptyState
          title="Create your first auth credentials"
          description="Auth credentials store the provider access details your instance can reuse."
          action={{
            label: 'Create Auth Credentials',
            onClick: () => {
              if (instance.data?.id) {
                showCreateProviderAuthCredentialsFlow(instance.data.id);
              }
            }
          }}
        />
      )
    })
  );
};
