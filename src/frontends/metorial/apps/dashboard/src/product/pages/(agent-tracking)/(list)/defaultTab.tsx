import { renderWithLoader } from '@metorial/data-hooks';
import { Navigate } from 'react-router-dom';
import { useAgentTrackingPrivacy } from '../../../scenes/agentTracking/privacy';

export let AgentTrackingDefaultTab = () => {
  let settings = useAgentTrackingPrivacy();

  return renderWithLoader(
    { settings },
    { error: () => <Navigate replace to="sessions" /> }
  )(({ settings }) => (
    <Navigate replace to={settings.data.privacy.hideIndividuals ? 'spend' : 'sessions'} />
  ));
};
