import { PaginationSearchParamsProvider, renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { Flex } from '@metorial/ui';
import { AgentTrackingDataGate } from '../../../scenes/agentTracking/gate';
import { AgentTrackingIndividualsGate } from '../../../scenes/agentTracking/privacy';
import {
  AgentTrackingTeamNotice,
  AgentTrackingTeamTable
} from '../../../scenes/agentTracking/team';

export let AgentTrackingTeamPage = () => {
  let instance = useCurrentInstance();

  return renderWithLoader({ instance })(({ instance }) => (
    <AgentTrackingIndividualsGate subject="The team list">
      <AgentTrackingDataGate instanceId={instance.data.id} subject="Your Team">
        <Flex direction="column" gap={14}>
          <AgentTrackingTeamNotice instanceId={instance.data.id} />

          <PaginationSearchParamsProvider enabled={true}>
            <AgentTrackingTeamTable instanceId={instance.data.id} />
          </PaginationSearchParamsProvider>
        </Flex>
      </AgentTrackingDataGate>
    </AgentTrackingIndividualsGate>
  ));
};
