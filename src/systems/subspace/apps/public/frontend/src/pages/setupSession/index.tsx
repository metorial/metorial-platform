import { CenteredSpinner, Group, Title, theme } from '@metorial-io/ui';
import React from 'react';
import styled from 'styled-components';
import { useSetupSession } from '../../state/setupSession';
import { SetupSessionFlow } from './SetupSessionFlow';
import { ErrorIcon, SuccessIcon, WarningIcon } from './components/StatusIcons';
import { SecuredByFooter } from './components/StepLayout';

export let SetupSessionPage = () => {
  let setupSession = useSetupSession();

  if (setupSession.error) {
    return (
      <StatusPageView
        icon={<ErrorIcon />}
        title="Something went wrong"
        description={(setupSession.error as Error).message}
      />
    );
  }

  if (!setupSession.data) {
    return <LoadingPage />;
  }

  let { session, brand, provider } = setupSession.data;
  let clientSecret = new URLSearchParams(window.location.search).get('client_secret') || '';

  if (session.status === 'completed') {
    if (session.redirectUrl) {
      window.location.href = session.redirectUrl;
      return <LoadingPage />;
    }

    return (
      <StatusPageView
        icon={<SuccessIcon />}
        title="Setup Complete"
        description="This setup session has already been completed. You can close this window."
      />
    );
  }

  if (session.status === 'expired') {
    return (
      <StatusPageView
        icon={<WarningIcon />}
        title="Session Expired"
        description="This setup session has expired. Please request a new setup link."
      />
    );
  }

  if (session.status === 'failed') {
    return (
      <StatusPageView
        icon={<ErrorIcon />}
        title="Setup Failed"
        description="This setup session has failed. Please request a new setup link or contact support."
      />
    );
  }

  return (
    <SetupSessionFlow
      session={session}
      brand={brand}
      provider={provider}
      clientSecret={clientSecret}
    />
  );
};

let Wrapper = styled.div`
  min-height: 100dvh;
  padding: 60px 20px;
  background: ${theme.colors.gray100};
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
  width: 420px;
  max-width: 100%;
  margin: 0 auto;
`;

let Card = styled.div`
  background: white;
  box-shadow: ${theme.shadows.medium};
  border-radius: 10px;
  border: 1px solid ${theme.colors.gray300};
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

let StatusContent = styled(Group.Content)`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 24px;
`;

let IconWrapper = styled.div`
  margin-bottom: 24px;
`;

let StatusTitle = styled(Title)`
  text-align: center;
`;

let StatusDescription = styled.p`
  text-align: center;
  line-height: 1.5;
  margin-top: 12px;
  color: #666;
  font-size: 14px;
`;

let Footer = styled(Group.Footer)`
  justify-content: center;
  border-top: none;

  @media (max-width: 640px) {
    margin-top: auto;
    padding: 24px;
  }
`;

interface StatusPageViewProps {
  icon: React.ReactElement;
  title: string;
  description: string;
}

let StatusPageView = ({ icon, title, description }: StatusPageViewProps) => {
  return (
    <Wrapper>
      <Inner>
        <Card>
          <Group.Wrapper>
            <StatusContent>
              <IconWrapper>{icon}</IconWrapper>
              <StatusTitle size="3" weight="bold">
                {title}
              </StatusTitle>
              <StatusDescription>{description}</StatusDescription>
            </StatusContent>

            <Footer>
              <SecuredByFooter logoSize={16} />
            </Footer>
          </Group.Wrapper>
        </Card>
      </Inner>
    </Wrapper>
  );
};

let LoadingPage = () => <CenteredSpinner size={32} />;
