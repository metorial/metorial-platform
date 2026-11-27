import { theme } from '@metorial/ui';
import React from 'react';
import { styled } from 'styled-components';

let Wrapper = styled.p`
  color: ${theme.colors.gray700};
  font-size: 14px;
  font-weight: 500;
`;

let Mark = styled.mark`
  background: none;
  color: ${theme.colors.primary};
  font-weight: 600;
`;

export let Hint = ({ children }: { children: React.ReactNode }) => {
  return (
    <Wrapper>
      <Mark>Tip:</Mark> {children}
    </Wrapper>
  );
};
