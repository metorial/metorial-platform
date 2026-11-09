import type { FilterPayload, TableFilter } from '@metorial/filter-bar';
import type React from 'react';
import type { Observer } from './state';
import type {
  DataListCustomLayout,
  DataListEnrichResult,
  DataListFilterDefs,
  DataListItemAction,
  DataListItemView,
  DataListSource,
  TableActions,
  TableColumn,
  TableItemAction
} from './types';

export type DataListConfig = {
  name: string;
  hasPagination: boolean;
  customizable: boolean;
  layoutObserver: Observer<{ id: string; isSelected: boolean }[]>;
  source: DataListSource;
  useContext?: (props: any) => any;
  enrich?: (items: any[], args: { props: any; ctx: any }) => DataListEnrichResult<any>;
  getHookState?: (res: any, input: any) => any;
  columns: TableColumn<any, any, any>[];
  actions?: TableActions<any, any>;
  rowActions?: TableItemAction<any, any>[];
  bulkActions?: TableItemAction<any, any>[];
  itemActions: DataListItemAction<any, any, any>[];
  filters?: TableFilter<any>[] | ((props: any, ctx: any) => DataListFilterDefs);
  search?: { placeholder: string };
  link?: (item: any, props: any, ctx: any) => string | null | undefined;
  clickable?: (row: any, props: any) => void;
  rowPanel?: (row: any) => React.ReactNode;
  headerActions?: (d: {
    filter: Record<string, FilterPayload>;
    search?: string;
  }) => React.ReactNode;
  item?: (row: any, props: any, ctx: any) => DataListItemView;
  layouts: string[];
  defaultLayout?: string;
  customLayouts: DataListCustomLayout<any>[];
  gridWidth?: string;
};
