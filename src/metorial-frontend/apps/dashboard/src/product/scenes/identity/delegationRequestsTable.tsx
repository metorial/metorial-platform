import {
  DashboardInstanceIdentitiesDelegationRequestsListOutput,
  DashboardInstanceIdentitiesDelegationRequestsListQuery
} from '@metorial/dashboard-sdk';
import { col, createDataList, defineStatus, f, withDefaults } from '@metorial/data-list';
import { Paths } from '@metorial/frontend-config';
import { useIdentityDelegationRequests } from '@metorial/state';
import { useInstanceContext } from '../../lib/dataList';
import { entityFilters } from '../entityFilters';

type IdentityDelegationRequest =
  DashboardInstanceIdentitiesDelegationRequestsListOutput['items'][number];

type IdentityDelegationRequestFilters = Omit<
  DashboardInstanceIdentitiesDelegationRequestsListQuery,
  'limit' | 'after' | 'before' | 'cursor'
>;

let delegationRequestStatus = defineStatus({
  pending: { label: 'Pending', color: 'orange' },
  approved: { label: 'Approved', color: 'green' },
  denied: { label: 'Denied', color: 'red' },
  canceled: { label: 'Canceled', color: 'gray' }
});

let IdentityDelegationRequestsList = createDataList<{
  instanceId: string;
  filters?: IdentityDelegationRequestFilters;
}>('identity-delegation-requests')
  .context(useInstanceContext)
  .filters(props => ({
    status: f.status(delegationRequestStatus),
    actorId: f.entity(entityFilters.actor(props.instanceId)),
    identityId: f.entity(entityFilters.identity(props.instanceId)),
    createdAt: f.createdAt(),
    updatedAt: f.updatedAt()
  }))
  .paginated(({ props, filters }) =>
    useIdentityDelegationRequests(
      props.instanceId,
      withDefaults(props.filters, { order: 'desc' as const, ...filters })
    )
  )
  .columns([
    col.twoLine({
      id: 'requester',
      header: 'Requester',
      primary: (row: IdentityDelegationRequest) => row.requester.name,
      secondary: row => row.requester.type
    }),
    col.status(delegationRequestStatus),
    col.refId('delegation', row => row.delegation.id, {
      header: 'Delegation',
      isDefault: true
    }),
    col.text({ id: 'identity', header: 'Identity', get: row => row.delegation.identity.name }),
    col.date('expiresAt', { header: 'Expires' }),
    col.refId('identityId', row => row.identityId, { header: 'Identity ID' }),
    col.createdAt(),
    col.updatedAt(),
    col.id({ header: 'Request ID' })
  ])
  .link((row, _props, ctx) =>
    Paths.organization.instance.identity.delegation(
      ctx.organization,
      ctx.project,
      ctx.instance,
      row.delegation?.id
    )
  )
  .build();

export let IdentityDelegationRequestsTable = (
  p: Parameters<typeof IdentityDelegationRequestsList>[0]
) => <IdentityDelegationRequestsList emptyState="No delegation requests found." {...p} />;
