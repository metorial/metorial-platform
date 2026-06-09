import { FilterPayload } from './tableFilter';

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
