import { theme } from '@metorial/ui';
import { createContext, useContext, type ReactNode } from 'react';
import styled, { css } from 'styled-components';

let MobileSheetContext = createContext(false);

export let MobileSheetProvider = MobileSheetContext.Provider;

let Wrapper = styled.div<{ $isMobileSheet: boolean }>`
  display: flex;
  flex-direction: column;

  @media (max-width: 640px) {
    ${p =>
      p.$isMobileSheet &&
      css`
        flex: 1;
        justify-content: flex-end;
      `}
  }
`;

let Sheet = styled.div<{ $isMobileSheet: boolean }>`
  @media (max-width: 640px) {
    ${p =>
      p.$isMobileSheet &&
      css`
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: ${theme.colors.background};
        border-radius: 24px 24px 0 0;
        box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.1);
        padding: 32px 24px;
      `}
  }
`;

export let StepContainer = ({ children }: { children: ReactNode }) => {
  let isMobileSheet = useContext(MobileSheetContext);

  return (
    <Wrapper $isMobileSheet={isMobileSheet}>
      <Sheet $isMobileSheet={isMobileSheet}>{children}</Sheet>
    </Wrapper>
  );
};
