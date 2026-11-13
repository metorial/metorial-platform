import type React from 'react';
import {
  formatFilterDate,
  formatFilterDateRange,
  getCachedFilterLabel,
  isEmptyFilterValue,
  toFilterFieldNames,
  type TableFilter,
  type TableFilterState
} from './tableFilter';

export type FilterStateTuple = readonly [
  TableFilterState[],
  React.Dispatch<React.SetStateAction<TableFilterState[]>>
];

export type SearchStateTuple = readonly [string, React.Dispatch<React.SetStateAction<string>>];

export type ListFilter = TableFilter<any> & { type: 'select' | 'entity' };

export let isListFilter = (filter: TableFilter<any>): filter is ListFilter =>
  filter.type == 'select' || filter.type == 'entity';

export let upsertFilterState = (prev: TableFilterState[], state: TableFilterState) => {
  if (isEmptyFilterValue(state)) return prev.filter(f => f.id != state.id);

  let index = prev.findIndex(f => f.id == state.id);
  if (index == -1) return [...prev, state];

  let next = [...prev];
  next[index] = state;
  return next;
};

export let removeFilterState = (prev: TableFilterState[], id: string) =>
  prev.filter(f => f.id != id);

export let getListValue = (state: TableFilterState | undefined) =>
  state && (state.type == 'select' || state.type == 'entity') ? state.value : [];

export let setListValue = (filter: ListFilter, value: string[]): TableFilterState => ({
  id: filter.id,
  fields: toFilterFieldNames(filter.fields),
  type: filter.type,
  operation: 'eq',
  value
});

export let toggleListValue = (
  prev: TableFilterState[],
  filter: ListFilter,
  id: string,
  checked?: boolean
) => {
  let current = getListValue(prev.find(f => f.id == filter.id));
  let isSelected = current.includes(id);
  let shouldSelect = checked ?? !isSelected;
  if (shouldSelect == isSelected) return prev;

  let value = shouldSelect ? [...current, id] : current.filter(v => v != id);
  return upsertFilterState(prev, setListValue(filter, value));
};

export let getHighlightLabel = (filter: TableFilter<any>) =>
  typeof filter.highlight == 'object' && filter.highlight.label
    ? filter.highlight.label
    : filter.label;

export let isExclusiveHighlight = (filter: TableFilter<any>) =>
  typeof filter.highlight == 'object' && !!filter.highlight.exclusive;

export let preservesHighlightOrder = (filter: TableFilter<any>) =>
  typeof filter.highlight == 'object' && !!filter.highlight.preserveOrder;

export let sortFiltersForDisplay = (filters: TableFilter<any>[]) => [
  ...filters.filter(f => f.pinned),
  ...filters.filter(f => !f.pinned)
];

let operationSymbols = {
  eq: '',
  gt: '> ',
  lt: '< ',
  gte: '≥ ',
  lte: '≤ '
};

let operationWords = {
  eq: 'on ',
  gt: 'after ',
  lt: 'before ',
  gte: 'from ',
  lte: 'until '
};

export let summarizeLabels = (labels: string[], max = 2) => {
  if (labels.length <= max) return labels.join(', ');
  return `${labels.slice(0, max).join(', ')} +${labels.length - max}`;
};

export let getFilterValueLabels = (filter: TableFilter<any>, state: TableFilterState) => {
  if (filter.type == 'select' && state.type == 'select') {
    return state.value.map(id => filter.options.find(o => o.id == id)?.label ?? id);
  }

  if (state.type == 'select' || state.type == 'entity') {
    return state.value.map(id => getCachedFilterLabel(filter.id, id));
  }

  return [getFilterText(filter, state)];
};

export let getFilterText = (filter: TableFilter<any>, state: TableFilterState): string => {
  if (state.type == 'select' || state.type == 'entity') {
    return summarizeLabels(getFilterValueLabels(filter, state));
  }

  if (state.type == 'number') {
    if (state.operation == 'between') return `${state.value[0]} – ${state.value[1]}`;
    return `${operationSymbols[state.operation]}${state.value}`;
  }

  if (state.type == 'date') {
    if (state.operation == 'between') {
      return formatFilterDateRange(state.value[0], state.value[1]);
    }

    let prefix = state.operation == 'eq' ? '' : operationWords[state.operation];
    return `${prefix}${formatFilterDate(state.value)}`;
  }

  return state.value;
};

export let matchesQuery = (text: string, query: string) =>
  text.toLowerCase().includes(query.trim().toLowerCase());
