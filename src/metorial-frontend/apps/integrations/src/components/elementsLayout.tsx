import { AnimateHeight, theme } from '@metorial/ui';
import type { ReactNode } from 'react';
import styled, { css } from 'styled-components';
import type { Brand } from '../state/types';
import { BrandHeader } from './brandHeader';
import { ProgressIndicator } from './progressIndicator';
import { SecuredByFooter } from './securedByFooter';

type Variant = 'box' | 'light';

let Wrapper = styled.div<{ $variant: Variant }>`
  min-height: 100dvh;
  padding: 60px 20px;
  background: ${p =>
    p.$variant === 'light' ? theme.colors.background : theme.colors.gray300};
  display: flex;
  align-items: center;
  justify-content: center;

  @media (max-width: 640px) {
    padding: 0;
    background: ${theme.colors.background};
    align-items: flex-start;
  }
`;

let Card = styled.div<{ $variant: Variant }>`
  max-width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow: hidden;

  ${p =>
    p.$variant === 'box' &&
    css`
      background: ${theme.colors.background};
      box-shadow: ${theme.shadows.medium};
      border-radius: 12px;
    `}

  @media (max-width: 640px) {
    min-height: 100dvh;
    box-shadow: none;
    border-radius: 0;
  }

  @media (min-width: 641px) {
    width: 500px;
    min-height: 700px;
  }
`;

let CardInner = styled.div<{ $variant: Variant }>`
  width: 100%;
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  min-height: 100%;
  justify-content: ${p => (p.$variant === 'light' ? 'center' : 'flex-start')};
`;

let Header = styled.div<{ $variant: Variant }>`
  padding: 32px 24px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  width: 100%;
  border-bottom: ${p => (p.$variant === 'box' ? `1px solid ${theme.colors.gray200}` : 'none')};

  @media (max-width: 640px) {
    padding-top: 48px;
  }
`;

let Body = styled.div<{ $variant: Variant }>`
  flex-grow: ${p => (p.$variant === 'box' ? 1 : 0)};
`;

let Content = styled.div<{ $hideHeader: boolean }>`
  padding: ${p => (p.$hideHeader ? '32px 32px 0' : '20px 32px 0')};
  flex-grow: 1;
  width: 100%;

  @media (max-width: 640px) {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
`;

let Footer = styled.div`
  padding: 16px 24px 24px;
`;

export let ElementsLayout = ({
  brand,
  providerName,
  providerImageUrl,
  headerTitle,
  hideHeader = false,
  currentStep = 0,
  stepLabels = [],
  variant,
  isWhitelabel,
  children
}: {
  brand: Brand;
  providerName?: string | null;
  providerImageUrl?: string | null;
  headerTitle?: string;
  hideHeader?: boolean;
  currentStep?: number;
  stepLabels?: string[];
  variant: Variant;
  isWhitelabel?: boolean;
  children: ReactNode;
}) => (
  <Wrapper $variant={variant}>
    <Card $variant={variant}>
      <CardInner $variant={variant}>
        {!hideHeader && (
          <Header $variant={variant}>
            <BrandHeader
              brand={brand}
              providerName={providerName}
              providerImageUrl={providerImageUrl}
              title={headerTitle}
              align="center"
            />
          </Header>
        )}

        <Body $variant={variant}>
          <ProgressIndicator currentStep={currentStep} stepLabels={stepLabels} size="sm" />

          <AnimateHeight>
            <Content $hideHeader={hideHeader}>{children}</Content>
          </AnimateHeight>
        </Body>

        {!isWhitelabel && (
          <Footer>
            <SecuredByFooter />
          </Footer>
        )}
      </CardInner>
    </Card>
  </Wrapper>
);
