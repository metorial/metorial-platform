import { theme } from '@metorial/ui';
import React from 'react';
import styled, { keyframes } from 'styled-components';
import { RootLayout } from './rootLayout';

let fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(20px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

let Outer = styled('div')`
  padding: 0px 10px 10px 10px;
  animation: ${fadeIn} 0.2s cubic-bezier(0.26, 1.11, 0.87, 1.25);
`;

let Wrapper = styled('div')`
  height: calc(100dvh - 70px);
  background: ${theme.colors.background};
  border-radius: 10px;
  box-shadow: ${theme.shadows.large};
  overflow: auto;
`;

export let LargePaneLayout = ({
  children,
  Nav
}: {
  children: React.ReactNode;
  Nav: () => React.ReactNode;
}) => {
  return (
    <RootLayout Nav={Nav}>
      <Outer>
        <Wrapper>{children}</Wrapper>
      </Outer>
    </RootLayout>
  );
};
