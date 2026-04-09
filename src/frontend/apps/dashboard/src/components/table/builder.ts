import React from 'react';
import { TableComponent } from './components';
import { FilterPayload, TableFilter } from './filter';
import { Observer } from './state';
import {
  TableActions,
  TableClickable,
  TableColumn,
  TableItemAction,
  TableStateProvider,
  TableStateProviderResult
} from './type';

export class Table<
  StateProps extends object = {},
  Item extends { id: string } = any,
  HooksState = {},
  Actions extends TableActions<Item, HooksState> = {},
  StateResult extends TableStateProviderResult<Item> = any
> {
  private layoutObserver: Observer<{ id: string; isSelected: boolean }[]> = new Observer();

  private opts: {
    name: string;
    state: TableStateProvider<StateProps, Item, StateResult>;
    getHookState?: (res: StateResult, input: StateProps) => HooksState;
    columns: TableColumn<Item, StateProps>[];
    actions?: Actions;
    rowActions?: TableItemAction<Item, Actions>[];
    bulkActions?: TableItemAction<Item, Actions>[];
    filters?: TableFilter<Item>[];
    search?: { placeholder: string };
    link?: (item: Item, input: StateProps) => string;
    clickable?: TableClickable<Item, StateProps>;
    hasPagination: boolean;
    customizable: boolean;
    rowPanel?: (row: Item) => React.ReactNode;
    headerActions?: (d: {
      filter: Record<string, FilterPayload>;
      search?: string;
    }) => React.ReactNode;
  };

  constructor(
    name: string,
    opts?: {
      hasPagination?: boolean;
      customizable?: boolean;
    }
  ) {
    this.opts = {
      hasPagination: opts?.hasPagination !== false,
      customizable: opts?.customizable !== false,
      name,
      columns: [],
      state: () => {
        throw new Error('Not implemented');
      }
    };
  }

  columns(columns: TableColumn<Item, StateProps>[]) {
    this.opts.columns.push(...columns);

    this.layoutObserver.notify(columns.map(c => ({ id: c.id, isSelected: c.isDefault })));

    return this;
  }

  link(link: (item: Item, input: StateProps) => string) {
    this.opts.link = link;
    return this;
  }

  clickable(clickable: TableClickable<Item, StateProps>) {
    this.opts.clickable = clickable;
    return this;
  }

  state<
    NewStateProps extends object,
    NewItem extends { id: string },
    NewResult extends TableStateProviderResult<NewItem>
  >(state: TableStateProvider<NewStateProps, NewItem, NewResult>) {
    // @ts-ignore
    this.opts.state = state;

    return this as any as Table<NewStateProps, NewItem, HooksState, {}, NewResult>;
  }

  hookState<NewHooksState>(
    getHookState: (res: StateResult, input: StateProps) => NewHooksState
  ) {
    // @ts-ignore
    this.opts.getHookState = getHookState;
    return this as any as Table<
      StateProps,
      StateResult['items'][number],
      NewHooksState,
      {},
      StateResult
    >;
  }

  actions<NewActions extends TableActions<Item, HooksState>>(actions: NewActions) {
    // @ts-ignore
    this.opts.actions = {
      ...this.opts.actions,
      ...actions
    };

    return this as any as Table<
      StateProps,
      Item,
      HooksState,
      NewActions & Actions,
      StateResult
    >;
  }

  rowPanel(rowPanel: (row: Item) => React.ReactNode) {
    this.opts.rowPanel = rowPanel;
    return this;
  }

  rowActions(rowActions: TableItemAction<Item, Actions>[]) {
    this.opts.rowActions = rowActions;
    return this;
  }

  bulkActions(bulkActions: TableItemAction<Item, Actions>[]) {
    this.opts.bulkActions = bulkActions;
    return this;
  }

  filters(filters: TableFilter<Item>[]) {
    this.opts.filters = filters;
    return this;
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

  build() {
    let opts = {
      ...this.opts,
      layoutObserver: this.layoutObserver
    };

    return (
      props: StateProps & {
        emptyState?: (() => React.ReactNode) | string;
        sidePadding?: number;
        onItemClick?: (row: Item) => void;
        selectedItemId?: string;
        headerActions?: (d: {
          filter: Record<string, FilterPayload>;
          search?: string;
        }) => React.ReactNode;
      }
    ) => {
      return React.createElement(TableComponent, {
        ...opts,
        sidePadding: props.sidePadding,
        emptyState: props.emptyState,
        props,
        clickable: opts.clickable,
        onItemClick: props.onItemClick,
        selectedItemId: props.selectedItemId,
        headerActions: props.headerActions ?? opts.headerActions
      });
    };
  }
}
