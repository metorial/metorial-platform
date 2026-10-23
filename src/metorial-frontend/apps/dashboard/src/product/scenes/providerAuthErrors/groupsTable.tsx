import { DashboardInstanceProviderAuthConfigErrorsGroupsListOutput } from '@metorial/dashboard-sdk';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useProviderAuthConfigErrorGroups } from '@metorial/state';
import {
  Table as DashboardTable,
  TableStateProvider,
  TableStateProviderResult,
  getListFilterValue,
  getStringFilterValue,
  type TableFilter,
  type TableLayoutProps
} from '@metorial/table';
import { Badge, RenderDate, Text } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { useMemo } from 'react';
import { entityFilters } from '../entityFilters';
import { getErrorLabel } from '../errorGroupLabel';

type ErrorGroup = DashboardInstanceProviderAuthConfigErrorsGroupsListOutput['items'][number];

type ErrorGroupsTableProps = { providerAuthConfigId?: string; providerId?: string };
type ErrorGroupsTableStateProps = ErrorGroupsTableProps & {
  instance: ReturnType<typeof useCurrentInstance>;
};

let errorGroupsTableState: TableStateProvider<
  ErrorGroupsTableStateProps,
  ErrorGroup,
  TableStateProviderResult<ErrorGroup>
> = (props, opts) => {
  let errors = useProviderAuthConfigErrorGroups(props.instance.data?.id, {
    order: 'desc',
    search: opts.search || undefined,
    providerAuthConfigId:
      getListFilterValue(opts.filter.providerAuthConfigId) ?? props.providerAuthConfigId,
    providerId: getListFilterValue(opts.filter.providerId) ?? props.providerId,
    type: getStringFilterValue(opts.filter.type)
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

let useAuthErrorGroupsFilters = (instanceId: string | undefined) =>
  useMemo<TableFilter<ErrorGroup>[]>(
    () => [
      {
        id: 'type',
        fields: ['type'],
        label: 'Type',
        description: 'Filter by type',
        type: 'string'
      },
      entityFilters.providerAuthConfig(instanceId),
      entityFilters.provider(instanceId)
    ],
    [instanceId]
  );

let providerAuthErrorGroupsTable = new DashboardTable<ErrorGroupsTableStateProps, ErrorGroup>(
  'provider-auth-error-groups'
)
  .state(errorGroupsTableState)
  .columns([
    {
      id: 'code',
      isDefault: true,
      header: 'Name',
      render: group =>
        group.code ? (
          <Badge color="red">{getErrorLabel(group.code)}</Badge>
        ) : (
          <Badge color="gray">Unknown</Badge>
        )
    },
    {
      id: 'message',
      isDefault: true,
      header: 'Details',
      render: group => <Text size="2">{truncate(group.message, 100)}</Text>
    },
    {
      id: 'occurrenceCount',
      isDefault: true,
      header: 'Occurrences',
      render: group => <Text size="2">{group.occurrenceCount ?? '—'}</Text>
    },
    {
      id: 'createdAt',
      isDefault: true,
      header: 'Created',
      render: group => <RenderDate date={group.createdAt} />
    },
    {
      id: 'id',
      isDefault: false,
      header: 'Error Group ID',
      render: group => <ID id={group.id} />
    },
    {
      id: 'providerId',
      isDefault: false,
      header: 'Provider ID',
      render: group =>
        group.providerId ? (
          <ID id={group.providerId} />
        ) : (
          <Text size="2" color="gray600">
            -
          </Text>
        )
    }
  ])
  .search('Search by provider, auth config, credentials or ID...')
  .link((group, props) =>
    Paths.instance.providerAuthError(
      props.instance.data?.organization,
      props.instance.data?.project,
      props.instance.data,
      group.id
    )
  )
  .build();

export let ProviderAuthErrorGroupsTable = ({
  layout,
  ...filter
}: ErrorGroupsTableProps & { layout?: TableLayoutProps } = {}) => {
  let instance = useCurrentInstance();
  let tableFilters = useAuthErrorGroupsFilters(instance.data?.id);

  return providerAuthErrorGroupsTable({
    ...layout,
    tableFilters,
    ...filter,
    instance,
    emptyState: 'No provider auth errors found.'
  });
};
