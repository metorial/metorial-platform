import { Avatar, Button, Entity, Text, theme } from '@metorial/ui';
import { RiCheckLine } from '@remixicon/react';
import { useEffect } from 'react';
import styled from 'styled-components';
import { useHideBootSpinner } from '../../hooks/useHideBootSpinner';
import { useIntegrationSetupSession } from '../../state/setupSession';
import {
  PublicSetupLoadingPage,
  PublicSetupStatusPage
} from '../setupSession/components/publicSetupChrome';
import { ErrorIcon, SuccessIcon, WarningIcon } from '../setupSession/components/statusIcons';
import { MetorialElementsLayout } from '../setupSession/layouts/metorialElementsLayout';

let Entities = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

let Content = styled.div`
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding-bottom: 8px;
`;

let Description = styled(Text)`
  text-align: center;
  line-height: 1.5;
  text-wrap: balance;
`;

let ProviderStepButton = styled.button.withConfig({
  shouldForwardProp: prop => prop !== '$clickable'
})<{ $clickable?: boolean }>`
  appearance: none;
  background: transparent;
  border: 0;
  color: inherit;
  cursor: ${({ $clickable }) => ($clickable ? 'pointer' : 'default')};
  font: inherit;
  padding: 0;
  text-align: left;
  width: 100%;
`;

let StepCard = styled(Entity.Wrapper)<{ $clickable: boolean }>`
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;

  ${p =>
    p.$clickable &&
    `
      &:hover {
        border-color: ${theme.colors.gray400};
        box-shadow: ${theme.shadows.small};
        transform: translateY(-1px);
      }
    `}
`;

export let IntegrationSetupSessionPage = () => {
  let setupSession = useIntegrationSetupSession();
  useHideBootSpinner(!!setupSession.data || !!setupSession.error);

  if (setupSession.error) {
    return (
      <PublicSetupStatusPage
        icon={<ErrorIcon />}
        title="Something went wrong"
        description={(setupSession.error as Error).message}
      />
    );
  }

  if (!setupSession.data) {
    return <PublicSetupLoadingPage />;
  }

  let { session, brand, isWhitelabel } = setupSession.data;
  let pendingSteps = session.steps.filter(step => step.status !== 'configured');

  if (session.status === 'successful' || pendingSteps.length === 0) {
    if (session.redirectUrl) {
      window.location.href = session.redirectUrl;
      return <PublicSetupLoadingPage />;
    }

    return (
      <PublicSetupStatusPage
        icon={<SuccessIcon />}
        title="Setup Complete"
        description="All providers have been configured successfully."
        isWhitelabel={isWhitelabel}
      />
    );
  }

  if (session.status === 'expired') {
    return (
      <PublicSetupStatusPage
        icon={<WarningIcon />}
        title="Session Expired"
        description="This integration setup session has expired. Please request a new setup link."
        isWhitelabel={isWhitelabel}
      />
    );
  }

  if (pendingSteps.length === 1) {
    return <SingleStepRedirect url={pendingSteps[0]!.url} />;
  }

  return (
    <MetorialElementsLayout
      brand={brand}
      headerTitle={session.name ?? 'Configure Providers'}
      variant="box"
      isWhitelabel={isWhitelabel}
    >
      <Content>
        <Description color="gray700">
          Configure the following providers to complete the setup.
        </Description>

        <Entities>
          {session.steps.map(step => {
            let isConfigured = step.status === 'configured';

            return (
              <ProviderStepButton
                onClick={() => {
                  if (isConfigured) return;
                  window.location.href = step.url;
                }}
                type="button"
                $clickable={!isConfigured}
                key={step.id}
              >
                <StepCard $clickable={!isConfigured}>
                  <Entity.Content>
                    <Entity.Field
                      title={step.provider.name}
                      prefix={
                        <Avatar
                          entity={{
                            name: step.provider.name,
                            imageUrl: step.provider.imageUrl
                          }}
                          size={28}
                        />
                      }
                    />

                    <Entity.Field title="Actions" right>
                      {isConfigured ? (
                        <RiCheckLine size={16} color="#555" />
                      ) : (
                        <Button variant="outline" size="2" as="span">
                          Configure
                        </Button>
                      )}
                    </Entity.Field>
                  </Entity.Content>
                </StepCard>
              </ProviderStepButton>
            );
          })}
        </Entities>
      </Content>
    </MetorialElementsLayout>
  );
};

let SingleStepRedirect = ({ url }: { url: string }) => {
  useEffect(() => {
    window.location.href = url;
  }, [url]);

  return <PublicSetupLoadingPage />;
};
