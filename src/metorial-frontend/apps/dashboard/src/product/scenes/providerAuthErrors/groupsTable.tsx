import { DashboardInstanceProviderAuthConfigErrorsGroupsListOutput } from '@metorial/dashboard-sdk';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useProviderAuthConfigErrorGroups } from '@metorial/state';
import { Badge, RenderDate, Text } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { Table as DashboardTable } from '@metorial/table';
import {
  TableStateProvider,
  TableStateProviderResult,
  getStringFilterValue
} from '@metorial/table';
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
    id: getStringFilterValue(opts.filter.id),
    providerAuthConfigId:
      getStringFilterValue(opts.filter.providerAuthConfigId) ?? props.providerAuthConfigId,
    providerId: getStringFilterValue(opts.filter.providerId) ?? props.providerId,
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
      render: group => <Text size="2">{group.message}</Text>
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
  .filters([
    {
      id: 'type',
      fields: ['type'],
      label: 'Type',
      description: 'Filter by type',
      type: 'string'
    },
    {
      id: 'id',
      fields: ['id'],
      label: 'Error Group ID',
      description: 'Filter by error group ID',
      type: 'string'
    },
    {
      id: 'providerAuthConfigId',
      fields: ['providerAuthConfigId'],
      label: 'Auth Config ID',
      description: 'Filter by provider auth config ID',
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
  .link((group, props) =>
    Paths.instance.providerAuthError(
      props.instance.data?.organization,
      props.instance.data?.project,
      props.instance.data,
      group.id
    )
  )
  .build();

export let ProviderAuthErrorGroupsTable = (filter?: ErrorGroupsTableProps) => {
  let instance = useCurrentInstance();

  return providerAuthErrorGroupsTable({
    ...filter,
    instance,
    emptyState: 'No provider auth errors found.'
  });
};
