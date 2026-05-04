import { Button, CenteredSpinner, Flex, Group, Text, Title } from '@metorial/ui';
import type React from 'react';
import { useEffect } from 'react';
import styled from 'styled-components';
import { useHideBootSpinner } from '../../hooks/useHideBootSpinner';
import { useIntegrationSetupSession } from '../../state/setupSession';
import { ErrorIcon, SuccessIcon, WarningIcon } from '../setupSession/components/statusIcons';
import { SecuredByFooter } from '../setupSession/components/stepLayout';

export let IntegrationSetupSessionPage = () => {
  let setupSession = useIntegrationSetupSession();
  useHideBootSpinner(!!setupSession.data || !!setupSession.error);

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

  let { session, isWhitelabel } = setupSession.data;
  let pendingSteps = session.steps.filter(step => step.status !== 'configured');

  if (session.status === 'successful') {
    if (session.redirectUrl) {
      window.location.href = session.redirectUrl;
      return <LoadingPage />;
    }

    return (
      <StatusPageView
        icon={<SuccessIcon />}
        title="Setup Complete"
        description="All providers have been configured successfully."
        isWhitelabel={isWhitelabel}
      />
    );
  }

  if (session.status === 'expired') {
    return (
      <StatusPageView
        icon={<WarningIcon />}
        title="Session Expired"
        description="This integration setup session has expired. Please request a new setup link."
        isWhitelabel={isWhitelabel}
      />
    );
  }

  if (pendingSteps.length === 0) {
    return <LoadingPage />;
  }

  if (pendingSteps.length === 1) {
    return <SingleStepRedirect url={pendingSteps[0]!.url} />;
  }

  return (
    <Wrapper>
      <Inner>
        <Card>
          <Group.Wrapper>
            <Group.Header title={session.name ?? 'Configure Providers'} />
            <Group.Content>
              <Content>
                <Text color="gray600">
                  Choose the next provider to configure. Completed providers are marked as
                  configured.
                </Text>

                <ProviderList>
                  {session.steps.map(step => {
                    let isConfigured = step.status === 'configured';

                    return (
                      <ProviderRow key={step.id}>
                        <ProviderInfo>
                          <ProviderName>
                            {step.index + 1}. {step.provider.name}
                          </ProviderName>
                          <ProviderStatus>
                            {isConfigured ? 'Configured' : 'Pending'}
                          </ProviderStatus>
                        </ProviderInfo>

                        <Button
                          size="2"
                          variant={isConfigured ? 'outline' : 'solid'}
                          disabled={isConfigured}
                          onClick={() => {
                            window.location.href = step.url;
                          }}
                        >
                          {step.status === 'failed' || step.status === 'expired'
                            ? 'Retry'
                            : 'Configure'}
                        </Button>
                      </ProviderRow>
                    );
                  })}
                </ProviderList>
              </Content>
            </Group.Content>

            {!isWhitelabel && (
              <Footer>
                <SecuredByFooter logoSize={16} isMetorialElement />
              </Footer>
            )}
          </Group.Wrapper>
        </Card>
      </Inner>
    </Wrapper>
  );
};

let SingleStepRedirect = ({ url }: { url: string }) => {
  useEffect(() => {
    window.location.href = url;
  }, [url]);

  return <LoadingPage />;
};

let Wrapper = styled.div`
  min-height: 100dvh;
  padding: 60px 20px;
  background: white;
  display: flex;
  align-items: center;
  justify-content: center;
`;

let Inner = styled.div`
  width: 460px;
  max-width: 100%;
  margin: 0 auto;
`;

let Card = styled.div`
  overflow: hidden;
`;

let Content = styled.div`
  display: flex;
  flex-direction: column;
  gap: 18px;
`;

let ProviderList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

let ProviderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
`;

let ProviderInfo = styled.div`
  min-width: 0;
`;

let ProviderName = styled.div`
  font-weight: 600;
`;

let ProviderStatus = styled.div`
  color: #6b7280;
  font-size: 13px;
  margin-top: 2px;
`;

let Footer = styled(Group.Footer)`
  justify-content: center;
  border-top: none;
  display: flex;
  padding: 16px 0;
`;

interface StatusPageViewProps {
  icon: React.ReactElement;
  title: string;
  description: string;
  isWhitelabel?: boolean;
}

let StatusPageView = ({ icon, title, description, isWhitelabel }: StatusPageViewProps) => {
  return (
    <Wrapper>
      <Inner>
        <Card>
          <Group.Wrapper>
            <StatusContent>
              <IconWrapper>{icon}</IconWrapper>
              <Title size="3" weight="bold">
                {title}
              </Title>
              <StatusDescription>{description}</StatusDescription>
            </StatusContent>

            {!isWhitelabel && (
              <Footer>
                <SecuredByFooter logoSize={16} isMetorialElement />
              </Footer>
            )}
          </Group.Wrapper>
        </Card>
      </Inner>
    </Wrapper>
  );
};

let StatusContent = styled(Group.Content)`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 24px;
`;

let IconWrapper = styled.div`
  margin-bottom: 24px;
`;

let StatusDescription = styled.p`
  text-align: center;
  line-height: 1.5;
  margin-top: 12px;
  color: #666;
  font-size: 14px;
  text-wrap: balance;
`;

let LoadingPage = () => <CenteredSpinner size={32} />;
