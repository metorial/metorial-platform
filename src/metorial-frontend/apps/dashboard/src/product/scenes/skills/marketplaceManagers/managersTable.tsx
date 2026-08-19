import {
  useDeletePortalConsumerAccess
} from '@metorial/state';
import { Table } from '@metorial/table';
import {
  getEnumListFilterValue,
  type TableStateProvider,
  type TableStateProviderResult
} from '@metorial/table';
import { Badge, Flex, Text, confirm } from '@metorial/ui';
import { RiDeleteBinLine, RiEditLine } from '@remixicon/react';
import { useMemo } from 'react';
import { showMarketplaceManagerPanel } from './panel';
import { MarketplaceManagerScopeBadges, removeMarketplaceManager } from './shared';
import type { MarketplaceManagerRow } from './types';

export type MarketplaceManagersTableVariant = 'people' | 'marketplaces';

export type MarketplaceManagersTableProps = {
  instanceId: string;
  variant: MarketplaceManagersTableVariant;
  rows: MarketplaceManagerRow[];
  isLoading: boolean;
  error?: unknown;
  refetch: () => void;
  emptyState: string;
};

type MarketplaceManagersTableState = TableStateProviderResult<MarketplaceManagerRow> & {
  refetch: () => void;
};

let matchesSearch = (row: MarketplaceManagerRow, search?: string) => {
  if (!search) return true;

  let pluginNames =
    row.scope.type == 'plugins' ? row.scope.plugins.map(plugin => plugin.name).join(' ') : '';
  let hay = [
    row.name,
    row.description ?? '',
    row.kind,
    row.scope.type == 'entire' ? 'entire marketplace' : pluginNames
  ]
    .join(' ')
    .toLowerCase();

  return hay.includes(search.trim().toLowerCase());
};

let useMarketplaceManagersTableState: TableStateProvider<
  MarketplaceManagersTableProps,
  MarketplaceManagerRow,
  MarketplaceManagersTableState
> = (props, opts) => {
  let items = useMemo(() => {
    let kinds = getEnumListFilterValue(opts.filter.kind, ['group', 'account']);

    return props.rows.filter(row => {
      if (kinds?.length && !kinds.includes(row.kind)) return false;
      return matchesSearch(row, opts.search);
    });
  }, [opts.filter.kind, opts.search, props.rows]);

  return {
    isLoading: props.isLoading,
    error: (props.error as MarketplaceManagersTableState['error']) ?? null,
    items,
    hasMoreAfter: false,
    hasMoreBefore: false,
    loadNext: () => {},
    loadPrevious: () => {},
    refetch: props.refetch
  };
};

let useMarketplaceManagersTableHookState = (
  state: MarketplaceManagersTableState,
  props: MarketplaceManagersTableProps
) => {
  let deleteAccess = useDeletePortalConsumerAccess();

  return {
    instanceId: props.instanceId,
    variant: props.variant,
    refetch: state.refetch,
    deleteAccess
  };
};

type MarketplaceManagersHookState = ReturnType<typeof useMarketplaceManagersTableHookState>;

let marketplaceManagerActions = {
  edit: async (rows: MarketplaceManagerRow[], hookState: MarketplaceManagersHookState) => {
    let row = rows[0];
    if (!row) return;

    showMarketplaceManagerPanel({
      instanceId: hookState.instanceId,
      skillMarketplaceId: row.skillMarketplaceId,
      portalId: row.portalId,
      consumerGroupId: row.consumerGroupId,
      edit: row,
      onSuccess: hookState.refetch
    });
  },
  remove: async (rows: MarketplaceManagerRow[], hookState: MarketplaceManagersHookState) => {
    let row = rows[0];
    if (!row) return;

    confirm({
      title: 'Remove Marketplace Manager',
      description:
        hookState.variant == 'marketplaces'
          ? `Remove this group as a Marketplace Manager of ${row.name}?`
          : `Remove ${row.name} as a Marketplace Manager? They will no longer be able to manage this marketplace.`,
      confirmText: 'Remove',
      onConfirm: async () => {
        let removed = await removeMarketplaceManager({
          instanceId: hookState.instanceId,
          portalId: row.portalId,
          row,
          deleteAccess: hookState.deleteAccess
        });
        if (removed) hookState.refetch();
      }
    });
  }
};

