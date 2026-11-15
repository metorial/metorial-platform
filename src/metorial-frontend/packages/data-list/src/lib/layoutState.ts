import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { TableColumn } from '../types';

let VIEW_STORAGE_KEY_PREFIX = 'dashboard-data-list-view';
let COLUMN_STORAGE_KEY_PREFIX = 'dashboard-table-layout';

type ColumnLayout = { id: string; isSelected: boolean }[];

export let getDefaultColumnLayout = (columns: TableColumn<any, any, any>[]): ColumnLayout =>
  columns.map(column => ({ id: column.id, isSelected: column.isDefault }));

export let sanitizeColumnLayout = (
  layout: ColumnLayout,
  columns: TableColumn<any, any, any>[]
): ColumnLayout => {
  let columnIds = new Set(columns.map(column => column.id));
  let nextLayout: ColumnLayout = [];
  let seenIds = new Set<string>();

  for (let item of layout) {
    if (!columnIds.has(item.id) || seenIds.has(item.id)) continue;

    nextLayout.push({ id: item.id, isSelected: item.isSelected });
    seenIds.add(item.id);
  }

  for (let column of columns) {
    if (seenIds.has(column.id)) continue;
    nextLayout.push({ id: column.id, isSelected: column.isDefault });
  }

  return nextLayout;
};

export let getStoredColumnLayout = (
  name: string,
  columns: TableColumn<any, any, any>[]
): ColumnLayout => {
  if (typeof window == 'undefined') return getDefaultColumnLayout(columns);

  try {
    let storedValue = window.localStorage.getItem(`${COLUMN_STORAGE_KEY_PREFIX}:${name}`);
    if (!storedValue) return getDefaultColumnLayout(columns);

    let parsedValue = JSON.parse(storedValue);
    if (!Array.isArray(parsedValue)) return getDefaultColumnLayout(columns);

    let layout = parsedValue.flatMap(item => {
      if (
        typeof item != 'object' ||
        item == null ||
        typeof item.id != 'string' ||
        typeof item.isSelected != 'boolean'
      ) {
        return [];
      }

      return [{ id: item.id, isSelected: item.isSelected }];
    });

    return sanitizeColumnLayout(layout, columns);
  } catch {
    return getDefaultColumnLayout(columns);
  }
};

export let storeColumnLayout = (name: string, layout: ColumnLayout) => {
  try {
    window.localStorage.setItem(
      `${COLUMN_STORAGE_KEY_PREFIX}:${name}`,
      JSON.stringify(layout)
    );
  } catch {}
};

let readStoredView = (name: string) => {
  try {
    return window.localStorage.getItem(`${VIEW_STORAGE_KEY_PREFIX}:${name}`) ?? undefined;
  } catch {
    return undefined;
  }
};

let storeView = (name: string, view: string) => {
  try {
    window.localStorage.setItem(`${VIEW_STORAGE_KEY_PREFIX}:${name}`, view);
  } catch {}
};

export let useLayoutView = (opts: {
  name: string;
  available: string[];
  defaultView: string;
  forced?: string;
  syncUrl: boolean;
}) => {
  let [searchParams, setSearchParams] = useSearchParams();
  let [stored, setStored] = useState<string | undefined>(() => readStoredView(opts.name));

  useEffect(() => setStored(readStoredView(opts.name)), [opts.name]);

  let candidates = [
    opts.forced,
    opts.syncUrl ? searchParams.get('view') : null,
    stored,
    opts.defaultView
  ];

  let view =
    candidates.find(
      (candidate): candidate is string => !!candidate && opts.available.includes(candidate)
    ) ??
    opts.available[0] ??
    opts.defaultView;

  let setView = useCallback(
    (next: string) => {
      storeView(opts.name, next);
      setStored(next);

      if (!opts.syncUrl) return;

      setSearchParams(
        current => {
          let nextParams = new URLSearchParams(current);
          nextParams.set('view', next);
          return nextParams;
        },
        { replace: true }
      );
    },
    [opts.name, opts.syncUrl, setSearchParams]
  );

  return [view, setView] as const;
};
