import React from 'react';
import { styled } from 'styled-components';
import { theme } from '../theme';

let Header = styled('header')`
  padding: 10px 20px;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  flex: 1;
  justify-content: flex-start;
  align-items: stretch;
  font-size: 16px;
  font-weight: 600;

  &:not(:first-child) {
    border-top: solid 1px ${theme.colors.gray300};
  }
`;

export let EntityHeader = ({ children }: { children: React.ReactNode }) => {
  return <Header>{children}</Header>;
};
