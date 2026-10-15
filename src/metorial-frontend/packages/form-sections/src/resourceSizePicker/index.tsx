import {
  InputDescription,
  InputLabel,
  OptionToggle,
  type ButtonSize,
  type OptionToggleItem,
  theme
} from '@metorial/ui';
import { RiArrowRightLine, RiLockLine } from '@remixicon/react';
import React, { type ReactNode } from 'react';
import styled from 'styled-components';
import {
  findResourceSizeOption,
  formatResourceSize,
  getPrimaryChoices,
  getSecondaryChoices,
  type ResourceSizeChoice,
  type ResourceSizeDimension,
  type ResourceSizeDimensions,
  type ResourceSizeOption,
  selectPrimaryValue
} from './lib';

export * from './lib';

export type ResourceSizePickerProps<D extends string = string> = {
  dimensions: ResourceSizeDimensions<D>;
  options: ResourceSizeOption<D>[];
  value: string | null;
  onChange: (optionId: string, option: ResourceSizeOption<D>) => void;
  currentValue?: string | null;
  label?: ReactNode;
  description?: ReactNode;
  unavailableTooltip?: ReactNode;
  disabled?: boolean;
  size?: ButtonSize;
  hideSummary?: boolean;
};

let Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
`;

let Heading = styled.div`
  display: flex;
  flex-direction: column;
`;

let Summary = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 13px;
  color: ${theme.colors.gray700};
`;

let SummaryValue = styled.span<{ $muted?: boolean }>`
  font-weight: 600;
  color: ${({ $muted }) => ($muted ? theme.colors.gray600 : theme.colors.gray900)};
`;

let toChoiceItems = <D extends string>(
  choices: ResourceSizeChoice<D>[],
  dimension: ResourceSizeDimension<D>,
  unavailableTooltip: ReactNode
): OptionToggleItem[] =>
  choices.map(choice => ({
    id: String(choice.value),
    label: dimension.format ? dimension.format(choice.value) : String(choice.value),
    disabled: !choice.available,
    tooltip: choice.available ? undefined : (choice.unavailableReason ?? unavailableTooltip),
    iconRight: choice.available ? undefined : <RiLockLine />
  }));

export let ResourceSizePicker = <D extends string>({
  dimensions,
  options,
  value,
  onChange,
  currentValue,
  label,
  description,
  unavailableTooltip,
  disabled,
  size = '2',
  hideSummary
}: ResourceSizePickerProps<D>) => {
  let [primary, secondary] = dimensions;
  let selected = options.find(option => option.id == value) ?? null;
  let current = currentValue
    ? (options.find(option => option.id == currentValue) ?? null)
    : null;

  let primaryChoices = getPrimaryChoices(options, dimensions);
  let selectedPrimary = selected?.values[primary.id] ?? null;
  let secondaryChoices =
    selectedPrimary === null ? [] : getSecondaryChoices(options, dimensions, selectedPrimary);

  let select = (option: ResourceSizeOption<D> | null | undefined) => {
    if (!option || !option.available || option.id == value) return;
    onChange(option.id, option);
  };

  let isChanged = !!current && !!selected && current.id != selected.id;

  return (
    <Wrapper>
      {(label || description) && (
        <Heading>
          {label && <InputLabel as="span">{label}</InputLabel>}
          {description && (
            <InputDescription style={{ marginBottom: 0 }}>{description}</InputDescription>
          )}
        </Heading>
      )}

      <OptionToggle
        label={primary.label}
        items={toChoiceItems(primaryChoices, primary, unavailableTooltip)}
        value={selectedPrimary === null ? '' : String(selectedPrimary)}
        onChange={nextValue =>
          select(selectPrimaryValue(options, dimensions, Number(nextValue), selected))
        }
        disabled={disabled}
        size={size}
        itemMinWidth={56}
        fullWidth
      />

      <OptionToggle
        label={secondary.label}
        items={toChoiceItems(secondaryChoices, secondary, unavailableTooltip)}
        value={selected ? String(selected.values[secondary.id]) : ''}
        onChange={nextValue =>
          selectedPrimary !== null &&
          select(
            findResourceSizeOption(options, dimensions, selectedPrimary, Number(nextValue))
          )
        }
        disabled={disabled || selectedPrimary === null}
        size={size}
        itemMinWidth={56}
        fullWidth
      />

      {!hideSummary && selected && (
        <Summary aria-live="polite">
          {isChanged && current && (
            <>
              <SummaryValue $muted>{formatResourceSize(current, dimensions)}</SummaryValue>
              <RiArrowRightLine size={14} aria-label="changes to" />
            </>
          )}

          <SummaryValue>{formatResourceSize(selected, dimensions)}</SummaryValue>
        </Summary>
      )}
    </Wrapper>
  );
};
