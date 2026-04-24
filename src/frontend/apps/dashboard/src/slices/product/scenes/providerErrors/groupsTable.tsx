import {
  DashboardInstanceSessionsErrorGroupsListOutput,
  DashboardInstanceSessionsErrorGroupsListQuery
} from '@metorial/dashboard-sdk';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useSessionErrorGroups } from '@metorial/state';
import { Badge, RenderDate, Text } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { Table as DashboardTable } from '../../../../components/table';
import { FilterPayload } from '../../../../components/table/filter';
import {
  TableStateProvider,
  TableStateProviderResult
} from '../../../../components/table/type';
import { getEnumListFilterValue, getStringFilterValue } from '../../../../lib/dataTableUtils';

type ErrorGroup = DashboardInstanceSessionsErrorGroupsListOutput['items'][number];

type ErrorGroupsTableProps = { sessionId?: string; type?: string };
type ErrorGroupsTableStateProps = ErrorGroupsTableProps & {
  instance: ReturnType<typeof useCurrentInstance>;
};

let splitMany = (str: string, separators: string[]) => {
  let regex = new RegExp(separators.map(s => `\\${s}`).join('|'), 'g');
  return str.split(regex);
};

let humanizeCode = (code: string) =>
  splitMany(code, ['_', '-', '.', ' '])
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

let getErrorLabel = (code: string) => humanizeCode(code);

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
    sessionId: getStringFilterValue(opts.filter.sessionId) ?? props.sessionId,
    type: getErrorTypeFilterValue(opts.filter.type) ?? (props.type as any),
    id: getStringFilterValue(opts.filter.id),
    providerId: getStringFilterValue(opts.filter.providerId)
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
      render: error => <Text size="2">{error.message}</Text>
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
  .filters([
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
    {
      id: 'id',
      fields: ['id'],
      label: 'Error Group ID',
      description: 'Filter by error group ID',
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
    }
  ])
  .link((error, props) =>
    Paths.instance.providerError(
      props.instance.data?.organization,
      props.instance.data?.project,
      props.instance.data,
      error.id
    )
  )
  .build();

export let ProviderErrorGroupsTable = (filter?: ErrorGroupsTableProps) => {
  let instance = useCurrentInstance();

  return providerErrorGroupsTable({
    ...filter,
    instance,
    emptyState: 'No provider errors found.'
  });
};
