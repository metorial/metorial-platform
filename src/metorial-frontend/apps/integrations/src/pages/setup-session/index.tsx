import { useEffect } from 'react';
import {
  PublicErrorPage,
  PublicLoadingPage,
  PublicStatusPage,
  Redirect
} from '../../components/publicStatusPage';
import { ErrorIcon, SuccessIcon, WarningIcon } from '../../components/statusIcon';
import { useHideBootSpinner } from '../../lib/bootSpinner';
import { useSetupSession } from '../../state/loaders';
import { useSessionCredentials } from '../../state/useSessionCredentials';
import { SetupFlow } from './_flow';

let CLOSE_WINDOW_DELAY_MS = 2000;

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

export let SetupSessionPage = () => {
  let credentials = useSessionCredentials();
  let setupSession = useSetupSession(credentials);

  useHideBootSpinner(!!setupSession.data || !!setupSession.error);

  if (setupSession.error) return <PublicErrorPage error={setupSession.error} />;
  if (!setupSession.data || !credentials) return <PublicLoadingPage />;

  let { session, brand, provider, completionRedirect, isWhitelabel } = setupSession.data;

  let keepOpenForToolAccess =
    completionRedirect?.type === 'integration_setup_session' &&
    !!session.configuration?.toolFilters?.enabled;

  if (session.status === 'completed' && !keepOpenForToolAccess) {
    let redirectUrl = completionRedirect?.url ?? session.redirectUrl;
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
    return (
      <PublicStatusPage
        icon={<ErrorIcon />}
        title="Setup Failed"
        description="This authentication session has failed. Please request a new setup link or contact support."
        isWhitelabel={isWhitelabel}
      />
    );
  }

  return (
    <SetupFlow
      session={session}
      brand={brand}
      provider={provider}
      clientSecret={credentials.clientSecret}
      isWhitelabel={isWhitelabel}
      completionRedirectUrl={completionRedirect?.url}
    />
  );
};
