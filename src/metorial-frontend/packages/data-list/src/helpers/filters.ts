import type {
  FilterPayload,
  TableFilter,
  TableFilterHighlight,
  TableFilterSelectOption
} from '@metorial/filter-bar';
import type { DataListFilterDef } from '../types';
import { getListFilterValue, getStringFilterValue } from '@metorial/filter-bar';
import { getDateRangeFilterValue } from '../lib/filterValues';
import type { StatusDescriptor } from './status';

type FilterBase = {
  id?: string;
  label?: string;
  description?: `Filter by ${string}`;
  field?: string;
  pinned?: boolean;
  highlight?: TableFilterHighlight;
};

let primaryField = (filter: TableFilter<any>) => String(filter.fields[0] ?? filter.id);

export let defineFilter = <Value>(
  filter: TableFilter<any>,
  parse: (payload: FilterPayload | undefined) => Value
): DataListFilterDef<Value> => ({ filter, parse });

export let readFilterPayload = (
  def: DataListFilterDef<any>,
  payload: Record<string, FilterPayload>
) => def.parse(payload[primaryField(def.filter)]);

export let f = {
  status: <V extends string, O extends V = V>(
    descriptor: StatusDescriptor<V>,
    opts: FilterBase & { only?: readonly O[] } = {}
  ) => {
    let id = opts.id ?? 'status';
    let only = opts.only as readonly string[] | undefined;
    let options = only
      ? descriptor.options.filter(o => only.includes(o.id))
      : descriptor.options;

    return defineFilter<O[] | undefined>(
      {
        id,
        fields: [opts.field ?? id],
        label: opts.label ?? 'Status',
        description: opts.description ?? 'Filter by status',
        type: 'select',
        options,
        pinned: opts.pinned,
        highlight: opts.highlight
      },
      payload => {
        let parsed = descriptor.parse(payload);
        let narrowed = only ? parsed?.filter(v => only.includes(v)) : parsed;
        return narrowed && narrowed.length > 0 ? (narrowed as O[]) : undefined;
      }
    );
  },

  select: <
    const O extends string | { id: string; label: string; description?: string },
    V extends string = O extends string
      ? O
      : O extends { id: infer I extends string }
        ? I
        : string
  >(
    id: string,
    label: string,
    options: readonly O[],
    opts: FilterBase = {}
  ) => {
    let normalized: TableFilterSelectOption[] = options.map(o =>
      typeof o == 'string'
        ? { id: o, label: o }
        : ({ ...(o as object) } as TableFilterSelectOption)
    );
    let values = normalized.map(o => o.id);

    return defineFilter<V[] | undefined>(
      {
        id: opts.id ?? id,
        fields: [opts.field ?? id],
        label: opts.label ?? label,
        description: opts.description ?? (`Filter by ${label.toLowerCase()}` as const),
        type: 'select',
        options: normalized,
        pinned: opts.pinned,
        highlight: opts.highlight
      },
      payload => {
        let selected = getListFilterValue(payload)?.filter(v => values.includes(v));
        return selected && selected.length > 0 ? (selected as V[]) : undefined;
      }
    );
  },

  date: (id: string, label: string, opts: FilterBase = {}) =>
    defineFilter(
      {
        id: opts.id ?? id,
        fields: [opts.field ?? id],
        label: opts.label ?? label,
        description: opts.description ?? (`Filter by ${label.toLowerCase()}` as const),
        type: 'date',
        pinned: opts.pinned
      },
      getDateRangeFilterValue
    ),

  createdAt: (opts: FilterBase = {}) =>
    f.date('createdAt', 'Created', { description: 'Filter by created date', ...opts }),

  updatedAt: (opts: FilterBase = {}) =>
    f.date('updatedAt', 'Updated', { description: 'Filter by updated date', ...opts }),

  string: (id: string, label: string, opts: FilterBase = {}) =>
    defineFilter<string | undefined>(
      {
        id: opts.id ?? id,
        fields: [opts.field ?? id],
        label: opts.label ?? label,
        description: opts.description ?? (`Filter by ${label.toLowerCase()}` as const),
        type: 'string',
        pinned: opts.pinned
      },
      getStringFilterValue
    ),

  number: (id: string, label: string, opts: FilterBase = {}) =>
    defineFilter<FilterPayload | undefined>(
      {
        id: opts.id ?? id,
        fields: [opts.field ?? id],
        label: opts.label ?? label,
        description: opts.description ?? (`Filter by ${label.toLowerCase()}` as const),
        type: 'number',
        pinned: opts.pinned
      },
      payload => payload
    ),

  entity: (filter: TableFilter<any>) =>
    defineFilter<string[] | undefined>(filter, getListFilterValue),

  entityOne: (filter: TableFilter<any>) =>
    defineFilter<string | undefined>(filter, payload => getListFilterValue(payload)?.[0])
};
