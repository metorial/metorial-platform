import type { DashboardInstanceCallbackInstancesListQuery } from '@metorial/dashboard-sdk';
import { col, createDataList, f, lifecycleStatus, withDefaults } from '@metorial/data-list';
import { Paths } from '@metorial/frontend-config';
import { useCallbackInstances } from '@metorial/state';
import type { ComponentProps } from 'react';
import { useInstanceContext } from '../../lib/dataList';
import { entityFilters } from '../entityFilters';
import { CallbackSyncBadge } from './shared';

export type CallbackInstancesFilters = Omit<
  DashboardInstanceCallbackInstancesListQuery,
  'limit' | 'after' | 'before' | 'cursor'
>;

let CallbackInstancesList = createDataList<{
  instanceId?: string;
  filters?: CallbackInstancesFilters;
}>('callback-instances')
  .context(useInstanceContext)
  .filters((props, ctx) => ({
    status: f.status(lifecycleStatus),
    integrationInstanceId: f.entity(
      entityFilters.integrationInstance(props.instanceId ?? ctx.instanceId)
    ),
    createdAt: f.createdAt(),
    updatedAt: f.updatedAt()
  }))
  .paginated(({ props, ctx, filters }) =>
    useCallbackInstances(
      props.instanceId ?? ctx.instanceId,
      withDefaults(props.filters, { order: 'desc' as const, ...filters })
    )
  )
  .columns([
    col.refId('integrationInstance', row => row.integrationInstanceId, {
      header: 'Integration Instance',
      isDefault: true
    }),
    col.custom({
      id: 'registration',
      header: 'Registration',
      render: row => <CallbackSyncBadge sync={row.sync} />
    }),
    col.status(lifecycleStatus, { isDefault: false }),
    col.createdAt(),
    col.updatedAt(),
    col.id()
  ])
  .link((row, _props, ctx) =>
    Paths.instance.integrationInstance(
      ctx.organization,
      ctx.project,
      ctx.instance,
      row.integrationInstanceId
    )
  )
  .build();

export let CallbackInstancesTable = (props: ComponentProps<typeof CallbackInstancesList>) => (
  <CallbackInstancesList
    emptyState={{
      initial: 'This callback is not registered for any integration instance yet.',
      filtered: 'No registrations match your filters.'
    }}
    {...props}
  />
);
