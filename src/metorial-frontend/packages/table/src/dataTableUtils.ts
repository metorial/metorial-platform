import { endOfDay, startOfDay } from 'date-fns';
import { FilterPayload } from './filter';

export let getStringFilterValue = (value: FilterPayload | undefined) => {
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value && 'eq' in value && typeof value.eq === 'string')
    return value.eq;
  if (
    typeof value === 'object' &&
    value &&
    'in' in value &&
    Array.isArray(value.in) &&
    value.in.every(v => typeof v === 'string')
  ) {
    return value.in[0];
  }

  return undefined;
};

export let getListFilterValue = (value: FilterPayload | undefined) => {
  if (typeof value === 'object' && value && 'in' in value && Array.isArray(value.in)) {
    return value.in.map(v => v.toString());
  }

  return undefined;
};

export let getEnumListFilterValue = <T extends string>(
  value: FilterPayload | undefined,
  allowedValues: readonly T[]
) => {
  let values = getListFilterValue(value);
  if (!values) return undefined;

  let allowedValueSet = new Set<string>(allowedValues);
  let filteredValues = values.filter((item): item is T => allowedValueSet.has(item));

  return filteredValues.length > 0 ? filteredValues : undefined;
};

export let normalizeArrayFilterValue = <T extends string>(value: T | T[] | undefined) => {
  if (!value) return undefined;
  return Array.isArray(value) ? value : [value];
};

export let getConstrainedEnumListFilterValue = <T extends string>(
  value: FilterPayload | undefined,
  allowedValues: readonly T[],
  fallbackValue: T | T[] | undefined
) => {
  let selectedValues = getEnumListFilterValue(value, allowedValues);
  let fallbackValues = normalizeArrayFilterValue(fallbackValue);

  if (!selectedValues || selectedValues.length === 0) return fallbackValue;
  if (!fallbackValues || fallbackValues.length === 0) return selectedValues;

  let allowedFallbackSet = new Set<string>(fallbackValues);
  let intersection = selectedValues.filter(item => allowedFallbackSet.has(item));

  return intersection.length > 0 ? intersection : fallbackValue;
};

let isStartOfDay = (date: Date) => date.getTime() == startOfDay(date).getTime();

let lowerBound = (date: Date, inclusive: boolean) => {
  if (isStartOfDay(date) && !inclusive) return endOfDay(date);
  return inclusive ? new Date(date.getTime() - 1) : date;
};

let upperBound = (date: Date, inclusive: boolean) => {
  if (isStartOfDay(date)) return inclusive ? endOfDay(date) : startOfDay(date);
  return inclusive ? new Date(date.getTime() + 1) : date;
};

export let getDateRangeFilterValue = (value: FilterPayload | undefined) => {
  if (value instanceof Date) {
    return {
      gt: startOfDay(value),
      lt: endOfDay(value)
    };
  }

  if (typeof value !== 'object' || !value) return undefined;

  let nextFilter: { gt?: Date; lt?: Date } = {};

  if (value.gt instanceof Date) nextFilter.gt = lowerBound(value.gt, false);
  if (value.gte instanceof Date) nextFilter.gt = lowerBound(value.gte, true);
  if (value.lt instanceof Date) nextFilter.lt = upperBound(value.lt, false);
  if (value.lte instanceof Date) nextFilter.lt = upperBound(value.lte, true);

  if (!nextFilter.gt && !nextFilter.lt) return undefined;

  return nextFilter;
};
