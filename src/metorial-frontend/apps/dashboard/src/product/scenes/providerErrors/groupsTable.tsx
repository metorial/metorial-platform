import {
  DashboardInstanceSessionsErrorGroupsListOutput,
  DashboardInstanceSessionsErrorGroupsListQuery
} from '@metorial/dashboard-sdk';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useSessionErrorGroups } from '@metorial/state';
import {
  Table as DashboardTable,
  FilterPayload,
  TableStateProvider,
  TableStateProviderResult,
  getEnumListFilterValue,
  getListFilterValue,
  type TableFilter,
  type TableLayoutProps
} from '@metorial/table';
import { Badge, RenderDate, Text } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { useMemo } from 'react';
import { entityFilters } from '../entityFilters';
import { getErrorLabel } from '../errorGroupLabel';

type ErrorGroup = DashboardInstanceSessionsErrorGroupsListOutput['items'][number];

type ErrorGroupsTableProps = { sessionId?: string; type?: string };
type ErrorGroupsTableStateProps = ErrorGroupsTableProps & {
  instance: ReturnType<typeof useCurrentInstance>;
};

let getErrorTypeFilterValue = (
  value: FilterPayload | undefined
): DashboardInstanceSessionsErrorGroupsListQuery['type'] => {
  return getEnumListFilterValue(value, [
    'message_processing_timeout',
    'message_processing_provider_error',
    'message_processing_system_error'
  ]);
};

let errorGroupsTableState: TableStateProvider<
  ErrorGroupsTableStateProps,
  ErrorGroup,
  TableStateProviderResult<ErrorGroup>
> = (props, opts) => {
  let errors = useSessionErrorGroups(props.instance.data?.id, {
    order: 'desc',
    search: opts.search || undefined,
    sessionId: getListFilterValue(opts.filter.sessionId) ?? props.sessionId,
    type: getErrorTypeFilterValue(opts.filter.type) ?? (props.type as any),
    providerId: getListFilterValue(opts.filter.providerId)
  });

  return {
    isLoading: errors.isLoading,
    error: errors.error,
    hasMoreAfter: errors.data?.pagination.hasMoreAfter ?? false,
    hasMoreBefore: errors.data?.pagination.hasMoreBefore ?? false,
    items: errors.data?.items ?? [],
    loadNext: errors.next,
    loadPrevious: errors.previous
  };
};

let truncate = (str: string, maxLength: number) => {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
};

let useErrorGroupsFilters = (instanceId: string | undefined) =>
  useMemo<TableFilter<ErrorGroup>[]>(
    () => [
      {
        id: 'type',
        fields: ['type'],
        label: 'Type',
        description: 'Filter by type',
        type: 'select',
        options: [
          { id: 'message_processing_timeout', label: 'Timeout' },
          { id: 'message_processing_provider_error', label: 'Provider Error' },
          { id: 'message_processing_system_error', label: 'System Error' }
        ]
      },
      entityFilters.session(instanceId),
      entityFilters.provider(instanceId)
    ],
    [instanceId]
  );

let providerErrorGroupsTable = new DashboardTable<ErrorGroupsTableStateProps, ErrorGroup>(
  'provider-error-groups'
)
  .state(errorGroupsTableState)
  .columns([
    {
      id: 'code',
      isDefault: true,
      header: 'Name',
      render: error =>
        error.code ? (
          <Badge color="red">{getErrorLabel(error.code)}</Badge>
        ) : (
          <Badge color="gray">Unknown</Badge>
        )
    },
    {
      id: 'message',
      isDefault: true,
      header: 'Details',
      render: error => <Text size="2">{truncate(error.message, 100)}</Text>
    },
    {
      id: 'occurrenceCount',
      isDefault: true,
      header: 'Occurrences',
      render: error => <Text size="2">{error.occurrenceCount ?? '—'}</Text>
    },
    {
      id: 'createdAt',
      isDefault: true,
      header: 'Created',
      render: error => <RenderDate date={error.createdAt} />
    },
    {
      id: 'id',
      isDefault: false,
      header: 'Error Group ID',
      render: error => <ID id={error.id} />
    },
    {
      id: 'providerId',
      isDefault: false,
      header: 'Provider ID',
      render: error =>
        error.providerId ? (
          <ID id={error.providerId} />
        ) : (
          <Text size="2" color="gray600">
            -
          </Text>
        )
    }
  ])
  .search('Search by provider, deployment, error code or ID...')
  .link((error, props) =>
    Paths.instance.providerError(
      props.instance.data?.organization,
      props.instance.data?.project,
      props.instance.data,
      error.id
    )
  )
  .build();

export let ProviderErrorGroupsTable = ({
  layout,
  ...filter
}: ErrorGroupsTableProps & { layout?: TableLayoutProps } = {}) => {
  let instance = useCurrentInstance();
  let tableFilters = useErrorGroupsFilters(instance.data?.id);

  return providerErrorGroupsTable({
    ...layout,
    tableFilters,
    ...filter,
    instance,
    emptyState: 'No provider errors found.'
  });
};
