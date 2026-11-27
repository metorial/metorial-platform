import { renderWithLoader } from '@metorial/data-hooks';
import { Navigate } from 'react-router-dom';
import { useAgentTrackingIndividualsVisibility } from '../../../scenes/agentTracking/privacy';

export let AgentTrackingDefaultTab = () => {
  let { visibility, settings } = useAgentTrackingIndividualsVisibility();

  return renderWithLoader(
    { settings },
    { error: () => <Navigate replace to="sessions" /> }
  )(() => <Navigate replace to={visibility == 'hidden' ? 'spend' : 'sessions'} />);
};