let marketplaceManagerRowActions = [
  {
    id: 'edit',
    label: 'Edit',
    icon: <RiEditLine />,
    action: 'edit' as const
  },
  {
    id: 'remove',
    label: 'Remove',
    icon: <RiDeleteBinLine />,
    action: 'remove' as const
  }
];

let marketplaceManagersPeopleTable = new Table<
  MarketplaceManagersTableProps,
  MarketplaceManagerRow
>('marketplace-managers', { hasPagination: false })
  .state(useMarketplaceManagersTableState)
  .hookState(useMarketplaceManagersTableHookState)
  .columns([
    {
      id: 'name',
      isDefault: true,
      header: 'Name',
      render: row => (
        <Flex gap={2} direction="column">
          <Text size="2" weight="strong">
            {row.name}
          </Text>
          <Text size="1" color="gray600">
            {row.description || (row.kind == 'account' ? 'Account' : 'Group')}
          </Text>
        </Flex>
      )
    },
    {
      id: 'kind',
      isDefault: true,
      header: 'Kind',
      render: row => (
        <Badge color="gray" size="1">{row.kind == 'account' ? 'Account' : 'Group'}</Badge>
      )
    },
    {
      id: 'access',
      isDefault: true,
      header: 'Access',
      render: row => <MarketplaceManagerScopeBadges row={row} />
    }
  ])
  .filters([
    {
      id: 'kind',
      fields: ['kind'],
      label: 'Kind',
      description: 'Filter by kind',
      type: 'select',
      options: [
        { id: 'group', label: 'Group' },
        { id: 'account', label: 'Account' }
      ]
    }
  ])
  .search('Search managers…')
  .actions(marketplaceManagerActions)
  .rowActions(marketplaceManagerRowActions)
  .clickable((row, props) => {
    showMarketplaceManagerPanel({
      instanceId: props.instanceId,
      skillMarketplaceId: row.skillMarketplaceId,
      portalId: row.portalId,
      consumerGroupId: row.consumerGroupId,
      edit: row,
      onSuccess: props.refetch
    });
  })
  .build();

let groupMarketplaceManagersTable = new Table<
  MarketplaceManagersTableProps,
  MarketplaceManagerRow
>('group-marketplace-managers', { hasPagination: false })
  .state(useMarketplaceManagersTableState)
  .hookState(useMarketplaceManagersTableHookState)
  .columns([
    {
      id: 'marketplace',
      isDefault: true,
      header: 'Marketplace',
      render: row => (
        <Flex gap={2} direction="column">
          <Text size="2" weight="strong">
            {row.name}
          </Text>
          {row.description ? (
            <Text size="1" color="gray600">
              {row.description}
            </Text>
          ) : null}
        </Flex>
      )
    },
    {
      id: 'access',
      isDefault: true,
      header: 'Access',
      render: row => <MarketplaceManagerScopeBadges row={row} />
    }
  ])
  .search('Search marketplaces…')
  .actions(marketplaceManagerActions)
  .rowActions(marketplaceManagerRowActions)
  .clickable((row, props) => {
    showMarketplaceManagerPanel({
      instanceId: props.instanceId,
      skillMarketplaceId: row.skillMarketplaceId,
      portalId: row.portalId,
      consumerGroupId: row.consumerGroupId,
      edit: row,
      onSuccess: props.refetch
    });
  })
  .build();

export let MarketplaceManagersTable = (
  props: Omit<MarketplaceManagersTableProps, 'variant'>
) =>
  marketplaceManagersPeopleTable({
    ...props,
    variant: 'people'
  });

export let GroupMarketplaceManagersTable = (
  props: Omit<MarketplaceManagersTableProps, 'variant'>
) =>
  groupMarketplaceManagersTable({
    ...props,
    variant: 'marketplaces'
  });
