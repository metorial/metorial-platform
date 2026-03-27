import {
  DashboardInstanceProviderRunsGetOutput,
  DashboardInstanceProviderRunsListOutput,
  DashboardInstanceProviderRunsListQuery
} from '@metorial/dashboard-sdk';
import { Paths } from '@metorial/frontend-config';
import { useAllProviderRuns, useCurrentInstance, useProviders } from '@metorial/state';
import { Badge, RenderDate, Text } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { Table as DashboardTable } from '../../../../components/table';
import { FilterPayload } from '../../../../components/table/filter';
import {
  TableStateProvider,
  TableStateProviderResult
} from '../../../../components/table/type';
import {
  getDateRangeFilterValue,
  getEnumListFilterValue,
  getStringFilterValue
} from '../../../../lib/dataTableUtils';

type ProviderRun = DashboardInstanceProviderRunsListOutput['items'][number];
type ProviderRunRow = ProviderRun & { providerName?: string | null };
type ProviderRunStatusCarrier =
  | Pick<DashboardInstanceProviderRunsListOutput['items'][number], 'status'>
  | Pick<DashboardInstanceProviderRunsGetOutput, 'status'>;

type ServerRunsTableProps = {
  sessionId?: string;
  providerId?: string;
  status?: string;
};

let getProviderRunStatusFilterValue = (
  value: FilterPayload | undefined
): DashboardInstanceProviderRunsListQuery['status'] => {
  return getEnumListFilterValue(value, ['running', 'stopped']);
};

export let ServerRunStatusBadge = ({ run }: { run: ProviderRunStatusCarrier }) => {
  let statusColorMap: Record<string, 'orange' | 'red' | 'blue' | 'green' | 'gray'> = {
    active: 'orange',
    running: 'orange',
    failed: 'red',
    completed: 'blue',
    stopped: 'gray',
    succeeded: 'green'
  };
  let statusLabelMap: Record<string, string> = {
    active: 'Running',
    running: 'Running',
    failed: 'Failed',
    completed: 'Completed',
    stopped: 'Stopped',
    succeeded: 'Succeeded'
  };

  return (
    <Badge color={statusColorMap[run.status ?? ''] ?? 'gray'}>
      {statusLabelMap[run.status ?? ''] ?? run.status}
    </Badge>
  );
};

let providerRunsTableState: TableStateProvider<
  ServerRunsTableProps,
  ProviderRunRow,
  TableStateProviderResult<ProviderRunRow>
> = (
  props: ServerRunsTableProps,
  opts: { filter: Record<string, FilterPayload>; search?: string }
) => {
  let runs = useAllProviderRuns(useCurrentInstance().data?.id, {
    order: 'desc',
    sessionId: getStringFilterValue(opts.filter.sessionId) ?? props.sessionId,
    providerId: getStringFilterValue(opts.filter.providerId) ?? props.providerId,
    sessionProviderId: getStringFilterValue(opts.filter.sessionProviderId),
    sessionConnectionId: getStringFilterValue(opts.filter.sessionConnectionId),
    providerVersionId: getStringFilterValue(opts.filter.providerVersionId),
    id: getStringFilterValue(opts.filter.id),
    status: getProviderRunStatusFilterValue(opts.filter.status) ?? (props.status as any),
    createdAt: getDateRangeFilterValue(opts.filter.createdAt),
    updatedAt: getDateRangeFilterValue(opts.filter.updatedAt)
  });

  let providerIds = [
    ...new Set((runs.data?.items ?? []).map(run => run.providerId).filter(Boolean))
  ];
  let shouldLoadProviders = providerIds.length > 0;
  let providers = useProviders(
    useCurrentInstance().data?.id,
    shouldLoadProviders ? { id: providerIds } : null
  );

  let providerNameMap = new Map<string, string>();
  for (let provider of providers.data?.items ?? []) {
    providerNameMap.set(provider.id, provider.name);
  }

  return {
    isLoading: runs.isLoading || (shouldLoadProviders && providers.isLoading),
    error: runs.error ?? (shouldLoadProviders ? providers.error : null),
    hasMoreAfter: runs.data?.pagination.hasMoreAfter ?? false,
    hasMoreBefore: runs.data?.pagination.hasMoreBefore ?? false,
    items: (runs.data?.items ?? []).map(run => ({
      ...run,
      providerName: providerNameMap.get(run.providerId) ?? null
    })),
    loadNext: runs.next,
    loadPrevious: runs.previous
  };
};

let serverRunsTable = new DashboardTable<ServerRunsTableProps, ProviderRunRow>('provider-runs')
  .state(providerRunsTableState)
  .columns([
    {
      id: 'status',
      isDefault: true,
      header: 'Status',
      render: run => <ServerRunStatusBadge run={run} />
    },
    {
      id: 'provider',
      isDefault: true,
      header: 'Provider',
      render: run => (
        <Text size="2" weight="strong">
          {run.providerName ?? run.providerId ?? 'Unknown'}
        </Text>
      )
    },
    {
      id: 'createdAt',
      isDefault: true,
      header: 'Started',
      render: run => <RenderDate date={run.createdAt} />
    },
    {
      id: 'completedAt',
      isDefault: true,
      header: 'Stopped',
      render: run =>
        run.completedAt ? (
          <RenderDate date={run.completedAt} />
        ) : (
          <Text size="2" color="gray600">
            Running
          </Text>
        )
    },
    {
      id: 'id',
      isDefault: false,
      header: 'Run ID',
      render: run => <ID id={run.id} />
    },
    {
      id: 'sessionId',
      isDefault: false,
      header: 'Session ID',
      render: run => <ID id={run.sessionId} />
    },
    {
      id: 'sessionProviderId',
      isDefault: false,
      header: 'Session Provider ID',
      render: run => <ID id={run.sessionProviderId} />
    },
    {
      id: 'connectionId',
      isDefault: false,
      header: 'Connection ID',
      render: run => <ID id={run.connectionId} />
    },
    {
      id: 'updatedAt',
      isDefault: false,
      header: 'Updated',
      render: run => <RenderDate date={run.updatedAt} />
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
        { id: 'running', label: 'Running' },
        { id: 'stopped', label: 'Stopped' }
      ]
    },
    {
      id: 'id',
      fields: ['id'],
      label: 'Run ID',
      description: 'Filter by run ID',
      type: 'string'
    },
    {
      id: 'sessionId',
      fields: ['sessionId'],
      label: 'Session ID',
      description: 'Filter by session ID',
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
      id: 'sessionProviderId',
      fields: ['sessionProviderId'],
      label: 'Session Provider ID',
      description: 'Filter by session provider ID',
      type: 'string'
    },
    {
      id: 'sessionConnectionId',
      fields: ['sessionConnectionId'],
      label: 'Connection ID',
      description: 'Filter by connection ID',
      type: 'string'
    },
    {
      id: 'providerVersionId',
      fields: ['providerVersionId'],
      label: 'Version ID',
      description: 'Filter by version ID',
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
  .link((run, props) =>
    Paths.instance.providerRun(
      useCurrentInstance().data?.organization,
      useCurrentInstance().data?.project,
      useCurrentInstance().data,
      run.id
    )
  )
  .build();

export let ServerRunsTable = (filter?: {
  sessionId?: string;
  providerId?: string;
  status?: string;
}) =>
  serverRunsTable({
    ...filter,
    emptyState: 'No provider runs found.'
  });
