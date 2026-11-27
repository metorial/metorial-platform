import React from 'react';
import { styled } from 'styled-components';
import { Spinner } from '../spinner';

let Indicator = styled.span<{ $loading: boolean; $size: number; $color: string }>`
  display: inline-grid;
  place-items: center;
  flex-shrink: 0;
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  color: ${({ $color }) => $color};
  transition: color 220ms ease;

  > span {
    grid-area: 1 / 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition:
      opacity 180ms ease,
      transform 220ms ease;
  }

  > span:first-child {
    opacity: ${({ $loading }) => ($loading ? 0 : 1)};
    transform: scale(${({ $loading }) => ($loading ? 0.5 : 1)});
  }

  > span:last-child {
    width: 100%;
    height: 100%;
    opacity: ${({ $loading }) => ($loading ? 1 : 0)};
    transform: scale(${({ $loading }) => ($loading ? 1 : 0.5)});
  }

  > span:last-child > div {
    box-sizing: border-box;
    transition: border-color 220ms ease;
    animation-play-state: ${({ $loading }) => ($loading ? 'running' : 'paused')};
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;

    > span {
      transition: none;
    }

    > span:last-child > div {
      transition: none;
      animation: none;
    }
  }
`;

export let BadgeIndicator = ({
  children,
  loading = false,
  size,
  color
}: {
  children: React.ReactNode;
  loading?: boolean;
  size: number;
  color: string;
}) => (
  <Indicator aria-hidden="true" $loading={loading} $size={size} $color={color}>
    <span>{children}</span>
    <span>
      <Spinner
        size={size}
        foreground="currentColor"
        background="color-mix(in srgb, currentColor 25%, transparent)"
      />
    </span>
  </Indicator>
);
