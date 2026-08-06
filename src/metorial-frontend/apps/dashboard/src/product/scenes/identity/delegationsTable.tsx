import {
  DashboardInstanceIdentitiesDelegationsListOutput,
  DashboardInstanceIdentitiesDelegationsListQuery
} from '@metorial/dashboard-sdk';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useIdentityDelegations
} from '@metorial/state';
import { Badge, RenderDate, Text } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { Table as DashboardTable } from '@metorial/table';
import { FilterPayload, getEnumListFilterValue, getStringFilterValue } from '@metorial/table';

type IdentityDelegation = DashboardInstanceIdentitiesDelegationsListOutput['items'][number];

type IdentityDelegationFilters = Omit<
  DashboardInstanceIdentitiesDelegationsListQuery,
  'limit' | 'after' | 'before' | 'cursor'
>;

type IdentityDelegationsTableProps = {
  instanceId: string;
  filters?: IdentityDelegationFilters;
  organization: ReturnType<typeof useCurrentOrganization>;
  project: ReturnType<typeof useCurrentProject>;
  instance: ReturnType<typeof useCurrentInstance>;
};

let getDelegationStatusColor = (status: IdentityDelegation['status']) => {
  if (status === 'active') return 'green';
  if (status === 'waiting_for_consent') return 'orange';
  if (status === 'denied') return 'red';
  return 'gray';
};

let getPartyName = (
  parties: IdentityDelegation['parties'],
  role: 'owner' | 'delegatee' | 'delegator'
) => {
  return parties.find(party => party.roles.includes(role))?.actor.name ?? '-';
};

let getStatusFilterValue = (
  value: FilterPayload | undefined
): DashboardInstanceIdentitiesDelegationsListQuery['status'] => {
  return getEnumListFilterValue(value, [
    'waiting_for_consent',
    'denied',
    'active',
    'revoked',
    'expired'
  ]);
};

let getPermissionsFilterValue = (
  value: FilterPayload | undefined
): DashboardInstanceIdentitiesDelegationsListQuery['permissions'] => {
  return getEnumListFilterValue(value, ['provider:call', 'provider:read']);
};

let useIdentityDelegationsTableState = (
  props: IdentityDelegationsTableProps,
  opts: {
    filter: Record<string, FilterPayload>;
    search?: string;
  }
) => {
  let delegations = useIdentityDelegations(props.instanceId, {
    order: 'desc',
    ...props.filters,
    status: getStatusFilterValue(opts.filter.status) ?? props.filters?.status,
    permissions:
      getPermissionsFilterValue(opts.filter.permissions) ?? props.filters?.permissions,
    id: getStringFilterValue(opts.filter.id) ?? props.filters?.id,
    ownerActorId:
      getStringFilterValue(opts.filter.ownerActorId) ?? props.filters?.ownerActorId,
    delegatorActorId:
      getStringFilterValue(opts.filter.delegatorActorId) ?? props.filters?.delegatorActorId,
    delegateeActorId:
      getStringFilterValue(opts.filter.delegateeActorId) ?? props.filters?.delegateeActorId,
    identityId: getStringFilterValue(opts.filter.identityId) ?? props.filters?.identityId
  });

  return {
    isLoading: delegations.isLoading,
    error: delegations.error,
    hasMoreAfter: delegations.data?.pagination.hasMoreAfter ?? false,
    hasMoreBefore: delegations.data?.pagination.hasMoreBefore ?? false,
    items: delegations.data?.items ?? [],
    loadNext: delegations.next,
    loadPrevious: delegations.previous
  };
};

let identityDelegationsTable = new DashboardTable<
  IdentityDelegationsTableProps,
  IdentityDelegation
