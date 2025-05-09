import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import React, { useId } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { styled } from 'styled-components';
import { ButtonSize, getButtonSize } from '../button/constants';
import { Error } from '../error';
import { theme } from '../theme';
import { calc } from '../theme/calc';

let Wrapper = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
`;

export let InputLabel = styled('label')`
  font-size: 12px;
  color: ${theme.colors.gray900};
  margin-bottom: 5px;
  font-weight: 500;
  user-select: none;
  white-space: nowrap;
`;

export let InputDescription = styled('p')`
  font-size: 12px;
  color: ${theme.colors.gray600};
  margin-bottom: 8px;
  user-select: none;
`;

let InputWrapper = styled('div')`
  outline: 1px solid transparent;
  background: ${theme.colors.gray300};
  color: ${theme.colors.foreground};
  display: flex;
  width: 100%;
  transition: all 0.3s ease;
  gap: 8px;
  align-items: center;

  &:focus-within {
    background: ${theme.colors.gray400};
    outline: 1px solid ${theme.colors.gray600};
  }
`;

let InputField = styled('input')`
  flex-grow: 1;
  border: none;
  background: transparent;
  height: 100%;
  /* width: 100%; */
  outline: none;

  &::placeholder {
    color: ${theme.colors.gray700};
  }

  &[type='number'] {
    -moz-appearance: textfield;
  }

  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
`;

let TextareaField = styled(TextareaAutosize)`
  flex-grow: 1;
  border: none;
  background: transparent;
  height: 100%;
  width: 100%;
  outline: none;
  resize: none;

  &::placeholder {
    color: ${theme.colors.gray700};
  }
`;

let ColorSwatchInput = styled('input')`
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  border: none;
  background: none;
  cursor: pointer;
  padding: 0px;
  border-radius: 5px;

  &::-webkit-color-swatch-wrapper {
    padding: 0;
  }

  &::-webkit-color-swatch {
    border: none;
    border-radius: 5px;
  }
`;

export let Input = ({
  style,
  size = '3',
  label,
  description,
  hideLabel,
  error,
  as = 'input',
  minRows,
  maxRows,
  onInput,
  type = 'text',
  ...props
}: {
  style?: React.CSSProperties;
  size?: ButtonSize;
  label: React.ReactNode;
  description?: React.ReactNode;
  hideLabel?: boolean;
  error?: any;
  as?: 'textarea' | 'input';
  minRows?: number;
  maxRows?: number;
  onInput?: (value: string, e: React.ChangeEvent<HTMLInputElement>) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'onInput'>) => {
  let sizeStyles = getButtonSize(size);
  let id = useId();

  return (
    <Wrapper style={style}>
      {hideLabel ? (
        <VisuallyHidden>
          <InputLabel htmlFor={id}>{label}</InputLabel>
        </VisuallyHidden>
      ) : (
        <InputLabel htmlFor={id}>{label}</InputLabel>
      )}

      {description && <InputDescription>{description}</InputDescription>}
      <InputWrapper
        style={{
          height: as == 'textarea' ? undefined : sizeStyles.height,
          borderRadius: sizeStyles.borderRadius,
          outline: error ? `1px solid ${theme.colors.red900}` : undefined,
          paddingBlock: as == 'textarea' ? calc.divide(sizeStyles.height, 3.7) : undefined
        }}
      >
        {type == 'color' && (
          <div
            style={{
              paddingLeft: sizeStyles.padding
            }}
          >
            <ColorSwatchInput
              type="color"
              onChange={(e: any) => {
                onInput?.(e.target.value, e);
                props.onChange?.(e);
              }}
              value={props.value}
              style={{
                height: `calc(${sizeStyles.height} * 0.6)`,
                width: `calc(${sizeStyles.height} * 0.6)`
              }}
            />
          </div>
        )}

        {as == 'textarea' ? (
          <TextareaField
            id={id}
            minRows={minRows}
            maxRows={maxRows}
            style={{
              padding: sizeStyles.padding,
              fontSize: '14px',
              height: style?.height
            }}
            onChange={(e: any) => {
              onInput?.(e.target.value, e);
              props.onChange?.(e);
            }}
            type={type == 'color' ? 'text' : type}
            {...(props as any)}
          />
        ) : (
          <InputField
            id={id}
            style={{
              padding: sizeStyles.padding,
              height: sizeStyles.height,
              fontSize: '14px'
            }}
            onChange={(e: any) => {
              onInput?.(e.target.value, e);
              props.onChange?.(e);
            }}
            type={type == 'color' ? 'text' : type}
            {...props}
          />
        )}
      </InputWrapper>

      {typeof error == 'string' && (
        <Error size={12} style={{ marginTop: 6 }}>
          {error}
        </Error>
      )}
    </Wrapper>
  );
};
