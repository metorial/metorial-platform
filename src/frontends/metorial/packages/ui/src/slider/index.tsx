import * as RadixSlider from '@radix-ui/react-slider';
import clsx from 'clsx';
import React, { useEffect, useRef, useState } from 'react';
import { useDebounce } from 'react-use';
import { styled } from 'styled-components';
import { theme } from '../theme';

let maxStopLabels = 5;

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
    border-color: ${theme.colors.gray400};
    color: ${theme.colors.gray300};
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

let ValueInput = styled.div`
  display: flex;
  align-items: center;
  border: 1px solid transparent;
  border-radius: 5px;
  color: ${theme.colors.gray600};
  font-size: 12px;
  font-weight: 500;

  &:focus-within {
    border-color: ${theme.colors.gray400};
    color: ${theme.colors.gray300};
  }

  input {
    width: 70px;
    margin-right: 0;
    border: none;
    color: inherit;
  }

  span {
    padding-right: 5px;
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

let ContinuousSlider = ({
  value: value_,
  onChange: onChange_,
  description,
  step = 1,
  min = 0,
  max = 100,
  label,
  disabled,
  unit,
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
  unit?: string;
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

        <ValueInput>
          <Input
            type="number"
            aria-label={unit ? `${label} (${unit})` : label}
            value={value ?? 0}
            onChange={e => onChange?.(Math.max(min, Math.min(max, Number(e.target.value))))}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
          />
          {unit && <span aria-hidden="true">{unit}</span>}
        </ValueInput>
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

export type SliderStop = { value: number; label?: string; disabled?: boolean };

let Stops = styled.div`
  position: relative;
  height: 18px;
  margin-top: 5px;

  button {
    position: absolute;
    white-space: nowrap;
    border: none;
    background: transparent;
    padding: 0;
    font-size: 11px;
    color: ${theme.colors.gray700};
    cursor: pointer;
  }

  button:disabled {
    color: ${theme.colors.gray500};
    cursor: not-allowed;
    text-decoration: line-through;
  }
`;

let DiscreteSlider = ({
  stops,
  value,
  onChange,
  label,
  description,
  disabled,
  unit,
  onValueCommit
}: {
  stops: SliderStop[];
  value?: number;
  onChange?: (value: number) => void;
  label: string;
  description?: React.ReactNode;
  disabled?: boolean;
  unit?: string;
  onValueCommit?: (value: number) => void;
}) => {
  let [inputValue, setInputValue] = useState(value === undefined ? '' : String(value));

  useEffect(() => {
    setInputValue(value === undefined ? '' : String(value));
  }, [value]);

  let index = Math.max(
    0,
    stops.findIndex(stop => stop.value === value)
  );
  let labelIndices = new Set(
    Array.from({ length: Math.min(maxStopLabels, stops.length) }, (_, index) =>
      Math.round(
        (index * (stops.length - 1)) / Math.max(1, Math.min(maxStopLabels, stops.length) - 1)
      )
    )
  );

  let select = (next: number, commit = false) => {
    let stop = stops[next];
    if (disabled || !stop || stop.disabled) return;
    onChange?.(stop.value);
    if (commit) onValueCommit?.(stop.value);
  };

  let commitInput = () => {
    let entered = Number(inputValue);
    let enabled = stops.filter(stop => !stop.disabled);
    if (disabled || !inputValue.trim() || !Number.isFinite(entered) || !enabled.length) {
      setInputValue(value === undefined ? '' : String(value));
      return;
    }

    let nearest = enabled.reduce((best, stop) =>
      Math.abs(stop.value - entered) < Math.abs(best.value - entered) ? stop : best
    );
    setInputValue(String(nearest.value));
    select(stops.indexOf(nearest), true);
  };

  return (
    <Wrapper className={clsx({ disabled })}>
      <Header>
        <Label>{label}</Label>
        <ValueInput>
          <Input
            type="number"
            aria-label={unit ? `${label} (${unit})` : label}
            value={inputValue}
            min={stops[0]?.value}
            max={stops[stops.length - 1]?.value}
            step="any"
            disabled={disabled || stops.every(stop => stop.disabled)}
            onChange={event => setInputValue(event.target.value)}
            onBlur={commitInput}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitInput();
              }
              if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
              event.preventDefault();
              let direction = event.key === 'ArrowUp' ? 1 : -1;
              let next = index + direction;
              while (next >= 0 && next < stops.length && stops[next].disabled)
                next += direction;
              select(next, true);
            }}
          />
          {unit && <span aria-hidden="true">{unit}</span>}
        </ValueInput>
      </Header>
      {description && <Description>{description}</Description>}
      <Root
        min={0}
        max={Math.max(1, stops.length - 1)}
        step={1}
        value={[index]}
        disabled={disabled || stops.every(stop => stop.disabled)}
        onValueChange={([next]) => select(next)}
        onValueCommit={([next]) => select(next, true)}
        onKeyDown={event => {
          let direction = ['ArrowRight', 'ArrowUp'].includes(event.key)
            ? 1
            : ['ArrowLeft', 'ArrowDown'].includes(event.key)
              ? -1
              : 0;
          if (!direction && event.key !== 'Home' && event.key !== 'End') return;
          event.preventDefault();
          let next =
            event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? stops.length - 1
                : index + direction;
          let step = event.key === 'End' ? -1 : direction || 1;
          while (next >= 0 && next < stops.length && stops[next].disabled) next += step;
          select(next, true);
        }}
      >
        <Track>
          <Range />
        </Track>
        <Thumb aria-label={label} aria-valuetext={stops[index]?.label ?? String(value)} />
      </Root>
      <Stops>
        {stops.map(
          (stop, index) =>
            labelIndices.has(index) && (
              <button
                key={stop.value}
                style={{
                  left: `${(index / Math.max(1, stops.length - 1)) * 100}%`,
                  transform:
                    index === 0
                      ? undefined
                      : index === stops.length - 1
                        ? 'translateX(-100%)'
                        : 'translateX(-50%)'
                }}
                type="button"
                disabled={disabled || stop.disabled}
                title={stop.disabled ? 'Unavailable' : undefined}
                onClick={() => select(index, true)}
              >
                {stop.label ?? stop.value}
              </button>
            )
        )}
      </Stops>
    </Wrapper>
  );
};

export let Slider = (
  props: React.ComponentProps<typeof ContinuousSlider> & { stops?: SliderStop[] }
) =>
  props.stops ? (
    <DiscreteSlider {...props} stops={props.stops} />
  ) : (
    <ContinuousSlider {...props} />
  );
