import { memo } from '@lowerdeck/memo';
import {
  getFilterPayload,
  type FilterPayload,
  type TableFilter,
  type TableFilterState
} from '@metorial/filter-bar';
import { confirm, toast } from '@metorial/ui';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { DataListConfig } from './config';
import { readFilterPayload } from './helpers/filters';
import { useObserver } from './state';
import {
  getStoredColumnLayout,
  sanitizeColumnLayout,
  storeColumnLayout,
  useLayoutView
} from './lib/layoutState';
import { useFilterQuery } from './lib/query';
import type {
  DataListCommonProps,
  DataListCustomLayout,
  DataListItemAction,
  DataListItemProps,
  DataListMenuItem,
  DataListVariant,
  TableItemAction,
  TableStateProviderResult
} from './types';

let noFilters: TableFilter<any>[] = [];
let emptyContext = {};

let chunk = <T>(items: T[], size: number) => {
  let chunks: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }

  return chunks;
};

let isPlainObject = (value: unknown) =>
  typeof value == 'object' &&
  value !== null &&
  Object.getPrototypeOf(value) === Object.prototype;

let getStableKey = (props: Record<string, unknown>) => {
  try {
    return JSON.stringify(
      Object.keys(props)
        .sort()
        .filter(key => {
          let value = props[key];
          let type = typeof value;
          return (
            type == 'string' ||
            type == 'number' ||
            type == 'boolean' ||
            type == 'undefined' ||
            value === null ||
            isPlainObject(value)
          );
        })
        .map(key => [key, props[key] ?? null])
    );
  } catch {
    return '';
  }
};

export type DataListBulkEntry = {
  id: string;
  label: string;
  disabled?: (row: any) => boolean;
  run: (rows: any[]) => Promise<void>;
};

export type DataListLayoutOption = {
  id: string;
  label: string;
  kind: 'table' | 'grid' | 'list' | 'custom';
  custom?: DataListCustomLayout<any>;
};

let builtInLabels: Record<string, string> = { table: 'Table', grid: 'Grid', list: 'List' };

