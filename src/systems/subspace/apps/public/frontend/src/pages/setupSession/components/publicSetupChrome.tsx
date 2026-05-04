import { CenteredSpinner, Group, Title, theme } from '@metorial/ui';
import type React from 'react';
import styled from 'styled-components';
import { SecuredByFooter } from './stepLayout';

let Wrapper = styled.div`
  min-height: 100dvh;
  padding: 60px 20px;
  background: white;
  display: flex;
  align-items: center;
  justify-content: center;

  @media (max-width: 640px) {
    padding: 0;
    align-items: flex-start;
  }
`;

let Inner = styled.div`
  width: 420px;
  max-width: 100%;
  margin: 0 auto;
`;

let Card = styled.div`
  overflow: hidden;

  & > div {
    border: none;
    border-radius: 0;
  }

  @media (max-width: 640px) {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    box-shadow: none;
    border-radius: 0;
    border: none;

    & > div {
      display: flex;
      flex-direction: column;
      flex: 1;

      & > *:first-child {
        margin: auto 0;
        border-bottom: none !important;
      }

      & > *:last-child {
        border-bottom: none !important;
      }
    }
  }
`;

export let PublicSetupFooter = styled(Group.Footer)`
  justify-content: center;
  border-top: none;
  display: flex;
  padding: 16px 0;

  @media (max-width: 640px) {
    margin-top: auto;
    padding: 24px;
  }
`;

export let PublicSetupStatusContent = styled(Group.Content)`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 24px;
`;

export let PublicSetupIconWrapper = styled.div`
  margin-bottom: 24px;
`;

export let PublicSetupStatusTitle = styled(Title)`
  text-align: center;
`;

export let PublicSetupStatusDescription = styled.p`
  text-align: center;
  line-height: 1.5;
  margin-top: 12px;
  color: ${theme.colors.gray600};
  font-size: 14px;
  text-wrap: balance;
`;

interface PublicSetupFrameProps {
  children: React.ReactNode;
}

export let PublicSetupFrame = ({ children }: PublicSetupFrameProps) => {
  return (
    <Wrapper>
      <Inner>
        <Card>{children}</Card>
      </Inner>
    </Wrapper>
  );
};

interface PublicSetupCardProps {
  children: React.ReactNode;
  isWhitelabel?: boolean;
}

export let PublicSetupCard = ({ children, isWhitelabel }: PublicSetupCardProps) => {
  return (
    <PublicSetupFrame>
      <Group.Wrapper>
        {children}
        {!isWhitelabel && (
          <PublicSetupFooter>
            <SecuredByFooter logoSize={16} isMetorialElement />
          </PublicSetupFooter>
        )}
      </Group.Wrapper>
    </PublicSetupFrame>
  );
};

interface PublicSetupStatusPageProps {
  icon: React.ReactElement;
  title: string;
  description: string;
  isWhitelabel?: boolean;
}

export let PublicSetupStatusPage = ({
  icon,
  title,
  description,
  isWhitelabel
}: PublicSetupStatusPageProps) => {
  return (
    <PublicSetupCard isWhitelabel={isWhitelabel}>
      <PublicSetupStatusContent>
        <PublicSetupIconWrapper>{icon}</PublicSetupIconWrapper>
        <PublicSetupStatusTitle size="3" weight="bold">
          {title}
        </PublicSetupStatusTitle>
        <PublicSetupStatusDescription>{description}</PublicSetupStatusDescription>
      </PublicSetupStatusContent>
    </PublicSetupCard>
  );
};

export let PublicSetupLoadingPage = () => <CenteredSpinner size={32} />;
