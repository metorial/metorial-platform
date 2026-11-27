import {
  DashboardInstanceIdentitiesDelegationsListOutput,
  DashboardInstanceIdentitiesDelegationsListQuery
} from '@metorial/dashboard-sdk';
import {
  col,
  createDataList,
  defineStatus,
  EmptyValue,
  f,
  withDefaults
} from '@metorial/data-list';
import { Paths } from '@metorial/frontend-config';
import { useIdentityDelegations } from '@metorial/state';
import { RenderDate } from '@metorial/ui';
import { useInstanceContext } from '../../lib/dataList';
import { entityFilters } from '../entityFilters';

type IdentityDelegation = DashboardInstanceIdentitiesDelegationsListOutput['items'][number];

type IdentityDelegationFilters = Omit<
  DashboardInstanceIdentitiesDelegationsListQuery,
  'limit' | 'after' | 'before' | 'cursor'
>;

let delegationStatus = defineStatus({
  active: { label: 'Active', color: 'green' },
  waiting_for_consent: { label: 'Waiting for Consent', color: 'orange' },
  denied: { label: 'Denied', color: 'red' },
  revoked: { label: 'Revoked', color: 'gray' },
  expired: { label: 'Expired', color: 'gray' }
});

let delegationPermissions = [
  { id: 'provider:call', label: 'Provider Call' },
  { id: 'provider:read', label: 'Provider Read' }
] as const;

let getPartyName = (
  parties: IdentityDelegation['parties'],
  role: 'owner' | 'delegatee' | 'delegator'
) => parties.find(party => party.roles.includes(role))?.actor.name;

let IdentityDelegationsList = createDataList<{
  instanceId: string;
  filters?: IdentityDelegationFilters;
}>('identity-delegations')
  .context(useInstanceContext)
  .filters(props => ({
    status: f.status(delegationStatus),
    permissions: f.select('permissions', 'Permissions', delegationPermissions, {
      description: 'Filter by permissions'
    }),
    identityId: f.entity(entityFilters.identity(props.instanceId)),
    ownerActorId: f.entity(
      entityFilters.actor(props.instanceId, { id: 'ownerActorId', label: 'Owner' })
    ),
    delegatorActorId: f.entity(
      entityFilters.actor(props.instanceId, { id: 'delegatorActorId', label: 'Delegator' })
    ),
    delegateeActorId: f.entity(
      entityFilters.actor(props.instanceId, { id: 'delegateeActorId', label: 'Delegatee' })
    ),
    createdAt: f.createdAt(),
    updatedAt: f.updatedAt()
  }))
  .paginated(({ props, filters }) =>
    useIdentityDelegations(
      props.instanceId,
      withDefaults(props.filters, { order: 'desc' as const, ...filters })
    )
  )
  .columns([
    col.twoLine({
      id: 'delegatee',
      header: 'Delegatee',
      primary: (row: IdentityDelegation) => getPartyName(row.parties, 'delegatee') ?? '—',
      secondary: row => `via ${getPartyName(row.parties, 'delegator') ?? '—'}`
    }),
    col.text({
      id: 'owner',
      header: 'Owner',
      get: row => getPartyName(row.parties, 'owner')
    }),
    col.status(delegationStatus),
    col.text({
      id: 'permissions',
      header: 'Permissions',
      get: row => row.permissions.join(', ')
    }),
    col.text({
      id: 'identity',
      header: 'Identity',
      isDefault: false,
      get: row => row.identity.name
    }),
    col.text({
      id: 'level',
      header: 'Level',
      isDefault: false,
      get: row => row.delegationLevel
    }),
    col.custom({
      id: 'expiresAt',
      header: 'Expires',
      isDefault: false,
      render: row =>
        row.expiresAt ? <RenderDate date={row.expiresAt} /> : <EmptyValue>Never</EmptyValue>
    }),
    col.createdAt(),
    col.updatedAt(),
    col.id({ header: 'Delegation ID' })
  ])
  .link((row, _props, ctx) =>
    Paths.organization.instance.identity.delegation(
      ctx.organization,
      ctx.project,
      ctx.instance,
      row.id
    )
  )
  .build();

export let IdentityDelegationsTable = (p: Parameters<typeof IdentityDelegationsList>[0]) => (
  <IdentityDelegationsList emptyState="No delegations found." {...p} />
);