export let useDataListController = (
  config: DataListConfig,
  props: Record<string, any> & DataListCommonProps
) => {
  let variant: DataListVariant = props.listVariant ?? 'page';
  let ctx = config.useContext ? config.useContext(props) : emptyContext;

  let filterState = useState([] as TableFilterState[]);
  let [search, setSearch] = useState('');
  let [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    let to = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(to);
  }, [search]);

  let filtersKey = `${getStableKey(props)}|${getStableKey(ctx as Record<string, unknown>)}`;
  let filterDefs = useMemo(
    () => (typeof config.filters == 'function' ? config.filters(props, ctx) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config.filters, filtersKey]
  );

  let filters = useMemo(
    () =>
      props.tableFilters ??
      (filterDefs
        ? Object.values(filterDefs).map(def => def.filter)
        : (config.filters as TableFilter<any>[] | undefined)) ??
      noFilters,
    [props.tableFilters, filterDefs, config.filters]
  );

  let filterPayload = useMemo(() => getFilterPayload(filterState[0]), [filterState[0]]);

  let parsedFilters = useMemo(() => {
    if (!filterDefs) return {};

    return Object.fromEntries(
      Object.entries(filterDefs).map(([key, def]) => [
        key,
        readFilterPayload(def, filterPayload)
      ])
    );
  }, [filterDefs, filterPayload]);

  let syncUrl = variant == 'page' && !props.hideToolbar;

  useFilterQuery({
    filters: syncUrl ? filters : noFilters,
    filterState,
    searchState: [search, setSearch],
    debouncedSearch
  });

  let source = config.source(props, {
    filter: filterPayload,
    filters: parsedFilters,
    search: debouncedSearch || undefined,
    ctx,
    limit: props.listLimit,
    variant
  });

  let enriched = config.enrich ? config.enrich(source.items, { props, ctx }) : null;

  let items = useMemo(() => {
    let current = enriched ? enriched.items : source.items;
    if (variant == 'preview' && props.listLimit) return current.slice(0, props.listLimit);
    return current;
  }, [enriched?.items, source.items, variant, props.listLimit]);

  let state: TableStateProviderResult<any> = {
    ...source,
    items,
    isLoading: source.isLoading || !!enriched?.isLoading,
    error: source.error ?? enriched?.error
  };

  let hookState = config.getHookState ? config.getHookState(source, props) : {};
  let [runningIds, setRunningIds] = useState<string[]>([]);
  let loadingIds: string[] = useMemo(
    () => [...(hookState.loadingIds ?? []), ...runningIds],
    [hookState.loadingIds, runningIds]
  );

  let itemRuns = config.itemActions.map(action => action.useRun({ props, ctx }));
  let itemCompletions = config.itemActions.map(action =>
    action.useOnComplete?.({ props, ctx })
  );

  let [initialLoading, setInitialLoading] = useState(true);
  useEffect(() => {
    if (!state.isLoading) setInitialLoading(false);
  }, [state.isLoading]);

  let layoutOptions = useMemo(() => {
    let options: DataListLayoutOption[] = [];

    for (let id of config.layouts) {
      let custom = config.customLayouts.find(layout => layout.id == id);

      if (custom) {
        options.push({ id, label: custom.label, kind: 'custom', custom });
      } else if (id == 'table' && config.columns.length > 0) {
        options.push({ id, label: builtInLabels.table!, kind: 'table' });
      } else if ((id == 'grid' || id == 'list') && config.item) {
        options.push({ id, label: builtInLabels[id]!, kind: id });
      }
    }

    if (props.listLayouts) {
      let allowed = options.filter(option => props.listLayouts!.includes(option.id));
      if (allowed.length > 0) options = allowed;
    }

    return options;
  }, [config.layouts, config.customLayouts, config.columns, config.item, props.listLayouts]);

  let [viewId, setViewId] = useLayoutView({
    name: config.name,
    available: layoutOptions.map(option => option.id),
    defaultView: config.defaultLayout ?? layoutOptions[0]?.id ?? 'table',
    forced: props.listLayout,
    syncUrl: variant == 'page'
  });

  let activeLayout = layoutOptions.find(option => option.id == viewId) ?? layoutOptions[0];
  let isTable = activeLayout?.kind == 'table';

  let columnLayout = useObserver(config.layoutObserver);
  let [hasHydratedColumns, setHasHydratedColumns] = useState(false);

  useEffect(() => {
    config.layoutObserver.notify(getStoredColumnLayout(config.name, config.columns));
    setHasHydratedColumns(true);
  }, [config.columns, config.layoutObserver, config.name]);

  useEffect(() => {
    if (!hasHydratedColumns || typeof window == 'undefined' || !columnLayout) return;
    storeColumnLayout(config.name, sanitizeColumnLayout(columnLayout, config.columns));
  }, [hasHydratedColumns, columnLayout, config.columns, config.name]);

  let currentColumns = useMemo(
    () =>
      columnLayout
        ? columnLayout
            .filter(c => c.isSelected)
            .map(c => config.columns.find(col => col.id == c.id))
            .filter((column): column is NonNullable<typeof column> => !!column)
        : [],
    [columnLayout, config.columns]
  );

  let [selectedItems, setSelectedItems] = useState<string[]>([]);

  useEffect(() => {
    let kept = selectedItems.filter(id => state.items.find(i => i.id == id));
    if (kept.length != selectedItems.length) setSelectedItems(kept);
  }, [state.items]);

  let [openRowPanel, setOpenRowPanel] = useState<string[]>([]);
  let [runningBulkActionId, setRunningBulkActionId] = useState<string | null>(null);

  let link = useMemo(
    () => (config.link ? memo(config.link as any) || undefined : undefined),
    [config.link]
  ) as ((row: any, props: any, ctx: any) => string | null | undefined) | undefined;

  let setRunning = (ids: string[], running: boolean) =>
    setRunningIds(current =>
      running ? [...new Set([...current, ...ids])] : current.filter(id => !ids.includes(id))
    );

  let runLegacyAction = async (action: TableItemAction<any, any>, rows: any[]) => {
    if (!config.actions) return;

    if (action.bulkExecution?.mode === 'per-row') {
      let batchSize = action.bulkExecution.batchSize ?? 10;

      for (let batch of chunk(rows, batchSize)) {
        await Promise.allSettled(
          batch.map(row => config.actions![action.action as string]!([row], hookState))
        );
      }

      return;
    }

    await config.actions[action.action as string]!(rows, hookState);
  };

  let runItemAction = async (action: DataListItemAction<any>, rows: any[]): Promise<void> => {
    let run = itemRuns[config.itemActions.indexOf(action)];
    if (!run || rows.length == 0) return;

    let input: unknown;
    if (action.bulkInput) {
      input = await action.bulkInput(rows, { props, ctx });
      if (input === null || input === undefined) return;
    }

    let execute = async () => {
      let ids = rows.map(row => row.id);
      setRunning(ids, true);

      let failures = 0;
      let firstError: unknown;

      try {
        let batchSize = typeof action.bulk == 'object' ? (action.bulk.batchSize ?? 10) : 10;

        for (let batch of chunk(rows, batchSize)) {
          let results = await Promise.allSettled(batch.map(row => run(row, input)));
          for (let result of results) {
            if (result.status == 'rejected') {
              failures++;
              firstError ??= result.reason;
            }
          }
        }
      } finally {
        setRunning(ids, false);
      }

      itemCompletions[config.itemActions.indexOf(action)]?.({ rows, input, failures });

      if (failures > 0) {
        toast.error(
          rows.length > 1
            ? `${action.label} failed for ${failures} of ${rows.length} items`
            : firstError instanceof Error
              ? firstError.message
              : `${action.label} failed`
        );
      }
    };

    let confirmation = action.confirm;
    if (!confirmation) return execute();

    return new Promise<void>(resolve =>
      confirm({
        title: confirmation.title,
        description: confirmation.description(rows),
        confirmText: confirmation.confirmText ?? action.label,
        onConfirm: () => void execute().finally(resolve),
        onCancel: resolve
      })
    );
  };

  let getRowMenu = (row: any): DataListMenuItem[] => {
    let menu: DataListMenuItem[] = [];

    for (let action of config.itemActions) {
      if (action.row === false || action.hidden?.(row)) continue;

      menu.push({
        id: action.id,
        label: action.label,
        disabled: action.disabled?.(row),
        destructive: action.destructive,
        onClick: () => void runItemAction(action, [row])
      });
    }

    for (let action of config.rowActions ?? []) {
      if (action.hidden?.(row)) continue;

      menu.push({
        id: action.id,
        label: action.label,
        disabled: action.disabled?.(row),
        onClick: () => void runLegacyAction(action, [row])
      });
    }

    return menu;
  };

  let bulkEntries: DataListBulkEntry[] = [
    ...config.itemActions
      .filter(action => !!action.bulk)
      .map(action => ({
        id: action.id,
        label:
          typeof action.bulk == 'object' ? (action.bulk.label ?? action.label) : action.label,
        disabled: action.disabled,
        run: (rows: any[]) => runItemAction(action, rows)
      })),
    ...(config.bulkActions ?? []).map(action => ({
      id: action.id,
      label: action.label,
      disabled: action.disabled,
      run: (rows: any[]) => runLegacyAction(action, rows)
    }))
  ];

  let hasRowActions =
    config.itemActions.some(a => a.row !== false) || (config.rowActions ?? []).length > 0;

  let getHref = (row: any) => link?.(row, props, ctx) ?? undefined;

  let getItemProps = (row: any): DataListItemProps => ({
    href: getHref(row) ?? undefined,
    onClick: config.clickable
      ? () => config.clickable!(row, props)
      : props.onItemClick
        ? () => props.onItemClick?.(row)
        : undefined,
    menu: getRowMenu(row).filter(item => !item.disabled),
    isSelected: selectedItems.includes(row.id) || props.selectedItemId == row.id,
    isLoading: loadingIds.includes(row.id)
  });

  let selectionAnchor = useRef<string | null>(null);

  let toggleSelected = (id: string, range?: boolean) => {
    let anchor = selectionAnchor.current;
    selectionAnchor.current = id;

    if (range && anchor) {
      let from = state.items.findIndex(i => i.id == anchor);
      let to = state.items.findIndex(i => i.id == id);

      if (from != -1 && to != -1) {
        let ids = state.items.slice(Math.min(from, to), Math.max(from, to) + 1).map(i => i.id);
        setSelectedItems(current => [...new Set([...current, ...ids])]);
        return;
      }
    }

    setSelectedItems(current =>
      current.includes(id) ? current.filter(i => i != id) : [...current, id]
    );
  };

  let handleRowClick = (e: React.MouseEvent, row: any) => {
    props.onItemClick?.(row);

    if (e.shiftKey) {
      let current = state.items.findIndex(i => i.id == row.id);
      let last = state.items.findIndex(i => i.id == selectedItems[0]);

      if (last == -1) {
        setSelectedItems([row.id]);
      } else {
        let start = Math.min(current, last);
        let end = Math.max(current, last);
        setSelectedItems(state.items.slice(start, end + 1).map(i => i.id));
      }
    } else if (e.ctrlKey) {
      setSelectedItems(current =>
        current.includes(row.id) ? current.filter(i => i != row.id) : [...current, row.id]
      );
    } else {
      config.clickable?.(row, props);

      if (config.rowPanel) {
        setOpenRowPanel(p =>
          p.includes(row.id) ? p.filter(id => id != row.id) : [...p, row.id]
        );
      }
    }
  };

  let hasActiveSearch = search.trim().length > 0 || debouncedSearch.trim().length > 0;
  let hasActiveFilters = filterState[0].length > 0;

  return {
    config,
    props,
    ctx,
    variant,

    filters,
    filterState,
    filterPayload,
    parsedFilters,
    search,
    setSearch,
    debouncedSearch,
    hasActiveSearch,
    hasActiveFilters,

    state,
    items: state.items,
    hookState,
    loadingIds,
    isFullLoading: initialLoading && state.isLoading,

    layoutOptions,
    activeLayout,
    isTable,
    setViewId,
    currentColumns,

    selectedItems,
    setSelectedItems,
    toggleSelected,
    openRowPanel,
    runningBulkActionId,
    setRunningBulkActionId,
    bulkEntries,
    hasRowActions,
    getRowMenu,
    getHref,
    getItemProps,
    handleRowClick
  };
};

export type DataListController = ReturnType<typeof useDataListController>;

export type { FilterPayload };
