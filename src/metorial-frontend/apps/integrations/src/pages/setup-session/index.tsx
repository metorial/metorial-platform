import { Markdown } from '@metorial/markdown/markdown';
import { Button, Callout, theme } from '@metorial/ui';
import { useEffect } from 'react';
import styled from 'styled-components';
import {
  PublicErrorPage,
  PublicStatusPage,
  Redirect
} from '../../components/publicStatusPage';
import { ErrorIcon, SuccessIcon, WarningIcon } from '../../components/statusIcon';
import { isAdminSession } from '../../lib/session';
import { useSetupSession } from '../../state/loaders';
import type { PrefetchedSetupData } from '../../state/types';
import { useSessionCredentials } from '../../state/useSessionCredentials';
import { SetupFlow } from './_flow';

let CLOSE_WINDOW_DELAY_MS = 2000;

let StatusSection = styled.div`
  width: 100%;
  margin-top: 24px;
  text-align: left;
`;

let StatusDetails = styled(StatusSection)`
  --font-size: 14px;
  padding: 16px;
  border-radius: 8px;
  background: ${theme.colors.gray100};
  border: 1px solid ${theme.colors.gray300};
`;

let MACHINE_ERROR_PATTERN = /^[a-z_]+$/;

let getDisplayableErrorMessage = (oauthSetup: PrefetchedSetupData['oauthSetup']) => {
  let message = oauthSetup?.errorMessage?.trim();
  if (!message) return null;
  if (message === oauthSetup?.errorCode || MACHINE_ERROR_PATTERN.test(message)) return null;
  return message;
};

let AlreadyCompletedPage = ({ isWhitelabel }: { isWhitelabel: boolean }) => {
  useEffect(() => {
    let timeout = setTimeout(() => window.close(), CLOSE_WINDOW_DELAY_MS);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <PublicStatusPage
      icon={<SuccessIcon />}
      title="Setup Complete"
      description="This setup session has already been completed. You can close this window."
      isWhitelabel={isWhitelabel}
    />
  );
};

let AdminSetupCompletedPage = ({
  adminInstructions,
  redirectUrl,
  isWhitelabel
}: {
  adminInstructions: string | null | undefined;
  redirectUrl: string | null | undefined;
  isWhitelabel: boolean;
}) => (
  <PublicStatusPage
    icon={<SuccessIcon />}
    title="Approved for Your Organization"
    description={
      adminInstructions
        ? 'Follow the steps below to finish setup.'
        : 'Everyone in your organization can now connect this integration.'
    }
    isWhitelabel={isWhitelabel}
  >
    {adminInstructions && (
      <StatusDetails>
        <Markdown>{adminInstructions}</Markdown>
      </StatusDetails>
    )}

    {redirectUrl && (
      <StatusSection>
        <Button
          size="3"
          fullWidth
          onClick={() => {
            window.location.href = redirectUrl;
          }}
        >
          Continue
        </Button>
      </StatusSection>
    )}
  </PublicStatusPage>
);

export let SetupSessionPage = () => {
  let credentials = useSessionCredentials();
  let setupSession = useSetupSession(credentials);

  if (setupSession.error) return <PublicErrorPage error={setupSession.error} />;
  if (!setupSession.data || !credentials) return null;

  let {
    session,
    brand,
    provider,
    completionRedirect,
    isWhitelabel,
    authConfigSchema,
    configSchema,
    oauthSetup,
    publicMcp
  } = setupSession.data;

  let keepOpenForToolAccess =
    completionRedirect?.type === 'integration_setup_session' &&
    !!session.configuration?.toolFilters?.enabled;

  if (session.status === 'completed' && !keepOpenForToolAccess) {
    let redirectUrl = completionRedirect?.url ?? session.redirectUrl;

    if (isAdminSession(session)) {
      return (
        <AdminSetupCompletedPage
          adminInstructions={oauthSetup?.adminInstructions}
          redirectUrl={redirectUrl}
          isWhitelabel={isWhitelabel}
        />
      );
    }

    if (redirectUrl) return <Redirect url={redirectUrl} />;

    return <AlreadyCompletedPage isWhitelabel={isWhitelabel} />;
  }

  if (session.status === 'expired') {
    return (
      <PublicStatusPage
        icon={<WarningIcon />}
        title="Session Expired"
        description="This setup session has expired. Please request a new setup link."
        isWhitelabel={isWhitelabel}
      />
    );
  }

  if (session.status === 'failed') {
    let errorMessage = getDisplayableErrorMessage(oauthSetup);

    return (
      <PublicStatusPage
        icon={<ErrorIcon />}
        title="Setup Failed"
        description="This authentication session has failed. Please request a new setup link or contact support."
        isWhitelabel={isWhitelabel}
      >
        {errorMessage && (
          <StatusSection>
            <Callout color="red">{errorMessage}</Callout>
          </StatusSection>
        )}
      </PublicStatusPage>
    );
  }

  return (
    <SetupFlow
      session={session}
      brand={brand}
      provider={provider}
      prefetched={{ authConfigSchema, configSchema, oauthSetup }}
      clientSecret={credentials.clientSecret}
      isWhitelabel={isWhitelabel}
      completionRedirectUrl={completionRedirect?.url}
      publicMcp={publicMcp}
    />
  );
};
