import { theme } from '@metorial/ui';
import React from 'react';
import styled from 'styled-components';

let Wrapper = styled('div')`
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
`;

let Header = styled('div')`
  padding: 15px 20px;
  border-bottom: 1px solid ${theme.colors.gray300};
  position: sticky;
  top: 0;
  background: ${theme.colors.background};
  z-index: 50;
`;

let Content = styled('div')`
  display: flex;
  flex-grow: 1;
  flex-direction: column;
  overflow: auto;
`;

export let ExtraHeaderLayout = ({
  children,
  header
}: {
  children: React.ReactNode;
  header: React.ReactNode;
}) => {
  return (
    <Wrapper>
      <Header>{header}</Header>
      <Content>{children}</Content>
    </Wrapper>
  );
};
