import { AnimateHeight, theme } from '@metorial/ui';
import type { ReactNode } from 'react';
import styled from 'styled-components';
import { METORIAL_LOGO_URL } from '../components/setupBranding';
import {
  SetupBrandHeader,
  SetupProgressIndicator
} from '../components/setupProgress';
import type { Brand } from '../types';

let Wrapper = styled.div`
  min-height: 100dvh;
  padding: 60px 20px;
  background: rgba(240, 240, 240, 0.8);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;

  @media (max-width: 640px) {
    padding: 0;
    background: white;
    align-items: flex-start;
  }
`;

let Inner = styled.div`
  max-width: 100%;
  margin: 0 auto;
`;

let Card = styled.div`
  background: white;
  box-shadow: ${theme.shadows.medium};
  border-radius: 12px;
  /* border: 1px solid ${theme.colors.gray300}; */
  overflow: hidden;
  display: flex;
  align-items: center;
  flex-direction: column;

  @media (max-width: 640px) {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    box-shadow: none;
    border-radius: 0;
    border: none;
  }

  @media (min-width: 641px) {
    width: 500px;
    min-height: 700px;
  }
`;

let CardInner = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  min-height: 100%;
`;

let Header = styled.div`
  padding: 32px 24px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  border-bottom: 1px solid ${theme.colors.gray200};
  width: 100%;

  @media (max-width: 640px) {
    padding-top: 48px;
  }
`;

let Content = styled.div<{ $hideHeader: boolean }>`
  padding: ${p => (p.$hideHeader ? '32px 32px 0' : '20px 32px 0')};
  flex-grow: 1;
  max-width: 4520px;
  width: 100%;

  @media (max-width: 640px) {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
`;

let Footer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 12px;
  color: ${theme.colors.gray600};
  padding: 16px 24px 24px;
`;

let FooterLink = styled.a`
  display: flex;
  align-items: center;
  gap: 3px;
  color: ${theme.colors.gray900};
  text-decoration: none;
  font-weight: 500;
`;

let FooterLogo = styled.img`
  width: 14px;
  height: 14px;
  border-radius: 3px;
`;

let ContentWrapper = styled.div``;

interface MetorialElementsLayoutProps {
  brand: Brand;
  providerName?: string | null;
  providerImageUrl?: string | null;
  headerTitle?: string;
  children: ReactNode;
  hideHeader?: boolean;
  currentStep?: number;
  stepLabels?: string[];
  variant?: 'box' | 'light';
  isWhitelabel?: boolean;
}

export let MetorialElementsLayout = ({
  brand,
  providerImageUrl,
  providerName,
  headerTitle,
  children,
  hideHeader = false,
  currentStep = 0,
  stepLabels = [],
  variant = 'box',
  isWhitelabel
}: MetorialElementsLayoutProps) => {
  return (
    <Wrapper
      data-layout="metorial-elements"
      style={variant === 'light' ? { background: 'white' } : undefined}
    >
      <Inner>
        <Card
          style={
            variant === 'light'
              ? {
                  background: 'transparent',
                  boxShadow: 'none',
                  borderRadius: 0
                }
              : undefined
          }
        >
          <CardInner style={variant === 'light' ? { justifyContent: 'center' } : undefined}>
            {!hideHeader && (
              <Header style={variant === 'light' ? { borderBottom: 'none' } : undefined}>
                <SetupBrandHeader
                  brand={brand}
                  providerName={providerName}
                  providerImageUrl={providerImageUrl}
                  title={headerTitle}
                  align="center"
                />
              </Header>
            )}

            <ContentWrapper style={variant === 'box' ? { flexGrow: 1 } : undefined}>
              <SetupProgressIndicator currentStep={currentStep} stepLabels={stepLabels} size="sm" />

              <AnimateHeight>
                <Content $hideHeader={hideHeader}>{children}</Content>
              </AnimateHeight>
            </ContentWrapper>

            {!isWhitelabel && (
              <Footer>
                <span>Secured by</span>
                <FooterLink
                  href="https://metorial.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FooterLogo src={METORIAL_LOGO_URL} alt="Metorial" />
                  Metorial
                </FooterLink>
              </Footer>
            )}
          </CardInner>
        </Card>
      </Inner>
    </Wrapper>
  );
};
