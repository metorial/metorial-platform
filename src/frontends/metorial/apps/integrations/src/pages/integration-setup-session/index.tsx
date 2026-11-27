import {
  PublicErrorPage,
  PublicStatusPage,
  Redirect
} from '../../components/publicStatusPage';
import { SuccessIcon, WarningIcon } from '../../components/statusIcon';
import { useIntegrationSetupSession } from '../../state/loaders';
import { useSessionCredentials } from '../../state/useSessionCredentials';

export let IntegrationSetupSessionPage = () => {
  let credentials = useSessionCredentials();
  let setupSession = useIntegrationSetupSession(credentials);

  if (setupSession.error) return <PublicErrorPage error={setupSession.error} />;
  if (!setupSession.data) return null;

  let { session, isWhitelabel } = setupSession.data;
  let nextStep = session.steps.find(step => step.status !== 'configured');

  if (session.status === 'successful' || !nextStep) {
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

  return <Redirect url={nextStep.url} />;
};