>('identity-delegations')
  .state(useIdentityDelegationsTableState)
  .columns([
    {
      id: 'delegatee',
      isDefault: true,
      header: 'Delegatee',
      render: (delegation: IdentityDelegation) => (
        <div>
          <Text size="2" weight="strong">
            {getPartyName(delegation.parties, 'delegatee')}
          </Text>
          <Text size="1" color="gray600">
            via {getPartyName(delegation.parties, 'delegator')}
          </Text>
        </div>
      )
    },
    {
      id: 'owner',
      isDefault: true,
      header: 'Owner',
      render: (delegation: IdentityDelegation) => (
        <Text size="2">{getPartyName(delegation.parties, 'owner')}</Text>
      )
    },
    {
      id: 'status',
      isDefault: true,
      header: 'Status',
      render: (delegation: IdentityDelegation) => (
        <Badge color={getDelegationStatusColor(delegation.status)}>{delegation.status}</Badge>
      )
    },
    {
      id: 'permissions',
      isDefault: true,
      header: 'Permissions',
      render: (delegation: IdentityDelegation) => (
        <Text size="2">{delegation.permissions.join(', ')}</Text>
      )
    },
    {
      id: 'identity',
      isDefault: false,
      header: 'Identity',
      render: (delegation: IdentityDelegation) => (
        <Text size="2">{delegation.identity.name}</Text>
      )
    },
    {
      id: 'level',
      isDefault: false,
      header: 'Level',
      render: (delegation: IdentityDelegation) => (
        <Text size="2">{delegation.delegationLevel}</Text>
      )
    },
    {
      id: 'expiresAt',
      isDefault: false,
      header: 'Expires',
      render: (delegation: IdentityDelegation) =>
        delegation.expiresAt ? (
          <RenderDate date={delegation.expiresAt} />
        ) : (
          <Text size="2" color="gray600">
            Never
          </Text>
        )
    },
    {
      id: 'createdAt',
      isDefault: true,
      header: 'Created',
      render: (delegation: IdentityDelegation) => <RenderDate date={delegation.createdAt} />
    },
    {
      id: 'id',
      isDefault: false,
      header: 'Delegation ID',
      render: (delegation: IdentityDelegation) => <ID id={delegation.id} />
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
        { id: 'waiting_for_consent', label: 'Waiting for Consent' },
        { id: 'denied', label: 'Denied' },
        { id: 'revoked', label: 'Revoked' },
        { id: 'expired', label: 'Expired' }
      ]
    },
    {
      id: 'permissions',
      fields: ['permissions'],
      label: 'Permissions',
      description: 'Filter by permissions',
      type: 'select',
      options: [
        { id: 'provider:call', label: 'Provider Call' },
        { id: 'provider:read', label: 'Provider Read' }
      ]
    },
    {
      id: 'id',
      fields: ['id'],
      label: 'Delegation ID',
      description: 'Filter by delegation ID',
      type: 'string'
    },
    {
      id: 'identityId',
      fields: ['identityId'],
      label: 'Identity ID',
      description: 'Filter by identity ID',
      type: 'string'
    },
    {
      id: 'ownerActorId',
      fields: ['ownerActorId'],
      label: 'Owner Actor ID',
      description: 'Filter by owner actor ID',
      type: 'string'
    },
    {
      id: 'delegatorActorId',
      fields: ['delegatorActorId'],
      label: 'Delegator Actor ID',
      description: 'Filter by delegator actor ID',
      type: 'string'
    },
    {
      id: 'delegateeActorId',
      fields: ['delegateeActorId'],
      label: 'Delegatee Actor ID',
      description: 'Filter by delegatee actor ID',
      type: 'string'
    }
  ])
  .link(((delegation: IdentityDelegation, props: IdentityDelegationsTableProps) =>
    Paths.organization.instance.identity.delegation(
      props.organization.data,
      props.project.data,
      props.instance.data,
      delegation.id
    )) as any)
  .build();

export let IdentityDelegationsTable = ({
  instanceId,
  filters
}: {
  instanceId: string;
  filters?: IdentityDelegationFilters;
}) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  return identityDelegationsTable({
    instanceId,
    filters,
    instance,
    organization,
    project,
    emptyState: 'No delegations found.'
  });
};
