import { NumberField } from '@base-ui/react/number-field';
import { RiAddLine, RiSubtractLine } from '@remixicon/react';
import React from 'react';
import { css, styled } from 'styled-components';
import { ButtonSize, getButtonSize } from '../button/constants';
import { inputFieldStyles, inputSurfaceStyles } from '../input';
import { theme } from '../theme';

export type NumberInputFieldProps = {
  id: string;
  value: number | null;
  onChange: (value: number | null) => void;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  invalid?: boolean;
  unit?: React.ReactNode;
  min?: number;
  max?: number;
  step?: number | 'any';
  largeStep?: number;
  stepper?: boolean;
  format?: Intl.NumberFormatOptions;
  size?: ButtonSize;
  placeholder?: string;
  name?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  autoFocus?: boolean;
};

let Root = styled(NumberField.Root)`
  width: 100%;
  min-width: 0;
`;

let Group = styled(NumberField.Group)`
  ${inputSurfaceStyles}

  &[data-disabled] {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

let Field = styled(NumberField.Input)`
  ${inputFieldStyles}
  min-width: 0;
  font-variant-numeric: tabular-nums;

  &:disabled {
    cursor: not-allowed;
  }
`;

let Unit = styled('span')`
  flex-shrink: 0;
  font-size: 14px;
  color: ${theme.colors.gray600};
  white-space: nowrap;
  user-select: none;
`;

let StepButtons = styled('div')`
  display: flex;
  align-items: center;
  align-self: stretch;
  gap: 2px;
  padding: 4px;
  flex-shrink: 0;
`;

let stepButtonStyles = css<{ $radius: string }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  aspect-ratio: 1;
  padding: 0;
  border: none;
  border-radius: ${({ $radius }) => $radius};
  background: transparent;
  color: ${theme.colors.gray700};
  cursor: pointer;
  transition:
    background 0.2s ease,
    color 0.2s ease;

  &:hover:not(:disabled),
  &:focus-visible {
    background: ${theme.colors.gray450};
    color: ${theme.colors.gray900};
    outline: none;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  svg {
    width: 14px;
    height: 14px;
  }
`;

let DecrementButton = styled(NumberField.Decrement)<{ $radius: string }>`
  ${stepButtonStyles}
`;

let IncrementButton = styled(NumberField.Increment)<{ $radius: string }>`
  ${stepButtonStyles}
`;

export let NumberInputField = ({
  id,
  value,
  onChange,
  onBlur,
  invalid,
  unit,
  min,
  max,
  step = 1,
  largeStep,
  stepper,
  format,
  size = '3',
  placeholder,
  name,
  disabled,
  readOnly,
  required,
  autoFocus
}: NumberInputFieldProps) => {
  let sizeStyles = getButtonSize(size);
  let horizontalPadding = sizeStyles.padding.split(' ')[1];
  let stepButtonRadius = `calc(${sizeStyles.borderRadius} - 4px)`;

  return (
    <Root
      id={id}
      value={value}
      onValueChange={nextValue => onChange(nextValue)}
      min={min}
      max={max}
      step={step}
      largeStep={largeStep}
      format={format}
      name={name}
      disabled={disabled}
      readOnly={readOnly}
      required={required}
    >
      <Group
        style={{
          height: sizeStyles.height,
          borderRadius: sizeStyles.borderRadius,
          outline: invalid ? `1px solid ${theme.colors.red900}` : undefined
        }}
      >
        <Field
          placeholder={placeholder}
          autoFocus={autoFocus}
          onBlur={onBlur}
          aria-invalid={invalid || undefined}
          style={{
            padding: sizeStyles.padding,
            paddingRight: unit || stepper ? 0 : undefined,
            fontSize: '14px'
          }}
        />

        {unit && <Unit style={{ paddingRight: stepper ? 0 : horizontalPadding }}>{unit}</Unit>}

        {stepper && (
          <StepButtons>
            <DecrementButton aria-label="Decrease" $radius={stepButtonRadius}>
              <RiSubtractLine />
            </DecrementButton>

            <IncrementButton aria-label="Increase" $radius={stepButtonRadius}>
              <RiAddLine />
            </IncrementButton>
          </StepButtons>
        )}
      </Group>
    </Root>
  );
};
