import { theme, type ColorKey, type ColorType } from '@metorial/ui';
import React from 'react';
import { styled } from 'styled-components';

let RADIUS = 46;
let CIRCUMFERENCE = 2 * Math.PI * RADIUS;

let colorKey = (color: ColorType, facet: '700' | '900') => `${color}${facet}` as ColorKey;

let Wrapper = styled.div<{ $size: number }>`
  position: relative;
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  flex-shrink: 0;

  svg {
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
  }
`;

let Track = styled.circle`
  fill: none;
  stroke: ${theme.colors.gray300};
  stroke-width: 6;
`;

let Value = styled.circle<{ $color: ColorType }>`
  fill: none;
  stroke: ${({ $color }) => theme.colors[colorKey($color, '700')]};
  stroke-width: 6;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.6s ease;
`;

let Center = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: ${theme.colors.gray600};
`;

let Score = styled.span<{ $size: number }>`
  font-size: ${({ $size }) => Math.round($size * 0.3)}px;
  line-height: 1;
  font-weight: 700;
  color: ${theme.colors.gray900};
  font-variant-numeric: tabular-nums;
`;

let Caption = styled.span`
  margin-top: 4px;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: ${theme.colors.gray600};
`;

let Label = styled.span<{ $color: ColorType }>`
  margin-top: 2px;
  font-size: 11px;
  font-weight: 600;
  color: ${({ $color }) => theme.colors[colorKey($color, '900')]};
`;

export type ScoreRingProps = {
  score?: number | null;
  max?: number;
  color?: ColorType;
  size?: number;
  caption?: React.ReactNode;
  label?: React.ReactNode;
  placeholder?: React.ReactNode;
};

export let ScoreRing = ({
  score,
  max = 100,
  color = 'gray',
  size = 112,
  caption,
  label,
  placeholder
}: ScoreRingProps) => {
  let hasScore = typeof score == 'number';
  let ratio = typeof score == 'number' ? Math.min(Math.max(score / max, 0), 1) : 0;

  return (
    <Wrapper
      $size={size}
      role={hasScore ? 'img' : undefined}
      aria-label={hasScore ? `Score ${score} out of ${max}` : undefined}
    >
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <Track cx="50" cy="50" r={RADIUS} />
        {hasScore && (
          <Value
            cx="50"
            cy="50"
            r={RADIUS}
            $color={color}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - ratio)}
          />
        )}
      </svg>

      <Center>
        {hasScore ? (
          <>
            <Score $size={size}>{score}</Score>
            {caption && <Caption>{caption}</Caption>}
            {label && <Label $color={color}>{label}</Label>}
          </>
        ) : (
          placeholder
        )}
      </Center>
    </Wrapper>
  );
};
