import React, { useId } from 'react';
import { styled } from 'styled-components';
import { Button } from '../button';
import { ButtonSize } from '../button/constants';
import { Error } from '../error';
import { InputHeader } from '../input';
import { NumberInputField } from './field';

export type NumberInputPreset = {
  label: React.ReactNode;
  value: number;
  disabled?: boolean;
};

export type NumberInputProps = {
  label: React.ReactNode;
  value: number | null;
  onChange: (value: number | null) => void;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  description?: React.ReactNode;
  help?: React.ReactNode;
  hideLabel?: boolean;
  error?: any;
  unit?: React.ReactNode;
  min?: number;
  max?: number;
  step?: number;
  largeStep?: number;
  stepper?: boolean;
  presets?: NumberInputPreset[];
  format?: Intl.NumberFormatOptions;
  size?: ButtonSize;
  placeholder?: string;
  name?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  style?: React.CSSProperties;
};

let Wrapper = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
`;

let Presets = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
`;

let isPresetInRange = (value: number, min?: number, max?: number) =>
  (min === undefined || value >= min) && (max === undefined || value <= max);

export let NumberInput = ({
  label,
  description,
  help,
  hideLabel,
  error,
  presets,
  style,
  ...fieldProps
}: NumberInputProps) => {
  let id = useId();
  let isInteractive = !fieldProps.disabled && !fieldProps.readOnly;

  return (
    <Wrapper style={style}>
      <InputHeader
        id={id}
        label={label}
        hideLabel={hideLabel}
        help={help}
        description={description}
      />

      <NumberInputField id={id} invalid={!!error} {...fieldProps} />

      {!!presets?.length && (
        <Presets role="group" aria-label="Quick picks">
          {presets.map((preset, index) => {
            let isSelected = fieldProps.value === preset.value;
            let isAllowed =
              isInteractive &&
              !preset.disabled &&
              isPresetInRange(preset.value, fieldProps.min, fieldProps.max);

            return (
              <Button
                key={index}
                type="button"
                size="1"
                variant={isSelected ? 'soft' : 'outline'}
                aria-pressed={isSelected}
                disabled={!isAllowed}
                onClick={() => fieldProps.onChange(preset.value)}
              >
                {preset.label}
              </Button>
            );
          })}
        </Presets>
      )}

      {typeof error == 'string' && (
        <Error size={12} style={{ marginTop: 6 }}>
          {error}
        </Error>
      )}
    </Wrapper>
  );
};
