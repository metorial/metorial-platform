import * as RadixSlider from '@radix-ui/react-slider';
import clsx from 'clsx';
import React, { useEffect, useRef, useState } from 'react';
import { useDebounce } from 'react-use';
import { styled } from 'styled-components';
import { theme } from '../theme';

let Wrapper = styled.div`
  display: flex;
  flex-direction: column;

  .disabled {
    & > * {
      cursor: not-allowed !important;
    }
  }
`;

let Header = styled.header`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

let Label = styled.label`
  font-size: 12px;
  font-weight: 500;
`;

let Input = styled.input`
  border: solid 1px transparent;
  border-radius: 5px;
  padding: 4px 5px;
  font-size: 12px;
  font-weight: 500;
  outline: none;
  transition: all 0.2s ease;
  text-align: right;
  margin-right: -5px;
  color: ${theme.colors.gray600};

  &:focus {
    border-color: ${theme.colors.primary};
    color: ${theme.colors.foreground};
  }

  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  &[type='number'] {
    -moz-appearance: textfield;
    appearance: textfield;
  }
`;

let Description = styled.p`
  font-size: 12px;
  margin-bottom: 3px;
  color: ${theme.colors.gray600};
`;

let Root = styled(RadixSlider.Root)`
  position: relative;
  display: flex;
  align-items: center;
  user-select: none;
  touch-action: none;
  width: 100%;
  height: 20px;
`;

let Track = styled(RadixSlider.Track)`
  background: #ddd;
  position: relative;
  flex-grow: 1;
  border-radius: 9999;
  height: 3px;
`;

let Range = styled(RadixSlider.Range)`
  position: absolute;
  background: ${theme.colors.primary};
  border-radius: 9999;
  height: 100%;
`;

let Thumb = styled(RadixSlider.Thumb)`
  display: block;
  width: 20px;
  height: 20px;
  background: white;
  border-radius: 10px;
  border: solid 1px ${theme.colors.gray300};
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
  outline: none;

  &:focus {
    border: solid 1px ${theme.colors.primary};
  }
`;

export let Slider = ({
  value: value_,
  onChange: onChange_,
  description,
  step = 1,
  min = 0,
  max = 100,
  label,
  disabled,
  onValueCommit
}: {
  value?: number;
  onChange?: (value: number) => void;
  description?: React.ReactNode;
  step?: number;
  min?: number;
  max?: number;
  label: string;
  disabled?: boolean;
  onValueCommit?: (value: number) => void;
}) => {
  let [value, setValue] = useState(() => value_ ?? min ?? 0);

  let lastChangedRef = useRef(0);

  let onChange = (value: number) => {
    lastChangedRef.current = Date.now();
    setValue(value);
  };

  useEffect(() => {
    if (Date.now() - lastChangedRef.current < 50) return;
    onChange(value_ ?? min ?? 0);
  }, [value_]);

  useDebounce(
    () => {
      onChange_?.(value);
    },
    150,
    [value]
  );

  return (
    <Wrapper className={clsx({ disabled })}>
      <Header>
        <Label>{label}</Label>

        <Input
          type="number"
          value={value ?? 0}
          onChange={e => onChange?.(Math.max(min, Math.min(max, Number(e.target.value))))}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
        />
      </Header>

      {description && <Description>{description}</Description>}

      <Root
        step={step}
        min={min}
        max={max}
        value={typeof value == 'number' ? [value] : undefined}
        onValueChange={([value]) => onChange?.(value)}
        onValueCommit={([value]) => onValueCommit?.(value)}
        aria-label={label}
        disabled={disabled}
      >
        <Track>
          <Range />
        </Track>
        <Thumb />
      </Root>
    </Wrapper>
  );
};
