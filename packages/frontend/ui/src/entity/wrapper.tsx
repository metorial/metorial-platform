import React from 'react';
import { styled } from 'styled-components';
import { theme } from '../theme';

let Wrapper = styled('div')`
  border-radius: 12px;
  border: 1px solid ${theme.colors.gray300};
  display: flex;
  flex-direction: column;
  position: relative;
  color: ${theme.colors.foreground};
`;

export let EntityWrapper = ({
  children,
  style,
  skeleton
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  skeleton?: boolean;
}) => {
  return <Wrapper style={style}>{children}</Wrapper>;
};
