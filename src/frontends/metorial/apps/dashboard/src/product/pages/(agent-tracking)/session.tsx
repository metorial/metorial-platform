import { renderWithLoader } from '@metorial/data-hooks';
import { ContentLayout } from '@metorial/layout';
import { useCurrentInstance } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { AgentTrackingIndividualsGate } from '../../scenes/agentTracking/privacy';
import { AgentTrackingSession } from '../../scenes/agentTracking/session';

export let AgentTrackingSessionPage = () => {
  let instance = useCurrentInstance();
  let { sessionId } = useParams();

  return (
    <ContentLayout>
      {renderWithLoader({ instance })(({ instance }) => (
        <AgentTrackingIndividualsGate subject="This session">
          <AgentTrackingSession instanceId={instance.data.id} sessionId={sessionId!} />
        </AgentTrackingIndividualsGate>
      ))}
    </ContentLayout>
  );
};
