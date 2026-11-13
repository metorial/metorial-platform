import type { DashboardInstanceCallbacksListQuery } from '@metorial/dashboard-sdk';
import {
  col,
  createDataList,
  EmptyValue,
  f,
  lifecycleStatus,
  withDefaults
} from '@metorial/data-list';
import { Paths } from '@metorial/frontend-config';
import { useCallbacks } from '@metorial/state';
import { Avatar, RenderDate, Text } from '@metorial/ui';
import type { ComponentProps } from 'react';
import { useInstanceContext } from '../../lib/dataList';
import { entityFilters } from '../entityFilters';
import { CallbackSyncBadge } from './shared';

export type CallbacksFilters = Omit<
  DashboardInstanceCallbacksListQuery,
  'limit' | 'after' | 'before' | 'cursor'
>;

export let CallbacksList = createDataList<{
  instanceId?: string;
  filters?: CallbacksFilters;
}>('callbacks')
  .context(useInstanceContext)
  .filters((props, ctx) => {
    let instanceId = props.instanceId ?? ctx.instanceId;

    return {
      status: f.status(lifecycleStatus),
      integrationId: f.entity(entityFilters.integration(instanceId)),
      providerId: f.entity(entityFilters.provider(instanceId)),
      createdAt: f.createdAt()
    };
  })
  .search('Search callbacks…')
  .paginated(({ props, ctx, filters, search }) =>
    useCallbacks(
      props.instanceId ?? ctx.instanceId,
      withDefaults(props.filters, { order: 'desc' as const, ...filters, search })
    )
  )
  .columns([
    col.name({ header: 'Callback', description: row => row.provider.name }),
    col.custom({
      id: 'sync',
      header: 'Delivery',
      isDefault: false,
      render: row => <CallbackSyncBadge sync={row.sync} />
    }),
    col.refId('integration', row => row.integrationId, {
      header: 'Integration',
      isDefault: false
    }),
    col.status(lifecycleStatus, { isDefault: false }),
    col.custom({
      id: 'syncedAt',
      header: 'Last Registered',
      isDefault: false,
      render: row =>
        row.sync.syncedAt ? (
          <RenderDate date={row.sync.syncedAt} />
        ) : (
          <EmptyValue>Never</EmptyValue>
        )
    }),
    col.createdAt(),
    col.id({ header: 'Callback ID', isDefault: true })
  ])
  .link((row, _props, ctx) =>
    Paths.instance.callback(ctx.organization, ctx.project, ctx.instance, row.id)
  )
  .item(row => ({
    title: row.name,
    icon: (
      <Avatar
        entity={{ name: row.name, imageUrl: `https://avatar-cdn.metorial.com/${row.id}` }}
        size={30}
      />
    ),
    footer: <Text size="1">{row.provider.name}</Text>,
    height: 200
  }))
  .layouts(['grid', 'table'], { default: 'grid', gridWidth: '300px' })
  .build();

export let CallbacksTable = (props: ComponentProps<typeof CallbacksList>) => (
  <CallbacksList
    emptyState={{
      initial:
        'No callbacks yet. Enable callbacks on an integration provider to start receiving provider events.',
      filtered: 'No callbacks match your filters.'
    }}
    {...props}
  />
);
