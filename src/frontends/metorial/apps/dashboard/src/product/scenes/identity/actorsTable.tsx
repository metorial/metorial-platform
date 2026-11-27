import {
  DashboardInstanceIdentityActorsListOutput,
  DashboardInstanceIdentityActorsListQuery
} from '@metorial/dashboard-sdk';
import {
  col,
  createDataList,
  deleteAction,
  f,
  lifecycleStatus,
  withDefaults
} from '@metorial/data-list';
import { useDeleteIdentityActor, useIdentityActors } from '@metorial/state';
import { useInstanceContext } from '../../lib/dataList';
import { useIdentityPaths } from '../../lib/identityPaths';
import { entityFilters } from '../entityFilters';

type IdentityActor = DashboardInstanceIdentityActorsListOutput['items'][number];

type IdentityActorFilters = Omit<
  DashboardInstanceIdentityActorsListQuery,
  'limit' | 'after' | 'before' | 'cursor'
>;

let getActorTypeLabel = (type: IdentityActor['type']) =>
  type === 'agent' ? 'Agent' : 'Person';

let IdentityActorsList = createDataList<{
  instanceId: string;
  filters?: IdentityActorFilters;
}>('identity-actors')
  .context(() => ({ ...useInstanceContext(), identityPaths: useIdentityPaths() }))
  .filters(props => ({
    status: f.status(lifecycleStatus),
    agentId: f.entity(entityFilters.agent(props.instanceId)),
    createdAt: f.createdAt(),
    updatedAt: f.updatedAt()
  }))
  .search('Search identity actors…')
  .paginated(({ props, filters, search }) =>
    useIdentityActors(
      props.instanceId,
      withDefaults(props.filters, { order: 'desc' as const, ...filters, search })
    )
  )
  .columns([
    col.name(),
    col.text({ id: 'type', header: 'Type', get: row => getActorTypeLabel(row.type) }),
    col.status(lifecycleStatus, { isDefault: false }),
    col.refId('agentId', row => row.agentId, { header: 'Agent ID' }),
    col.createdAt(),
    col.updatedAt(),
    col.id({ header: 'Actor ID' })
  ])
  .link((row, _props, ctx) =>
    ctx.identityPaths.actor(ctx.organization, ctx.project, ctx.instance, row.id)
  )
  .itemActions([
    deleteAction({
      noun: 'Actor',
      name: row => row.name,
      disabled: row => row.status !== 'active',
      useMutate: () => useDeleteIdentityActor(),
      input: (row, { props }) => ({
        instanceId: props.instanceId,
        identityActorId: row.id
      })
    })
  ])
  .build();

export let IdentityActorsTable = (p: Parameters<typeof IdentityActorsList>[0]) => (
  <IdentityActorsList emptyState="No identity actors found." {...p} />
);
