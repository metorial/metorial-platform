export type TableFilterEntityOption = { id: string; label: string; description?: string };

export type TableFilterEntityOptions = {
  items: TableFilterEntityOption[];
  isLoading?: boolean;
  empty?: string;
};

export type TableFilter<Item extends { id: string }> = {
  id: string;
  fields: (keyof Item | string)[];
  label: string;
  description: `Filter by ${string}`;
  pinned?: boolean;
} & (
  | {
      type: 'number';
    }
  | {
      type: 'date';
    }
  | {
      type: 'string';
    }
  | {
      type: 'select';
      options: { id: string; label: string }[];
    }
  | {
      type: 'entity';
      useOptions: (args: { search: string }) => TableFilterEntityOptions;
      useValueLabels?: (ids: string[]) => Record<string, string>;
      searchPlaceholder?: string;
      remoteSearch?: boolean;
    }
);

export type TableFilterStateNumber = {
  fields: string[];
  id: string;
  type: 'number';
} & (
  | {
      operation: 'eq' | 'gt' | 'lt' | 'gte' | 'lte';
      value: number;
    }
  | {
      operation: 'between';
      value: [number, number];
    }
);

export type TableFilterStateDate = {
  id: string;
  fields: string[];
  type: 'date';
} & (
  | {
      operation: 'eq' | 'gt' | 'lt' | 'gte' | 'lte';
      value: Date;
    }
  | {
      operation: 'between';
      value: [Date, Date];
    }
);

export type TableFilterStateString = {
  id: string;
  fields: string[];
  type: 'string';
  operation: 'eq';
  value: string;
};

export type TableFilterStateSelect = {
  id: string;
  fields: string[];
  type: 'select';
  operation: 'eq';
  value: string[];
};

export type TableFilterStateEntity = {
  id: string;
  fields: string[];
  type: 'entity';
  operation: 'eq';
  value: string[];
};

export type TableFilterState =
  | TableFilterStateNumber
  | TableFilterStateDate
  | TableFilterStateString
  | TableFilterStateSelect
  | TableFilterStateEntity;

export let toFilterFieldNames = (fields: ReadonlyArray<PropertyKey>): string[] =>
  fields.map(field => field.toString());

export let isEmptyFilterValue = (state: TableFilterState) => {
  if (state.type == 'select' || state.type == 'entity') return state.value.length == 0;
  if (state.type == 'string') return !state.value;
  return false;
};

let filterLabelCache = new Map<string, string>();

let filterLabelCacheKey = (filterId: string, optionId: string) => `${filterId}:${optionId}`;

export let rememberFilterLabels = (
  filterId: string,
  options: { id: string; label: string }[]
) => {
  for (let option of options) {
    filterLabelCache.set(filterLabelCacheKey(filterId, option.id), option.label);
  }
};

export let getCachedFilterLabel = (filterId: string, optionId: string) =>
  filterLabelCache.get(filterLabelCacheKey(filterId, optionId)) ?? optionId;

export type FilterPayload =
  | number
  | Date
  | string
  | {
      eq?: number | Date | string;
      gt?: number | Date | string;
      lt?: number | Date | string;
      gte?: number | Date | string;
      lte?: number | Date | string;
      in?: number[] | Date[] | string[];
    };

export let getFilterPayload = (currentFilters: TableFilterState[]) => {
  let payload: Record<string, FilterPayload> = {};

  for (let filter of currentFilters) {
    let filterPayload: FilterPayload = {};

    if (filter.type == 'number' || filter.type == 'date') {
      if (filter.operation == 'eq') filterPayload = filter.value;
      else if (filter.operation == 'gt') filterPayload = { gt: filter.value };
      else if (filter.operation == 'lt') filterPayload = { lt: filter.value };
      else if (filter.operation == 'gte') filterPayload = { gte: filter.value };
      else if (filter.operation == 'lte') filterPayload = { lte: filter.value };
      else if (filter.operation == 'between')
        filterPayload = { gte: filter.value[0], lte: filter.value[1] };
    } else if (filter.type == 'string') {
      filterPayload = filter.value;
    } else if (filter.type == 'select' || filter.type == 'entity') {
      filterPayload = { in: filter.value };
    }

    for (let field of filter.fields) {
      payload[field] = filterPayload;
    }
  }

  for (let prop in payload) {
    if (!payload[prop]) delete payload[prop];
  }

  return payload;
};

export let serializeToQuery = (currentFilters: TableFilterState[]) => {
  let query = new URLSearchParams();

  for (let filter of currentFilters) {
    if (filter.type == 'number' || filter.type == 'date') {
      let format = (value: number | Date) =>
        value instanceof Date ? value.toISOString() : value.toString();

      if (filter.operation == 'eq') query.append(filter.id, format(filter.value));
      else if (filter.operation == 'gt') query.append(`${filter.id}_gt`, format(filter.value));
      else if (filter.operation == 'lt') query.append(`${filter.id}_lt`, format(filter.value));
      else if (filter.operation == 'gte')
        query.append(`${filter.id}_gte`, format(filter.value));
      else if (filter.operation == 'lte')
        query.append(`${filter.id}_lte`, format(filter.value));
      else if (filter.operation == 'between') {
        query.append(`${filter.id}_gte`, format(filter.value[0]));
        query.append(`${filter.id}_lte`, format(filter.value[1]));
      }
    } else if (filter.type == 'string') {
      query.append(filter.id, filter.value);
    } else if (filter.type == 'select' || filter.type == 'entity') {
      query.append(filter.id, filter.value.join(','));
    }
  }

  return query.toString();
};

