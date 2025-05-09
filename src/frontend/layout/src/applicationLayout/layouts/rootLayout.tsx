import { theme } from '@metorial/ui';
import React from 'react';
import styled, { createGlobalStyle } from 'styled-components';

let Wrapper = styled('div')`
  height: 100dvh;
  display: flex;
  flex-direction: column;
`;

let Global = createGlobalStyle`
  body {
    background: ${theme.colors.gray300};
  }
`;

export let RootLayout = ({
  children,
  Nav
}: {
  children: React.ReactNode;
  Nav: () => React.ReactNode;
}) => {
  return (
    <Wrapper>
      <Nav />
      <Global />

      {children}
    </Wrapper>
  );
};
