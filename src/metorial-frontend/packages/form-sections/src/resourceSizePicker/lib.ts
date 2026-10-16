import type { ReactNode } from 'react';

export type ResourceSizeOption<D extends string = string> = {
  id: string;
  values: Record<D, number>;
  available: boolean;
  unavailableReason?: ReactNode;
};

export type ResourceSizeDimension<D extends string = string> = {
  id: D;
  label: ReactNode;
  format?: (value: number) => ReactNode;
  formatSummary?: (value: number) => string;
};

export type ResourceSizeDimensions<D extends string = string> = [
  ResourceSizeDimension<D>,
  ResourceSizeDimension<D>
];

export type ResourceSizeChoice<D extends string = string> = {
  value: number;
  available: boolean;
  unavailableReason?: ReactNode;
  option?: ResourceSizeOption<D>;
};

let byDimensions =
  <D extends string>(dimensions: ResourceSizeDimensions<D>) =>
  (a: ResourceSizeOption<D>, b: ResourceSizeOption<D>) =>
    a.values[dimensions[0].id] - b.values[dimensions[0].id] ||
    a.values[dimensions[1].id] - b.values[dimensions[1].id];

export let getPrimaryChoices = <D extends string>(
  options: ResourceSizeOption<D>[],
  dimensions: ResourceSizeDimensions<D>
): ResourceSizeChoice<D>[] => {
  let primary = dimensions[0].id;
  let choices = new Map<number, ResourceSizeChoice<D>>();

  for (let option of options) {
    let value = option.values[primary];
    let existing = choices.get(value);

    if (!existing) {
      choices.set(value, {
        value,
        available: option.available,
        unavailableReason: option.available ? undefined : option.unavailableReason
      });
    } else if (option.available) {
      choices.set(value, { value, available: true });
    }
  }

  return [...choices.values()].sort((a, b) => a.value - b.value);
};

export let getSecondaryChoices = <D extends string>(
  options: ResourceSizeOption<D>[],
  dimensions: ResourceSizeDimensions<D>,
  primaryValue: number
): ResourceSizeChoice<D>[] => {
  let [primary, secondary] = [dimensions[0].id, dimensions[1].id];

  return options
    .filter(option => option.values[primary] == primaryValue)
    .sort((a, b) => a.values[secondary] - b.values[secondary])
    .map(option => ({
      value: option.values[secondary],
      available: option.available,
      unavailableReason: option.available ? undefined : option.unavailableReason,
      option
    }));
};

export let findResourceSizeOption = <D extends string>(
  options: ResourceSizeOption<D>[],
  dimensions: ResourceSizeDimensions<D>,
  primaryValue: number,
  secondaryValue: number
) =>
  options.find(
    option =>
      option.values[dimensions[0].id] == primaryValue &&
      option.values[dimensions[1].id] == secondaryValue
  );

export let selectPrimaryValue = <D extends string>(
  options: ResourceSizeOption<D>[],
  dimensions: ResourceSizeDimensions<D>,
  primaryValue: number,
  current?: ResourceSizeOption<D> | null
): ResourceSizeOption<D> | null => {
  let candidates = getSecondaryChoices(options, dimensions, primaryValue)
    .filter(choice => choice.available)
    .map(choice => choice.option!);

  if (!candidates.length) return null;

  let secondary = dimensions[1].id;
  let currentSecondary = current?.values[secondary];
  if (currentSecondary === undefined) return candidates[0]!;

  let exact = candidates.find(option => option.values[secondary] == currentSecondary);
  if (exact) return exact;

  let larger = candidates.find(option => option.values[secondary] > currentSecondary);
  return larger ?? candidates[candidates.length - 1]!;
};

export let getDefaultResourceSizeOption = <D extends string>(
  options: ResourceSizeOption<D>[],
  dimensions: ResourceSizeDimensions<D>
) => [...options].filter(option => option.available).sort(byDimensions(dimensions))[0] ?? null;

export let formatResourceSize = <D extends string>(
  option: ResourceSizeOption<D>,
  dimensions: ResourceSizeDimensions<D>,
  separator = ' · '
) =>
  dimensions
    .map(dimension => {
      let value = option.values[dimension.id];
      return dimension.formatSummary ? dimension.formatSummary(value) : String(value);
    })
    .join(separator);
