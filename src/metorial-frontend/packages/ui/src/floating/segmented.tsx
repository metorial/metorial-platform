import React from 'react';
import { styled } from 'styled-components';
import { theme } from '../theme';
import { Tooltip } from '../tooltip';

export type FloatingSegmentOption<T extends string> = {
  value: T;
  label?: React.ReactNode;
  icon?: React.ReactNode;
  tooltip?: string;
};

let Track = styled.div`
  display: inline-flex;
  flex: 0 0 auto;
  padding: 2px;
  border-radius: 8px;
  background: ${theme.colors.gray250};
`;

let Segment = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 28px;
  height: 24px;
  padding: 0 7px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: ${theme.colors.gray700};
  font-family: inherit;
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;

  &[aria-pressed='true'] {
    background: ${theme.colors.background};
    color: ${theme.colors.foreground};
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  svg {
    width: 14px;
    height: 14px;
  }
`;

export let FloatingSegmented = <T extends string>({
  value,
  options,
  onChange,
  'aria-label': ariaLabel
}: {
  value: T;
  options: FloatingSegmentOption<T>[];
  onChange: (value: T) => void;
  'aria-label'?: string;
}) => (
  <Track role="group" aria-label={ariaLabel}>
    {options.map(option => {
      let segment = (
        <Segment
          key={option.value}
          type="button"
          aria-pressed={option.value == value}
          aria-label={option.tooltip}
          onClick={() => onChange(option.value)}
        >
          {option.icon}
          {option.label}
        </Segment>
      );

      if (!option.tooltip) return segment;

      return (
        <Tooltip key={option.value} content={option.tooltip}>
          {segment}
        </Tooltip>
      );
    })}
  </Track>
);
