import React, { useEffect, useId, useRef, useState } from 'react';
import { styled } from 'styled-components';
import { ButtonSize } from '../button/constants';
import { Error } from '../error';
import { InputHeader } from '../input';
import { NumberInputField } from '../numberInput/field';
import { Select } from '../select';
import { Switch } from '../switch';
import {
  defaultDurationUnits,
  DurationUnit,
  durationUnitSeconds,
  pickDurationUnit
} from './lib';

export * from './lib';

export type DurationInputProps = {
  label: React.ReactNode;
  value: number | null;
  onChange: (value: number | null) => void;
  description?: React.ReactNode;
  hideLabel?: boolean;
  error?: any;
  units?: DurationUnit[];
  min?: number;
  max?: number;
  allowNever?: boolean;
  neverLabel?: string;
  defaultValue?: number;
  size?: ButtonSize;
  disabled?: boolean;
  style?: React.CSSProperties;
};

let unitLabels: Record<DurationUnit, { one: string; other: string }> = {
  seconds: { one: 'Second', other: 'Seconds' },
  minutes: { one: 'Minute', other: 'Minutes' },
  hours: { one: 'Hour', other: 'Hours' },
  days: { one: 'Day', other: 'Days' }
};

let Wrapper = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
`;

let Row = styled('div')`
  display: flex;
  gap: 8px;
  width: 100%;
`;

let UnitSelect = styled('div')`
  width: 130px;
  flex-shrink: 0;
`;

export let DurationInput = ({
  label,
  value,
  onChange,
  description,
  hideLabel,
  error,
  units = defaultDurationUnits,
  min,
  max,
  allowNever,
  neverLabel = 'Never',
  defaultValue,
  size = '3',
  disabled,
  style
}: DurationInputProps) => {
  let id = useId();
  let [unit, setUnit] = useState(() => pickDurationUnit(value, units));
  let lastEmittedRef = useRef(value);
  let lastDurationRef = useRef(value);

  let unitSeconds = durationUnitSeconds[unit];
  let isNever = value === null;
  let amount = value === null ? null : value / unitSeconds;

  useEffect(() => {
    if (value !== null) lastDurationRef.current = value;
    if (value === lastEmittedRef.current || value === null) return;

    lastEmittedRef.current = value;
    if (value % durationUnitSeconds[unit] != 0) setUnit(pickDurationUnit(value, units));
  }, [value]);

  let emit = (nextValue: number | null) => {
    lastEmittedRef.current = nextValue;
    onChange(nextValue);
  };

  let setNever = (never: boolean) => {
    if (never) return emit(null);

    let restored = lastDurationRef.current ?? defaultValue ?? Math.max(min ?? 0, unitSeconds);
    emit(restored);
  };

  return (
    <Wrapper style={style}>
      <InputHeader
        id={id}
        label={label}
        hideLabel={hideLabel}
        description={description}
        help={
          allowNever ? (
            <Switch
              label={neverLabel}
              checked={isNever}
              onCheckedChange={setNever}
              disabled={disabled}
            />
          ) : undefined
        }
      />

      <Row>
        <NumberInputField
          id={id}
          value={amount}
          onChange={nextAmount => {
            if (nextAmount === null) return;
            emit(Math.round(nextAmount * unitSeconds));
          }}
          min={min === undefined ? undefined : min / unitSeconds}
          max={max === undefined ? undefined : max / unitSeconds}
          step="any"
          format={{ maximumFractionDigits: 2 }}
          placeholder={isNever ? neverLabel : undefined}
          invalid={!!error}
          size={size}
          disabled={disabled || isNever}
        />

        <UnitSelect>
          <Select
            label="Unit"
            hideLabel
            size={size}
            value={unit}
            disabled={disabled || isNever}
            items={units.map(item => ({
              id: item,
              label: amount === 1 ? unitLabels[item].one : unitLabels[item].other
            }))}
            onChange={nextUnit => {
              let next = nextUnit as DurationUnit;

              setUnit(next);
              if (amount !== null) emit(Math.round(amount * durationUnitSeconds[next]));
            }}
          />
        </UnitSelect>
      </Row>

      {typeof error == 'string' && (
        <Error size={12} style={{ marginTop: 6 }}>
          {error}
        </Error>
      )}
    </Wrapper>
  );
};
