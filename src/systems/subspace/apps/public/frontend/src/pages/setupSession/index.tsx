import { useHideBootSpinner } from '../../hooks/useHideBootSpinner';
import { useSetupSession } from '../../state/setupSession';
import {
  PublicSetupLoadingPage,
  PublicSetupStatusPage
} from './components/publicSetupChrome';
import { ErrorIcon, SuccessIcon, WarningIcon } from './components/statusIcons';
import { SetupSessionFlow } from './setupSessionFlow';

export let SetupSessionPage = () => {
  let setupSession = useSetupSession();
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

  let { session, brand, provider, completionRedirect, isWhitelabel } = setupSession.data;
  let clientSecret = new URLSearchParams(window.location.search).get('client_secret') || '';
  let shouldKeepCompletedToolFilterSessionOpen =
    session.status === 'completed' &&
    completionRedirect?.type === 'integration_setup_session' &&
    !!session.configuration?.toolFilters?.enabled;

  if (session.status === 'completed' && !shouldKeepCompletedToolFilterSessionOpen) {
    if (completionRedirect?.url || session.redirectUrl) {
      window.location.href = completionRedirect?.url ?? session.redirectUrl!;
      return <PublicSetupLoadingPage />;
    }

    setTimeout(() => {
      try {
        window.close();
      } catch {}
    }, 2000);

    return (
      <PublicSetupStatusPage
        icon={<SuccessIcon />}
        title="Setup Complete"
        description="This setup session has already been completed. You can close this window."
        isWhitelabel={isWhitelabel}
      />
    );
  }

  if (session.status === 'expired') {
    return (
      <PublicSetupStatusPage
        icon={<WarningIcon />}
        title="Session Expired"
        description="This setup session has expired. Please request a new setup link."
        isWhitelabel={isWhitelabel}
      />
    );
  }

  if (session.status === 'failed') {
    return (
      <PublicSetupStatusPage
        icon={<ErrorIcon />}
        title="Setup Failed"
        description="This authentication session has failed. Please request a new setup link or contact support."
        isWhitelabel={isWhitelabel}
      />
    );
  }

  return (
    <SetupSessionFlow
      session={session}
      brand={brand}
      provider={provider}
      clientSecret={clientSecret}
      isWhitelabel={isWhitelabel}
      completionRedirectUrl={completionRedirect?.url}
    />
  );
};
