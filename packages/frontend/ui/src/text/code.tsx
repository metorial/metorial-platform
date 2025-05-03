import React from 'react';
import { styled } from 'styled-components';
import { theme } from '../theme';
import { TextSize, getTextStyles } from './constants';

let StyledCode = styled('code')`
  font-family: 'JetBrains Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier,
    monospace;
  background: transparent;
  padding: 0.2em 0.4em;
  color: ${theme.colors.gray900};
`;

export let Code = (props: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  size: TextSize;
}) => {
  let size = getTextStyles(props);

  return <StyledCode style={{ ...size, ...props.style }}>{props.children}</StyledCode>;
};

let StyledKbd = styled('kbd')`
  background-color: ${theme.colors.gray100};
  box-shadow: inset 0 -1px 0 ${theme.colors.gray300};
  border-radius: 0.2em;
  padding: 0.1em 0.3em;
  font-size: 0.9em;
  font-family: 'JetBrains Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier,
    monospace;
`;

export let Kbd = (props: { children: React.ReactNode; style?: React.CSSProperties }) => {
  return <StyledKbd style={{ ...props.style }}>{props.children}</StyledKbd>;
};
