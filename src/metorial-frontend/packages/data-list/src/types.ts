import type { ServiceError } from '@lowerdeck/error';
import type { FilterPayload, TableFilter } from '@metorial/filter-bar';
import type React from 'react';

export type TableColumn<Item extends { id: string }, Input extends {} = any, Ctx = any> = {
  id: string;
  isDefault: boolean;
  header: React.ReactNode;
  render: (row: Item, input: Input, ctx: Ctx) => React.ReactNode;
};

export type TableClickable<Item extends { id: string }, Input extends {} = any> = (
  row: Item,
  input: Input
) => void;

export type TableStateProvider<
  Props,
  Item extends { id: string },
  Result extends TableStateProviderResult<Item>
> = (props: Props, opts: { filter: Record<string, FilterPayload>; search?: string }) => Result;

export type TableStateProviderResult<Item extends { id: string }> = {
  isLoading: boolean;
  error?: ServiceError<any> | null;
  hasMoreAfter: boolean;
  hasMoreBefore: boolean;
  items: Item[];
  loadNext: () => void;
  loadPrevious: () => void;
};

export type DataListVariant = 'page' | 'embedded' | 'preview';

export type DataListSourceOptions<FilterValues = any, Ctx = any> = {
  filter: Record<string, FilterPayload>;
  filters: FilterValues;
  search?: string;
  ctx: Ctx;
  limit?: number;
  variant: DataListVariant;
};

export type DataListSource<
  Props = any,
  Item extends { id: string } = any,
  FilterValues = any,
  Ctx = any
> = (
  props: Props,
  opts: DataListSourceOptions<FilterValues, Ctx>
) => TableStateProviderResult<Item>;

export type PaginatedLoaderResult<Item extends { id: string }> = {
  isLoading: boolean;
  error?: ServiceError<any> | null;
  data?: {
    items: Item[];
    pagination: { hasMoreAfter: boolean; hasMoreBefore: boolean };
  } | null;
  next: () => void;
  previous: () => void;
};

export type TableAction<Item, HooksState> = (
  rows: Item[],
  state: HooksState
) => Promise<{
  items: {
    id: string;
    isDeleted?: boolean;
  }[];
} | void>;

export type TableActions<Item, HooksState> = {
  [key: string]: TableAction<Item, HooksState>;
};

export type TableItemAction<Item, Actions extends TableActions<any, any>> = {
  id: string;
  label: string;
  hidden?: (row: Item) => boolean;
  icon: React.ReactNode;
  disabled?: (row: Item) => boolean;
  action: keyof Actions;
  bulkExecution?: {
    mode: 'per-row';
    batchSize?: number;
  };
};

export type DataListItemAction<Item, Props = any, Ctx = any> = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  row?: boolean;
  bulk?: boolean | { batchSize?: number; label?: string };
  destructive?: boolean;
  hidden?: (row: Item) => boolean;
  disabled?: (row: Item) => boolean;
  confirm?: {
    title: string;
    description: (rows: Item[]) => string;
    confirmText?: string;
  };
  useRun: (args: { props: Props; ctx: Ctx }) => (row: Item) => Promise<unknown> | unknown;
};

export type TableLayoutProps = {
  toolbarEnd?: React.ReactNode;
  topContent?: React.ReactNode;
  framed?: boolean;
};

export type DataListBuiltInLayout = 'table' | 'grid' | 'list';

export type DataListItemView = {
  title: React.ReactNode;
  description?: React.ReactNode;
  listDescription?: React.ReactNode | false;
  icon?: React.ReactNode;
  badges?: React.ReactNode;
  meta?: React.ReactNode;
  footer?: React.ReactNode;
  href?: string | null;
  onClick?: () => void;
  showCopyId?: boolean;
  height?: number;
};

export type DataListMenuItem = {
  id: string;
  label: string;
  disabled?: boolean;
  destructive?: boolean;
  onClick: () => void;
};

export type DataListItemProps = {
  href?: string;
  onClick?: () => void;
  menu: DataListMenuItem[];
  isSelected: boolean;
  isLoading: boolean;
};

export type DataListLayoutRenderArgs<Item extends { id: string }> = {
  items: Item[];
  getItemProps: (row: Item) => DataListItemProps;
  selectedIds: string[];
  isLoading: boolean;
};

export type DataListCustomLayout<Item extends { id: string } = any> = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  render: (args: DataListLayoutRenderArgs<Item>) => React.ReactNode;
};

export type DataListEmptyState =
  | string
  | (() => React.ReactNode)
  | {
      initial?: string | (() => React.ReactNode);
      filtered?: string;
      search?: string;
    };

export type DataListFilterDef<Value = unknown> = {
  filter: TableFilter<any>;
  parse: (payload: FilterPayload | undefined) => Value;
};

export type DataListFilterDefs = Record<string, DataListFilterDef<any>>;

export type DataListFilterValues<Defs extends DataListFilterDefs> = {
  [K in keyof Defs]: Defs[K] extends DataListFilterDef<infer V> ? V : never;
};

export type DataListEnrichResult<Item extends { id: string }> = {
  items: Item[];
  isLoading?: boolean;
  error?: ServiceError<any> | null;
};

export type DataListCommonProps<Item extends { id: string } = any> = {
  emptyState?: DataListEmptyState;
  sidePadding?: number;
  tableFilters?: TableFilter<Item>[];
  onItemClick?: (row: Item) => void;
  selectedItemId?: string;
  headerActions?: (d: {
    filter: Record<string, FilterPayload>;
    search?: string;
  }) => React.ReactNode;
  listVariant?: DataListVariant;
  listLayout?: string;
  listLayouts?: string[];
  listLimit?: number;
  viewAllHref?: string;
  hideToolbar?: boolean;
} & TableLayoutProps;
