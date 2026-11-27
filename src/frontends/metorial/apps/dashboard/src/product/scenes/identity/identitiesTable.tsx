import {
  DashboardInstanceIdentitiesListOutput,
  DashboardInstanceIdentitiesListQuery
} from '@metorial/dashboard-sdk';
import {
  col,
  createDataList,
  deleteAction,
  f,
  lifecycleStatus,
  withDefaults
} from '@metorial/data-list';
import { useDeleteIdentity, useIdentities } from '@metorial/state';
import { useInstanceContext } from '../../lib/dataList';
import { useIdentityPaths } from '../../lib/identityPaths';
import { entityFilters } from '../entityFilters';

type Identity = DashboardInstanceIdentitiesListOutput['items'][number];

type IdentityFilters = Omit<
  DashboardInstanceIdentitiesListQuery,
  'limit' | 'after' | 'before' | 'cursor'
>;

let IdentitiesList = createDataList<{
  instanceId: string;
  filters?: IdentityFilters;
}>('identities')
  .context(() => ({ ...useInstanceContext(), identityPaths: useIdentityPaths() }))
  .filters(props => ({
    status: f.status(lifecycleStatus),
    actorId: f.entity(entityFilters.actor(props.instanceId)),
    agentId: f.entity(entityFilters.agent(props.instanceId)),
    createdAt: f.createdAt(),
    updatedAt: f.updatedAt()
  }))
  .search('Search identities…')
  .paginated(({ props, filters, search }) =>
    useIdentities(
      props.instanceId,
      withDefaults(props.filters, { order: 'desc' as const, ...filters, search })
    )
  )
  .columns([
    col.name(),
    col.twoLine({
      id: 'owner',
      header: 'Owner',
      primary: (row: Identity) => row.owner.actor.name,
      secondary: row => row.owner.actor.type
    }),
    col.status(lifecycleStatus, { isDefault: false }),
    col.refId('ownerActorId', row => row.owner.actor.id, { header: 'Owner Actor ID' }),
    col.refId('ownerAgentId', row => row.owner.actor.agentId, { header: 'Owner Agent ID' }),
    col.text({
      id: 'credentials',
      header: 'Credentials',
      isDefault: false,
      get: row => row.credentials.length
    }),
    col.refId('delegationConfigId', row => row.delegationConfigId, {
      header: 'Delegation Config'
    }),
    col.createdAt(),
    col.updatedAt(),
    col.id({ header: 'Identity ID' })
  ])
  .link((row, _props, ctx) =>
    ctx.identityPaths.identity(ctx.organization, ctx.project, ctx.instance, row.id)
  )
  .itemActions([
    deleteAction({
      noun: 'Identity',
      name: row => row.name,
      disabled: row => row.status !== 'active',
      useMutate: () => useDeleteIdentity(),
      input: (row, { props }) => ({
        instanceId: props.instanceId,
        identityId: row.id
      })
    })
  ])
  .build();

export let IdentitiesTable = (p: Parameters<typeof IdentitiesList>[0]) => (
  <IdentitiesList emptyState="No identities found." {...p} />
);
