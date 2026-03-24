import { theme } from '@metorial-io/ui';
import styled from 'styled-components';

export let StepWrapper = styled.div<{ $isMetorialElement: boolean }>`
  display: flex;
  flex-direction: column;

  @media (max-width: 640px) {
    ${p =>
      p.$isMetorialElement &&
      `
      flex: 1;
      justify-content: flex-end;
    `}
  }
`;

export let StepContentBlock = styled.div<{ $isMetorialElement: boolean }>`
  @media (max-width: 640px) {
    ${p =>
      p.$isMetorialElement &&
      `
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: white;
      border-radius: 24px 24px 0 0;
      box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.1);
      padding: 32px 24px 32px;
    `}
  }
`;

let SecuredByWrapper = styled.div<{ $isMetorialElement?: boolean }>`
  display: none;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 12px;
  color: ${theme.colors.gray600};

  @media (max-width: 640px) {
    ${p =>
      p.$isMetorialElement &&
      `
      display: flex;
      color: #666;
      margin-top: 16px;
    `}
  }
`;

let SecuredByLink = styled.a`
  display: flex;
  align-items: center;
  gap: 3px;
  color: ${theme.colors.gray900};
  text-decoration: none;
  font-weight: 500;
`;

let SecuredByLogo = styled.img<{ $size?: number }>`
  width: ${p => p.$size || 14}px;
  height: ${p => p.$size || 14}px;
  border-radius: 3px;
`;

let METORIAL_LOGO_URL =
  'https://cdn.metorial.com/2025-06-13--14-59-55/logos/metorial/primary_logo/raw.svg';

interface SecuredByFooterProps {
  isMetorialElement?: boolean;
  logoSize?: number;
  className?: string;
}

export let SecuredByFooter = ({
  isMetorialElement,
  logoSize,
  className
}: SecuredByFooterProps) => (
  <SecuredByWrapper $isMetorialElement={isMetorialElement} className={className}>
    <span>Secured by</span>
    <SecuredByLink href="https://metorial.com" target="_blank" rel="noopener noreferrer">
      <SecuredByLogo src={METORIAL_LOGO_URL} alt="Metorial" $size={logoSize} />
      Metorial
    </SecuredByLink>
  </SecuredByWrapper>
);
