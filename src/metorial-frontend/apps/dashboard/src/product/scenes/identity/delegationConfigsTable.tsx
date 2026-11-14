import {
  DashboardInstanceIdentitiesDelegationConfigsListOutput,
  DashboardInstanceIdentitiesDelegationConfigsListQuery
} from '@metorial/dashboard-sdk';
import {
  col,
  createDataList,
  deleteAction,
  EmptyValue,
  f,
  lifecycleStatus,
  withDefaults
} from '@metorial/data-list';
import { Paths } from '@metorial/frontend-config';
import {
  useDeleteIdentityDelegationConfig,
  useIdentityDelegationConfigs
} from '@metorial/state';
import { Badge } from '@metorial/ui';
import { useInstanceContext } from '../../lib/dataList';

type IdentityDelegationConfig =
  DashboardInstanceIdentitiesDelegationConfigsListOutput['items'][number];

type IdentityDelegationConfigFilters = Omit<
  DashboardInstanceIdentitiesDelegationConfigsListQuery,
  'limit' | 'after' | 'before' | 'cursor'
>;

let getDelegationBehaviorLabel = (
  behavior: IdentityDelegationConfig['subDelegationBehavior']
) => {
  if (behavior === 'require_consent') return 'Require Consent';
  if (behavior === 'allow') return 'Allow';
  return 'Deny';
};

let IdentityDelegationConfigsList = createDataList<{
  instanceId: string;
  filters?: IdentityDelegationConfigFilters;
}>('identity-delegation-configs')
  .context(useInstanceContext)
  .filters(() => ({
    status: f.status(lifecycleStatus),
    createdAt: f.createdAt(),
    updatedAt: f.updatedAt()
  }))
  .search('Search delegation configs…')
  .paginated(({ props, filters, search }) =>
    useIdentityDelegationConfigs(
      props.instanceId,
      withDefaults(props.filters, { order: 'desc' as const, ...filters, search })
    )
  )
  .columns([
    col.name(),
    col.text({
      id: 'behavior',
      header: 'Behavior',
      get: row => getDelegationBehaviorLabel(row.subDelegationBehavior)
    }),
    col.custom({
      id: 'default',
      header: 'Default',
      render: row => (row.isDefault ? <Badge color="blue">Default</Badge> : <EmptyValue />)
    }),
    col.status(lifecycleStatus, { isDefault: false }),
    col.text({
      id: 'depth',
      header: 'Depth',
      isDefault: false,
      get: row => row.subDelegationDepth
    }),
    col.createdAt(),
    col.updatedAt(),
    col.id({ header: 'Config ID' })
  ])
  .link((row, _props, ctx) =>
    Paths.organization.instance.identity.delegationConfig(
      ctx.organization,
      ctx.project,
      ctx.instance,
      row.id
    )
  )
  .itemActions([
    deleteAction({
      noun: 'Delegation Config',
      name: row => row.name,
      disabled: row => row.status !== 'active',
      useMutate: () => useDeleteIdentityDelegationConfig(),
      input: (row, { props }) => ({
        instanceId: props.instanceId,
        identityDelegationConfigId: row.id
      })
    })
  ])
  .build();

export let IdentityDelegationConfigsTable = (
  p: Parameters<typeof IdentityDelegationConfigsList>[0]
) => <IdentityDelegationConfigsList emptyState="No delegation configs found." {...p} />;
