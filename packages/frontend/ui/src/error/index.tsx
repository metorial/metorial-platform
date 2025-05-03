import { RiErrorWarningLine } from '@remixicon/react';
import React from 'react';
import { styled } from 'styled-components';
import { theme } from '../theme';
import { calc } from '../theme/calc';

let Wrapper = styled('p')`
  display: flex;
  gap: 7px;
  align-items: center;
  color: ${theme.colors.red900};
  font-weight: 500;
`;

export let Error = ({
  size,
  children,
  style
}: {
  size?: string | number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) => {
  let sizeString = (typeof size == 'number' ? `${size}px` : size) || '14px';

  return (
    <Wrapper
      style={{
        fontSize: sizeString,
        ...style
      }}
    >
      <span
        style={{
          display: 'inline-flex'
        }}
      >
        <RiErrorWarningLine size={calc.multiply(sizeString, 1.3)} />
      </span>

      <span>{children}</span>
    </Wrapper>
  );
};
