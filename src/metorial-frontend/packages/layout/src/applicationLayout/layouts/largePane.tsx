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
  padding: 0px 0px 10px 10px;
  animation: ${fadeIn} 0.2s cubic-bezier(0.26, 1.11, 0.87, 1.25);
`;

let Wrapper = styled('div')<{ $bottomOffset?: string }>`
  height: calc(100dvh - 70px - ${({ $bottomOffset }) => $bottomOffset ?? '0px'});
  min-width: 0;
  background: ${theme.colors.background};
  border-radius: 10px;
  box-shadow: ${theme.shadows.large};
  overflow: auto;
`;

let Grid = styled('div')`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  min-width: 0;
`;

export let LargePaneLayout = ({
  children,
  bottomOffset,
  height,
  onContentScroll,
  right,
  Nav
}: {
  children: React.ReactNode;
  bottomOffset?: string;
  height?: number | string;
  onContentScroll?: React.UIEventHandler<HTMLDivElement>;
  right?: React.ReactNode;
  Nav: () => React.ReactNode;
}) => {
  let content = (
    <Wrapper $bottomOffset={bottomOffset} onScroll={onContentScroll}>
      {children}
    </Wrapper>
  );

  return (
    <RootLayout Nav={Nav} height={height}>
      <Outer>
        {right ? (
          <Grid>
            {content}
            {right}
          </Grid>
        ) : (
          content
        )}
      </Outer>
    </RootLayout>
  );
};