export let deserializeFromQuery = (query: URLSearchParams, filters: TableFilter<any>[]) => {
  let filterState: TableFilterState[] = [];

  for (let filter of filters) {
    let fields = toFilterFieldNames(filter.fields);
    let type = filter.type;

    if (type == 'number') {
      let operation: TableFilterStateNumber['operation'];
      let value: number | [number, number];

      if (query.has(filter.id)) {
        operation = 'eq';
        value = Number(query.get(filter.id)!);
      } else if (query.has(`${filter.id}_gt`)) {
        operation = 'gt';
        value = Number(query.get(`${filter.id}_gt`)!);
      } else if (query.has(`${filter.id}_lt`)) {
        operation = 'lt';
        value = Number(query.get(`${filter.id}_lt`)!);
      } else if (query.has(`${filter.id}_gte`) && query.has(`${filter.id}_lte`)) {
        operation = 'between';
        value = [
          Number(query.get(`${filter.id}_gte`)!),
          Number(query.get(`${filter.id}_lte`)!)
        ];
      } else if (query.has(`${filter.id}_gte`)) {
        operation = 'gte';
        value = Number(query.get(`${filter.id}_gte`)!);
      } else if (query.has(`${filter.id}_lte`)) {
        operation = 'lte';
        value = Number(query.get(`${filter.id}_lte`)!);
      } else {
        continue;
      }

      filterState.push({
        id: filter.id,
        fields,
        type,
        operation,
        value
      } as TableFilterStateNumber);
    } else if (type == 'date') {
      let operation: TableFilterStateDate['operation'];
      let value: Date | [Date, Date];

      if (query.has(filter.id)) {
        operation = 'eq';
        value = new Date(query.get(filter.id)!);
      } else if (query.has(`${filter.id}_gt`)) {
        operation = 'gt';
        value = new Date(query.get(`${filter.id}_gt`)!);
      } else if (query.has(`${filter.id}_lt`)) {
        operation = 'lt';
        value = new Date(query.get(`${filter.id}_lt`)!);
      } else if (query.has(`${filter.id}_gte`) && query.has(`${filter.id}_lte`)) {
        operation = 'between';
        value = [
          new Date(query.get(`${filter.id}_gte`)!),
          new Date(query.get(`${filter.id}_lte`)!)
        ];
      } else if (query.has(`${filter.id}_gte`)) {
        operation = 'gte';
        value = new Date(query.get(`${filter.id}_gte`)!);
      } else if (query.has(`${filter.id}_lte`)) {
        operation = 'lte';
        value = new Date(query.get(`${filter.id}_lte`)!);
      } else {
        continue;
      }

      let dates = Array.isArray(value) ? value : [value];
      if (dates.some(date => Number.isNaN(date.getTime()))) continue;

      filterState.push({
        id: filter.id,
        fields,
        type,
        operation,
        value
      } as TableFilterStateDate);
    } else if (type == 'string') {
      if (query.has(filter.id)) {
        filterState.push({
          id: filter.id,
          fields,
          type,
          operation: 'eq',
          value: query.get(filter.id)!
        } as TableFilterStateString);
      }
    } else if (type == 'select') {
      if (query.has(filter.id)) {
        filterState.push({
          id: filter.id,
          fields,
          type,
          operation: 'eq',
          value: query.get(filter.id)!.split(',')
        } as TableFilterStateSelect);
      }
    } else if (type == 'entity') {
      if (query.has(filter.id)) {
        filterState.push({
          id: filter.id,
          fields,
          type,
          operation: 'eq',
          value: query.get(filter.id)!.split(',')
        } as TableFilterStateEntity);
      }
    }
  }

  return filterState;
};

let isMidnight = (date: Date) =>
  date.getHours() == 0 &&
  date.getMinutes() == 0 &&
  date.getSeconds() == 0 &&
  date.getMilliseconds() == 0;

let isSameDay = (a: Date, b: Date) =>
  a.getFullYear() == b.getFullYear() &&
  a.getMonth() == b.getMonth() &&
  a.getDate() == b.getDate();

let formatFilterDay = (date: Date, now: Date) =>
  date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() == now.getFullYear() ? undefined : 'numeric'
  });

let formatFilterClock = (date: Date) =>
  date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: date.getSeconds() ? '2-digit' : undefined
  });

let roundInclusiveEnd = (date: Date) =>
  date.getMilliseconds() == 999 ? new Date(date.getTime() + 1) : date;

export let formatFilterDate = (date: Date, now = new Date()) =>
  isMidnight(date)
    ? formatFilterDay(date, now)
    : `${formatFilterDay(date, now)}, ${formatFilterClock(date)}`;

export let formatFilterDateRange = (from: Date, to: Date, now = new Date()) => {
  if (isMidnight(from) && isMidnight(to)) {
    return isSameDay(from, to)
      ? formatFilterDay(from, now)
      : `${formatFilterDay(from, now)} – ${formatFilterDay(to, now)}`;
  }

  let end = roundInclusiveEnd(to);

  if (isMidnight(from) && isMidnight(end)) {
    return isSameDay(from, to)
      ? formatFilterDay(from, now)
      : `${formatFilterDay(from, now)} – ${formatFilterDay(to, now)}`;
  }

  if (isSameDay(from, to)) {
    return `${formatFilterDate(from, now)} – ${formatFilterClock(end)}`;
  }

  return `${formatFilterDate(from, now)} – ${formatFilterDate(end, now)}`;
};
