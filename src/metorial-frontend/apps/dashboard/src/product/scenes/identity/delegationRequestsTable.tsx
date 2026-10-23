import {
  DashboardInstanceIdentitiesDelegationRequestsListOutput,
  DashboardInstanceIdentitiesDelegationRequestsListQuery
} from '@metorial/dashboard-sdk';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useIdentityDelegationRequests
} from '@metorial/state';
import { Badge, RenderDate, Text } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { Table as DashboardTable } from '@metorial/table';
import {
  FilterPayload,
  TableFilter,
  getEnumListFilterValue,
  getListFilterValue
} from '@metorial/table';
import { useMemo } from 'react';
import { entityFilters } from '../entityFilters';

type IdentityDelegationRequest =
  DashboardInstanceIdentitiesDelegationRequestsListOutput['items'][number];

type IdentityDelegationRequestFilters = Omit<
  DashboardInstanceIdentitiesDelegationRequestsListQuery,
  'limit' | 'after' | 'before' | 'cursor'
>;

type IdentityDelegationRequestsTableProps = {
  instanceId: string;
  filters?: IdentityDelegationRequestFilters;
  organization: ReturnType<typeof useCurrentOrganization>;
  project: ReturnType<typeof useCurrentProject>;
  instance: ReturnType<typeof useCurrentInstance>;
};

let getRequestStatusColor = (status: IdentityDelegationRequest['status']) => {
  if (status === 'approved') return 'green';
  if (status === 'pending') return 'orange';
  if (status === 'denied') return 'red';
  return 'gray';
};

let getStatusFilterValue = (
  value: FilterPayload | undefined
): DashboardInstanceIdentitiesDelegationRequestsListQuery['status'] => {
  return getEnumListFilterValue(value, ['pending', 'approved', 'denied', 'canceled']);
};

let useIdentityDelegationRequestsTableFilters = (instanceId: string) =>
  useMemo<TableFilter<IdentityDelegationRequest>[]>(
    () => [
      {
        id: 'status',
        fields: ['status'],
        label: 'Status',
        description: 'Filter by status',
        type: 'select',
        options: [
          { id: 'pending', label: 'Pending' },
          { id: 'approved', label: 'Approved' },
          { id: 'denied', label: 'Denied' },
          { id: 'canceled', label: 'Canceled' }
        ]
      },
      entityFilters.actor(instanceId),
      entityFilters.identity(instanceId)
    ],
    [instanceId]
  );

let useIdentityDelegationRequestsTableState = (
  props: IdentityDelegationRequestsTableProps,
  opts: {
    filter: Record<string, FilterPayload>;
    search?: string;
  }
) => {
  let requests = useIdentityDelegationRequests(props.instanceId, {
    order: 'desc',
    ...props.filters,
    status: getStatusFilterValue(opts.filter.status) ?? props.filters?.status,
    actorId: getListFilterValue(opts.filter.actorId) ?? props.filters?.actorId,
    identityId: getListFilterValue(opts.filter.identityId) ?? props.filters?.identityId
  });

  return {
    isLoading: requests.isLoading,
    error: requests.error,
    hasMoreAfter: requests.data?.pagination.hasMoreAfter ?? false,
    hasMoreBefore: requests.data?.pagination.hasMoreBefore ?? false,
    items: requests.data?.items ?? [],
    loadNext: requests.next,
    loadPrevious: requests.previous
  };
};

let identityDelegationRequestsTable = new DashboardTable<
  IdentityDelegationRequestsTableProps,
  IdentityDelegationRequest
>('identity-delegation-requests')
  .state(useIdentityDelegationRequestsTableState)
  .columns([
    {
      id: 'requester',
      isDefault: true,
      header: 'Requester',
      render: (request: IdentityDelegationRequest) => (
        <div>
          <Text size="2" weight="strong">
            {request.requester.name}
          </Text>
          <Text size="1" color="gray600">
            {request.requester.type}
          </Text>
        </div>
      )
    },
    {
      id: 'status',
      isDefault: true,
      header: 'Status',
      render: (request: IdentityDelegationRequest) => (
        <Badge color={getRequestStatusColor(request.status)}>{request.status}</Badge>
      )
    },
    {
      id: 'delegation',
      isDefault: true,
      header: 'Delegation',
      render: (request: IdentityDelegationRequest) => <ID id={request.delegation.id} />
    },
    {
      id: 'identity',
      isDefault: true,
      header: 'Identity',
      render: (request: IdentityDelegationRequest) => (
        <Text size="2">{request.delegation.identity.name}</Text>
      )
    },
    {
      id: 'expiresAt',
      isDefault: false,
      header: 'Expires',
      render: (request: IdentityDelegationRequest) => <RenderDate date={request.expiresAt} />
    },
    {
      id: 'identityId',
      isDefault: false,
      header: 'Identity ID',
      render: (request: IdentityDelegationRequest) => <ID id={request.identityId} />
    },
    {
      id: 'createdAt',
      isDefault: true,
      header: 'Created',
      render: (request: IdentityDelegationRequest) => <RenderDate date={request.createdAt} />
    },
    {
      id: 'id',
      isDefault: false,
      header: 'Request ID',
      render: (request: IdentityDelegationRequest) => <ID id={request.id} />
    }
  ] as any)
  .link(((request: IdentityDelegationRequest, props: IdentityDelegationRequestsTableProps) =>
    Paths.organization.instance.identity.delegation(
      props.organization.data,
      props.project.data,
      props.instance.data,
      request.delegation?.id
    )) as any)
  .build();

export let IdentityDelegationRequestsTable = ({
  instanceId,
  filters
}: {
  instanceId: string;
  filters?: IdentityDelegationRequestFilters;
}) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let tableFilters = useIdentityDelegationRequestsTableFilters(instanceId);

  return identityDelegationRequestsTable({
    instanceId,
    filters,
    instance,
    organization,
    project,
    tableFilters,
    emptyState: 'No delegation requests found.'
  });
};
