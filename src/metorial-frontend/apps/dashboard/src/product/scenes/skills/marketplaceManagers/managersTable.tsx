import { col, createDataList, defineAction, f } from '@metorial/data-list';
import { useDeletePortalConsumerAccess } from '@metorial/state';
import { Badge } from '@metorial/ui';
import { RiEditLine } from '@remixicon/react';
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
};

let getSearchValues = (row: MarketplaceManagerRow) => [
  row.name,
  row.description,
  row.kind,
  row.scope.type == 'entire'
    ? 'entire marketplace'
    : row.scope.plugins.map(plugin => plugin.name).join(' ')
];

let openEditPanel = (row: MarketplaceManagerRow, props: MarketplaceManagersTableProps) =>
  showMarketplaceManagerPanel({
    instanceId: props.instanceId,
    skillMarketplaceId: row.skillMarketplaceId,
    portalId: row.portalId,
    consumerGroupId: row.consumerGroupId,
    edit: row,
    onSuccess: props.refetch
  });

let editAction = defineAction<MarketplaceManagerRow, MarketplaceManagersTableProps>({
  id: 'edit',
  label: 'Edit',
  icon: <RiEditLine />,
  useRun:
    ({ props }) =>
    row =>
      openEditPanel(row, props)
});

let removeAction = (description: (row: MarketplaceManagerRow) => string) =>
  defineAction<MarketplaceManagerRow, MarketplaceManagersTableProps>({
    id: 'remove',
    label: 'Remove',
    destructive: true,
    confirm: {
      title: 'Remove Marketplace Manager',
      confirmText: 'Remove',
      description: rows => description(rows[0]!)
    },
    useRun: ({ props }) => {
      let deleteAccess = useDeletePortalConsumerAccess();

      return async row => {
        let removed = await removeMarketplaceManager({
          instanceId: props.instanceId,
          portalId: row.portalId,
          row,
          deleteAccess
        });

        if (removed) props.refetch();
      };
    }
  });

let managersFilters = () => ({
  kind: f.select('kind', 'Kind', [
    { id: 'group', label: 'Access Group' },
    { id: 'account', label: 'Account' }
  ] as const)
});

let useManagerRows = ({
  props,
  filters
}: {
  props: MarketplaceManagersTableProps;
  filters: { kind?: ('group' | 'account')[] };
}) => ({
  items: props.rows.filter(row => !filters.kind?.length || filters.kind.includes(row.kind)),
  isLoading: props.isLoading,
  error: (props.error as any) ?? null
});

let accessColumn = col.custom<MarketplaceManagerRow>({
  id: 'access',
  header: 'Access',
  render: row => <MarketplaceManagerScopeBadges row={row} />
});

let marketplaceManagersPeopleTable = createDataList<MarketplaceManagersTableProps>(
  'marketplace-managers'
)
  .filters(managersFilters)
  .search('Search managers…')
  .items(useManagerRows, { searchFields: getSearchValues })
  .columns([
    col.name<MarketplaceManagerRow>({
      description: row => row.description || (row.kind == 'account' ? 'Account' : 'Access Group')
    }),
    col.custom<MarketplaceManagerRow>({
      id: 'kind',
      header: 'Kind',
      render: row => (
        <Badge color="gray" size="2">
          {row.kind == 'account' ? 'Account' : 'Access Group'}
        </Badge>
      )
    }),
    accessColumn
  ])
  .clickable(openEditPanel)
  .itemActions([
    editAction,
    removeAction(
      row =>
        `Remove ${row.name} as a Marketplace Manager? They will no longer be able to manage this marketplace.`
    )
  ])
  .build();

let groupMarketplaceManagersTable = createDataList<MarketplaceManagersTableProps>(
  'group-marketplace-managers'
)
  .items(
    ({ props }) => ({
      items: props.rows,
      isLoading: props.isLoading,
      error: (props.error as any) ?? null
    }),
    { searchFields: getSearchValues }
  )
  .search('Search marketplaces…')
  .columns([
    col.name<MarketplaceManagerRow>({ id: 'marketplace', header: 'Marketplace' }),
    accessColumn
  ])
  .clickable(openEditPanel)
  .itemActions([
    editAction,
    removeAction(row => `Remove this group as a Marketplace Manager of ${row.name}?`)
  ])
  .build();

export let MarketplaceManagersTable = (props: {
  instanceId: string;
  rows: MarketplaceManagerRow[];
  isLoading: boolean;
  error?: unknown;
  refetch: () => void;
  emptyState: string;
}) =>
  marketplaceManagersPeopleTable({
    ...props,
    variant: 'people',
    listVariant: 'embedded'
  });

export let GroupMarketplaceManagersTable = (props: {
  instanceId: string;
  rows: MarketplaceManagerRow[];
  isLoading: boolean;
  error?: unknown;
  refetch: () => void;
  emptyState: string;
}) =>
  groupMarketplaceManagersTable({
    ...props,
    variant: 'marketplaces',
    listVariant: 'embedded'
  });
