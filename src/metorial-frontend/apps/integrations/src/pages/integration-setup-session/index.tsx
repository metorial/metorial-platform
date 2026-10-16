import { Avatar, Button, Entity, Text, theme } from '@metorial/ui';
import { RiCheckLine } from '@remixicon/react';
import styled, { css } from 'styled-components';
import { ElementsLayout } from '../../components/elementsLayout';
import {
  PublicErrorPage,
  PublicLoadingPage,
  PublicStatusPage,
  Redirect
} from '../../components/publicStatusPage';
import { SuccessIcon, WarningIcon } from '../../components/statusIcon';
import { useHideBootSpinner } from '../../lib/bootSpinner';
import { useIntegrationSetupSession } from '../../state/loaders';
import { useSessionCredentials } from '../../state/useSessionCredentials';

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

let Steps = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

let StepButton = styled.button<{ $clickable: boolean }>`
  appearance: none;
  background: transparent;
  border: 0;
  color: inherit;
  cursor: ${p => (p.$clickable ? 'pointer' : 'default')};
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
    css`
      &:hover {
        border-color: ${theme.colors.gray400};
        box-shadow: ${theme.shadows.small};
        transform: translateY(-1px);
      }
    `}
`;

let ConfiguredIcon = styled(RiCheckLine)`
  color: ${theme.colors.gray700};
`;

export let IntegrationSetupSessionPage = () => {
  let credentials = useSessionCredentials();
  let setupSession = useIntegrationSetupSession(credentials);

  useHideBootSpinner(!!setupSession.data || !!setupSession.error);

  if (setupSession.error) return <PublicErrorPage error={setupSession.error} />;
  if (!setupSession.data) return <PublicLoadingPage />;

  let { session, brand, isWhitelabel } = setupSession.data;
  let pendingSteps = session.steps.filter(step => step.status !== 'configured');

  if (session.status === 'successful' || !pendingSteps.length) {
    if (session.redirectUrl) return <Redirect url={session.redirectUrl} />;

    return (
      <PublicStatusPage
        icon={<SuccessIcon />}
        title="Setup Complete"
        description="All providers have been configured successfully."
        isWhitelabel={isWhitelabel}
      />
    );
  }

  if (session.status === 'expired') {
    return (
      <PublicStatusPage
        icon={<WarningIcon />}
        title="Session Expired"
        description="This integration setup session has expired. Please request a new setup link."
        isWhitelabel={isWhitelabel}
      />
    );
  }

  if (pendingSteps.length === 1) return <Redirect url={pendingSteps[0]!.url} />;

  return (
    <ElementsLayout
      brand={brand}
      headerTitle={session.name ?? 'Configure Providers'}
      variant="box"
      isWhitelabel={isWhitelabel}
    >
      <Content>
        <Description color="gray700">
          Configure the following providers to complete the setup.
        </Description>

        <Steps>
          {session.steps.map(step => {
            let isConfigured = step.status === 'configured';

            return (
              <StepButton
                key={step.id}
                type="button"
                $clickable={!isConfigured}
                onClick={() => {
                  if (!isConfigured) window.location.href = step.url;
                }}
              >
                <StepCard $clickable={!isConfigured}>
                  <Entity.Content>
                    <Entity.Field
                      title={step.provider.name}
                      prefix={<Avatar entity={step.provider} size={28} />}
                    />

                    <Entity.Field title="Actions" right>
                      {isConfigured ? (
                        <ConfiguredIcon size={16} />
                      ) : (
                        <Button variant="outline" size="2" as="span">
                          Configure
                        </Button>
                      )}
                    </Entity.Field>
                  </Entity.Content>
                </StepCard>
              </StepButton>
            );
          })}
        </Steps>
      </Content>
    </ElementsLayout>
  );
};
