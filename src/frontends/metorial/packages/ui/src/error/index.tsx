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

  let inner = children;

  if (typeof children == 'string' && children.startsWith('[') && children.includes(']')) {
    let endIndex = children.indexOf(']');
    let str = children.substring(endIndex + 1);

    if (str.startsWith(':')) {
      str = str.substring(1);
    }

    inner = str.trim();
  }

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

      <span>{inner}</span>
    </Wrapper>
  );
};
