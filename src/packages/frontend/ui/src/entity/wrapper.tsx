import React, { useMemo } from 'react';
import { styled } from 'styled-components';
import { theme } from '../theme';
import { EntityContext } from './context';

let Wrapper = styled('div')`
  border-radius: 12px;
  border: 1px solid ${theme.colors.gray400};
  box-shadow: ${theme.shadows.small};
  display: flex;
  flex-direction: column;
  position: relative;
  color: ${theme.colors.foreground};
`;

export let EntityWrapper = ({
  children,
  style,
  aligned,
  skeleton
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  aligned?: boolean;
  skeleton?: boolean;
}) => {
  let contextValue = useMemo(() => ({ aligned: !!aligned }), [aligned]);

  return (
    <EntityContext.Provider value={contextValue}>
      <Wrapper style={style}>{children}</Wrapper>
    </EntityContext.Provider>
  );
};
