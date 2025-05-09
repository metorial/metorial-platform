import React, { memo } from 'react';
import { styled } from 'styled-components';
import { theme } from '../theme';

let Wrapper = styled('div')`
  display: grid;
  grid-template-columns: 1fr min-content 1fr;
  gap: 10px;
  width: 100%;
`;

let LineWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: 10px;
`;

let Line = styled('div')`
  height: 1px;
  background-color: ${theme.colors.gray400};
  flex-grow: 1;
`;

let Text = styled('p')`
  color: ${theme.colors.gray600};
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
`;

export let Or = memo(() => {
  return (
    <Wrapper>
      <LineWrapper>
        <Line />
      </LineWrapper>

      <Text>or</Text>

      <LineWrapper>
        <Line />
      </LineWrapper>
    </Wrapper>
  );
});
