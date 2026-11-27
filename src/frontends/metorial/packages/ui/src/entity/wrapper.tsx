import React, { useMemo } from 'react';
import { styled } from 'styled-components';
import { Title } from '../text';
import { theme } from '../theme';
import { EntityContext } from './context';

let Wrapper = styled('div').withConfig({
  shouldForwardProp: prop => prop !== '$hasHeader'
})<{ $hasHeader: boolean }>`
  border-radius: ${({ $hasHeader }) => ($hasHeader ? '8px' : '12px')};
  border: 1px solid ${theme.colors.gray400};
  box-shadow: ${theme.shadows.small};
  display: flex;
  flex-direction: column;
  position: relative;
  color: ${theme.colors.foreground};

  ${({ $hasHeader }) =>
    $hasHeader
      ? `
        background: ${theme.colors.gray100};
      `
      : ''}
`;

let Header = styled('header')`
  padding: 6px 18px 0 18px;
  margin-bottom: 6px;
`;

let HeaderContent = styled('div')`
  background: ${theme.colors.background};
  border: 1px solid ${theme.colors.gray400};
  border-radius: 8px;
  overflow: hidden;

  margin-left: -1px;
  margin-right: -1px;
  margin-bottom: -1px;
`;

export let EntityWrapper = ({
  children,
  header,
  style,
  aligned,
  skeleton
}: {
  children: React.ReactNode;
  header?: React.ReactNode;
  style?: React.CSSProperties;
  aligned?: boolean;
  skeleton?: boolean;
}) => {
  let contextValue = useMemo(() => ({ aligned: !!aligned }), [aligned]);
  let hasHeader = !!header;

  return (
    <EntityContext.Provider value={contextValue}>
      <Wrapper style={style} $hasHeader={hasHeader}>
        {hasHeader && (
          <Header>
            <Title as="h2" size="2" weight="strong">
              {header}
            </Title>
          </Header>
        )}
        {hasHeader ? <HeaderContent>{children}</HeaderContent> : children}
      </Wrapper>
    </EntityContext.Provider>
  );
};
