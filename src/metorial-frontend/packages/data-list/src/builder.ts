import type { FilterPayload, TableFilter } from '@metorial/filter-bar';
import React from 'react';
import { DataListComponent } from './components/shell';
import type { DataListConfig } from './config';
import { paginatedState, useClientItemsState, type ItemsSourceOptions } from './helpers/state';
import { Observer } from './state';
import type {
  DataListCommonProps,
  DataListCustomLayout,
  DataListEnrichResult,
  DataListFilterDefs,
  DataListFilterValues,
  DataListItemAction,
  DataListItemView,
  DataListSourceOptions,
  PaginatedLoaderResult,
  TableActions,
  TableClickable,
  TableColumn,
  TableItemAction,
  TableStateProvider,
  TableStateProviderResult
} from './types';

type SourceArgs<Props, FilterValues, Ctx> = DataListSourceOptions<FilterValues, Ctx> & {
  props: Props;
};

export class DataList<
  StateProps extends object = {},
  Item extends { id: string } = any,
  HooksState = {},
  Actions extends TableActions<Item, HooksState> = {},
  StateResult extends TableStateProviderResult<Item> = any,
  Ctx = {},
  FilterValues = {}
> {
  private layoutObserver: Observer<{ id: string; isSelected: boolean }[]> = new Observer();

  protected opts: DataListConfig;

  constructor(
    name: string,
    opts?: {
      hasPagination?: boolean;
      customizable?: boolean;
    }
  ) {
    this.opts = {
      name,
      hasPagination: opts?.hasPagination !== false,
      customizable: opts?.customizable !== false,
      layoutObserver: this.layoutObserver,
      source: () => {
        throw new Error('No data source configured. Use .paginated(), .items() or .state().');
      },
      columns: [],
      itemActions: [],
      layouts: [],
      customLayouts: []
    };
  }

  context<NewCtx>(useContext: (props: StateProps) => NewCtx) {
    this.opts.useContext = useContext;
    return this as any as DataList<
      StateProps,
      Item,
      HooksState,
      Actions,
      StateResult,
      NewCtx,
      FilterValues
    >;
  }

  paginated<NewItem extends { id: string }, NewProps extends object = StateProps>(
    useLoader: (
      args: SourceArgs<NewProps, FilterValues, Ctx>
    ) => PaginatedLoaderResult<NewItem>
  ) {
    this.opts.source = (props, opts) => paginatedState(useLoader({ props, ...opts } as any));

    return this as any as DataList<
      NewProps,
      NewItem,
      HooksState,
      {},
      TableStateProviderResult<NewItem>,
      Ctx,
      FilterValues
    >;
  }

  items<NewItem extends { id: string }, NewProps extends object = StateProps>(
    useItems: (args: SourceArgs<NewProps, FilterValues, Ctx>) => {
      items: NewItem[];
      isLoading?: boolean;
      error?: TableStateProviderResult<NewItem>['error'];
    },
    itemsOpts: ItemsSourceOptions<NewItem> = {}
  ) {
    this.opts.hasPagination = !!itemsOpts.pageSize;

    this.opts.source = (props, opts) =>
      useClientItemsState(useItems({ props, ...opts } as any), opts.search, itemsOpts);

    return this as any as DataList<
      NewProps,
      NewItem,
      HooksState,
      {},
      TableStateProviderResult<NewItem>,
      Ctx,
      FilterValues
    >;
  }

  state<
    NewStateProps extends object,
    NewItem extends { id: string },
    NewResult extends TableStateProviderResult<NewItem>
  >(state: TableStateProvider<NewStateProps, NewItem, NewResult>) {
    this.opts.source = (props, opts) =>
      state(props, { filter: opts.filter, search: opts.search });

    return this as any as DataList<
      NewStateProps,
      NewItem,
      HooksState,
      {},
      NewResult,
      Ctx,
      FilterValues
    >;
  }

  enrich<NewItem extends { id: string }>(
    useEnrich: (
      items: Item[],
      args: { props: StateProps; ctx: Ctx }
    ) => DataListEnrichResult<NewItem>
  ) {
    this.opts.enrich = useEnrich as any;

    return this as any as DataList<
      StateProps,
      NewItem,
      HooksState,
      {},
      TableStateProviderResult<NewItem>,
      Ctx,
      FilterValues
    >;
  }

  columns(columns: TableColumn<Item, StateProps, Ctx>[]) {
    this.opts.columns.push(...columns);

    this.layoutObserver.notify(
      this.opts.columns.map(c => ({ id: c.id, isSelected: c.isDefault }))
    );

    return this;
  }

  link(link: (item: Item, props: StateProps, ctx: Ctx) => string | null | undefined) {
    this.opts.link = link;
    return this;
  }

  clickable(clickable: TableClickable<Item, StateProps>) {
    this.opts.clickable = clickable;
    return this;
  }

  filters(filters: TableFilter<Item>[]): this;
  filters<Defs extends DataListFilterDefs>(
    factory: (props: StateProps, ctx: Ctx) => Defs
  ): DataList<
    StateProps,
    Item,
    HooksState,
    Actions,
    StateResult,
    Ctx,
    DataListFilterValues<Defs>
  >;
  filters(filters: any) {
    this.opts.filters = filters;
    return this as any;
  }

  search(placeholder: string) {
    this.opts.search = { placeholder };
    return this;
  }

  headerActions(
    headerActions: (d: {
      filter: Record<string, FilterPayload>;
      search?: string;
    }) => React.ReactNode
  ) {
    this.opts.headerActions = headerActions;
    return this;
  }

  rowPanel(rowPanel: (row: Item) => React.ReactNode) {
    this.opts.rowPanel = rowPanel;
    return this;
  }

  item(item: (row: Item, props: StateProps, ctx: Ctx) => DataListItemView) {
    this.opts.item = item;
    return this;
  }

  layouts(
    layouts: ('table' | 'grid' | 'list')[],
    opts?: { default?: string; gridWidth?: string }
  ) {
    this.opts.layouts = [
      ...layouts,
      ...this.opts.customLayouts
        .map(layout => layout.id)
        .filter(id => !layouts.includes(id as any))
    ];
    if (opts?.default) this.opts.defaultLayout = opts.default;
    if (opts?.gridWidth) this.opts.gridWidth = opts.gridWidth;
    return this;
  }

  layout(id: string, layout: Omit<DataListCustomLayout<Item>, 'id'>) {
    this.opts.customLayouts.push({ id, ...layout } as DataListCustomLayout<any>);
    if (!this.opts.layouts.includes(id)) this.opts.layouts.push(id);
    return this;
  }

  itemActions(actions: DataListItemAction<Item, StateProps, Ctx>[]) {
    this.opts.itemActions = actions;
    return this;
  }

  hookState<NewHooksState>(
    getHookState: (res: StateResult, input: StateProps) => NewHooksState
  ) {
    this.opts.getHookState = getHookState;
    return this as any as DataList<
      StateProps,
      StateResult['items'][number],
      NewHooksState,
      {},
      StateResult,
      Ctx,
      FilterValues
    >;
  }

  actions<NewActions extends TableActions<Item, HooksState>>(actions: NewActions) {
    this.opts.actions = {
      ...this.opts.actions,
      ...actions
    };

    return this as any as DataList<
      StateProps,
      Item,
      HooksState,
      NewActions & Actions,
      StateResult,
      Ctx,
      FilterValues
    >;
  }

  rowActions(rowActions: TableItemAction<Item, Actions>[]) {
    this.opts.rowActions = rowActions;
    return this;
  }

  bulkActions(bulkActions: TableItemAction<Item, Actions>[]) {
    this.opts.bulkActions = bulkActions;
    return this;
  }

  build() {
    let config: DataListConfig = {
      ...this.opts,
      layouts: this.opts.layouts.length > 0 ? this.opts.layouts : ['table']
    };

    return (props: StateProps & DataListCommonProps<Item>) =>
      React.createElement(DataListComponent, { config, props });
  }
}

export let createDataList = <StateProps extends object = {}>(
  name: string,
  opts?: { hasPagination?: boolean; customizable?: boolean }
) => new DataList<StateProps>(name, opts);
