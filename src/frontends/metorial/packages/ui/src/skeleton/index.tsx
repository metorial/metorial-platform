import React from 'react';
import { css, keyframes, styled } from 'styled-components';
import { theme } from '../theme';

export type SkeletonProps = {
  active?: boolean;
  borderRadius?: React.CSSProperties['borderRadius'];
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

let skeletonSwipe = keyframes`
  0% {
    transform: translateX(-140%) skewX(-12deg);
  }

  60%, 100% {
    transform: translateX(330%) skewX(-12deg);
  }
`;

let SkeletonRoot = styled.span<{ $borderRadius: React.CSSProperties['borderRadius'] }>`
  position: relative;
  display: inline-grid;
  max-width: 100%;
  border-radius: ${({ $borderRadius }) =>
    typeof $borderRadius == 'number' ? `${$borderRadius}px` : $borderRadius};
  vertical-align: middle;
`;

let SkeletonContent = styled.span<{ $active: boolean }>`
  grid-area: 1 / 1;
  display: inline-grid;
  min-width: 0;
  opacity: ${({ $active }) => ($active ? 0 : 1)};
  pointer-events: ${({ $active }) => ($active ? 'none' : 'auto')};
  transition: opacity 100ms ease ${({ $active }) => ($active ? '0ms' : '35ms')};
`;

let SkeletonSurface = styled.span<{ $active: boolean }>`
  position: relative;
  grid-area: 1 / 1;
  min-width: 0;
  overflow: hidden;
  border-radius: inherit;
  background: ${theme.colors.gray300};
  opacity: ${({ $active }) => ($active ? 1 : 0)};
  pointer-events: none;
  transition: opacity 140ms ease-out;

  &::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: 45%;
    border-radius: inherit;
    background: rgba(255, 255, 255, 0.65);
    box-shadow: 0 0 12px rgba(255, 255, 255, 0.45);
    animation: ${skeletonSwipe} 1.35s ease-in-out infinite;

    ${({ $active }) =>
      !$active &&
      css`
        animation-play-state: paused;
      `}
  }

  @media (prefers-reduced-motion: reduce) {
    &::after {
      animation: none;
    }
  }
`;

export let Skeleton = ({
  active = false,
  borderRadius = 6,
  children,
  className,
  style
}: SkeletonProps) => (
  <SkeletonRoot
    className={className}
    style={style}
    $borderRadius={borderRadius}
    aria-busy={active || undefined}
  >
    <SkeletonContent $active={active} aria-hidden={active} inert={active || undefined}>
      {children}
    </SkeletonContent>
    <SkeletonSurface $active={active} aria-hidden="true" />
  </SkeletonRoot>
);
