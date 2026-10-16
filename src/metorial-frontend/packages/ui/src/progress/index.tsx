import { Progress as BaseProgress } from '@base-ui/react/progress';
import React from 'react';
import { keyframes, styled } from 'styled-components';
import { theme } from '../theme';
import type { ColorKey } from '../theme/colors';

export type ProgressSize = '1' | '2';

export type ProgressColor = 'blue' | 'green' | 'red' | 'orange' | 'gray';

export type ProgressProps = {
  value: number | null;
  max?: number;
  size?: ProgressSize;
  color?: ProgressColor;
  label?: React.ReactNode;
  valueLabel?: React.ReactNode;
  showValue?: boolean;
  'aria-label'?: string;
  style?: React.CSSProperties;
};

let trackHeights: Record<ProgressSize, number> = {
  '1': 6,
  '2': 10
};

let fillColors: Record<ProgressColor, ColorKey> = {
  blue: 'blue900',
  green: 'green900',
  red: 'red900',
  orange: 'orange900',
  gray: 'gray700'
};

let indeterminateSlide = keyframes`
  from { transform: translateX(-100%); }
  to { transform: translateX(300%); }
`;

let Root = styled(BaseProgress.Root)`
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  min-width: 0;
`;

let Header = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
`;

let Label = styled(BaseProgress.Label)`
  font-size: 12px;
  font-weight: 500;
  color: ${theme.colors.gray900};
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

let ValueText = styled('span')`
  font-size: 12px;
  font-weight: 500;
  color: ${theme.colors.gray600};
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  flex-shrink: 0;
`;

let Track = styled(BaseProgress.Track)<{ $height: number }>`
  position: relative;
  width: 100%;
  height: ${({ $height }) => $height}px;
  border-radius: 999px;
  background: ${theme.colors.gray300};
  overflow: hidden;
`;

let Indicator = styled(BaseProgress.Indicator)<{ $color: ColorKey }>`
  display: block;
  height: 100%;
  border-radius: 999px;
  background: ${({ $color }) => theme.colors[$color]};
  transition:
    width 0.3s ease,
    background 0.3s ease;

  &[data-indeterminate] {
    width: 33%;
    animation: ${indeterminateSlide} 1.2s cubic-bezier(0.65, 0, 0.35, 1) infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;

    &[data-indeterminate] {
      width: 100%;
      opacity: 0.4;
      animation: none;
    }
  }
`;

let getPercent = (value: number | null, max: number) => {
  if (value === null || !Number.isFinite(value) || max <= 0) return null;
  return Math.min(100, Math.max(0, Math.round((value / max) * 100)));
};

export let Progress = ({
  value,
  max = 100,
  size = '1',
  color = 'blue',
  label,
  valueLabel,
  showValue,
  style,
  ...rest
}: ProgressProps) => {
  let percent = getPercent(value, max);
  let shouldShowValue = valueLabel !== undefined || (showValue ?? !!label);
  let hasHeader = !!label || shouldShowValue;

  return (
    <Root
      value={value === null ? null : Math.min(Math.max(value, 0), max)}
      max={max}
      getAriaValueText={() => (percent === null ? 'Loading' : `${percent}%`)}
      aria-label={label ? undefined : rest['aria-label']}
      style={style}
    >
      {hasHeader && (
        <Header>
          {label ? <Label>{label}</Label> : <span />}

          {shouldShowValue && (
            <ValueText>{valueLabel ?? (percent === null ? null : `${percent}%`)}</ValueText>
          )}
        </Header>
      )}

      <Track $height={trackHeights[size]}>
        <Indicator $color={fillColors[color]} />
      </Track>
    </Root>
  );
};
