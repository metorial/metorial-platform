import { renderWithLoader } from '@metorial/data-hooks';
import { ContentLayout } from '@metorial/layout';
import { useCurrentInstance } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { AgentTrackingMember } from '../../scenes/agentTracking/member';
import { AgentTrackingIndividualsGate } from '../../scenes/agentTracking/privacy';

export let AgentTrackingMemberPage = () => {
  let instance = useCurrentInstance();
  let { memberId } = useParams();

  return (
    <ContentLayout>
      {renderWithLoader({ instance })(({ instance }) => (
        <AgentTrackingIndividualsGate subject="This person's page">
          <AgentTrackingMember instanceId={instance.data.id} memberId={memberId!} />
        </AgentTrackingIndividualsGate>
      ))}
    </ContentLayout>
  );
};
